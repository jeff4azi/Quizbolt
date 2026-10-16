import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

/**
 * usePresence hook
 * Lightweight presence without consuming Supabase Realtime channels.
 * - Heartbeats current user via `upsert_presence()` RPC every 60s.
 * - Polls presence for `watchUserIds` every 30s.
 * - Considered online if last_seen > NOW() - 90 seconds.
 */
export const usePresence = (watchUserIds = []) => {
  const [onlineIds, setOnlineIds] = useState(new Set());

  // 1. Heartbeat current user
  useEffect(() => {
    let mounted = true;

    const heartbeat = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        await supabase.rpc("upsert_presence");
      } catch (err) {
        // Non-critical background failure, ignore
      }
    };

    heartbeat();
    const interval = setInterval(heartbeat, 60_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Poll presence for watched IDs
  const serializedIds = JSON.stringify(
    Array.isArray(watchUserIds) ? watchUserIds.filter(Boolean).sort() : []
  );

  const fetchPresence = useCallback(async () => {
    const ids = JSON.parse(serializedIds);
    if (!ids || ids.length === 0) {
      setOnlineIds(new Set());
      return;
    }

    try {
      const threshold = new Date(Date.now() - 90_000).toISOString();
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
    refreshPresence: fetchPresence,
  };
};

export default usePresence;
