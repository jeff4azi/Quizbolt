import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

/**
 * usePresence hook
 * Lightweight presence without consuming Supabase Realtime channels.
 * - Heartbeats current user via `upsert_presence()` RPC every 50s.
 * - Also heartbeats on window focus & document visibility change.
 * - Polls presence for `watchUserIds` every 30s.
 * - Considered online if last_seen > NOW() - 90 seconds.
 */
export const usePresence = (watchUserIds = []) => {
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [onlineCount, setOnlineCount] = useState(1);
  const lastHeartbeatRef = useRef(0);

  // 1. Heartbeat current user globally
  useEffect(() => {
    let mounted = true;

    const sendHeartbeat = async () => {
      // Throttle heartbeats to at most once per 20 seconds
      const now = Date.now();
      if (now - lastHeartbeatRef.current < 20_000) return;
      lastHeartbeatRef.current = now;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        // Try RPC first
        const { error } = await supabase.rpc("upsert_presence");
        if (error) {
          // Direct upsert fallback
          await supabase.from("user_presence").upsert({
            user_id: session.user.id,
            last_seen: new Date().toISOString(),
          });
        }
      } catch (err) {
        // Non-critical background failure, ignore
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 50_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };

    const onFocus = () => {
      sendHeartbeat();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // 2. Poll presence for watched IDs & total count
  const serializedIds = JSON.stringify(
    Array.isArray(watchUserIds) ? watchUserIds.filter(Boolean).sort() : []
  );

  const fetchPresence = useCallback(async () => {
    try {
      const threshold = new Date(Date.now() - 90_000).toISOString();

      // Always fetch platform-wide online count
      const { count: totalOnline, error: countErr } = await supabase
        .from("user_presence")
        .select("*", { count: "exact", head: true })
        .gte("last_seen", threshold);

      if (!countErr && typeof totalOnline === "number") {
        setOnlineCount(Math.max(totalOnline, 1));
      }

      const ids = JSON.parse(serializedIds);
      if (!ids || ids.length === 0) {
        setOnlineIds(new Set());
        return;
      }

      const { data, error } = await supabase
        .from("user_presence")
        .select("user_id")
        .in("user_id", ids)
        .gte("last_seen", threshold);

      if (error) {
        console.warn("Presence fetch notice:", error.message);
        return;
      }

      setOnlineIds(new Set((data || []).map((r) => r.user_id)));
    } catch (err) {
      console.warn("Error checking presence:", err);
    }
  }, [serializedIds]);

  useEffect(() => {
    fetchPresence();
    const interval = setInterval(fetchPresence, 30_000);
    return () => clearInterval(interval);
  }, [fetchPresence]);

  const isOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      return onlineIds.has(userId);
    },
    [onlineIds]
  );

  return {
    isOnline,
    onlineIds,
    onlineCount,
    refreshPresence: fetchPresence,
  };
};

export default usePresence;
