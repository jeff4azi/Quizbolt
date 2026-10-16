import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import {
  getMyConnections,
  getMessages,
  getOrCreateConnection,
  sendFirstMessage,
  sendMessage as sendMsg,
  acceptConnection,
  declineConnection,
  blockUser as blockUserFn,
  markRead,
  subscribeToMessages,
  subscribeToIncoming,
  createReport,
  findConnection,
  fetchProfileByUsernameOrId,
} from "../services/messagingService";

export const useMessaging = (username = null) => {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetProfile, setTargetProfile] = useState(null);
  const [currentMessages, setCurrentMessages] = useState([]);

  const activeConnRef = useRef(null);

  // 1. Resolve current user ID
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCurrentUserId(session?.user?.id || null);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // 2. Fetch conversations when user is logged in
  const refreshConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const list = await getMyConnections(currentUserId);
      setConversations(list);
    } catch (err) {
      console.error("Error refreshing conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // 3. Periodic conversation refresh & window focus listener (0 Realtime WebSockets used)
  useEffect(() => {
    if (!currentUserId) return;

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        refreshConversations();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    // Refresh every 30s while active
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshConversations();
      }
    }, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
      clearInterval(timer);
    };
  }, [currentUserId, refreshConversations]);

  // 4. Resolve target user profile & connection if username provided
  useEffect(() => {
    if (!username) {
      setTargetProfile(null);
      setCurrentMessages([]);
      return;
    }

    let isMounted = true;

    const resolveTarget = async () => {
      // First check if already in hydrated conversations
      const lower = username.toLowerCase();
      const existingInList = conversations.find(
        (c) =>
          c.username?.toLowerCase() === lower ||
          c.userId?.toLowerCase() === lower
      );

      if (existingInList) {
        if (isMounted) {
          setTargetProfile({
            id: existingInList.userId,
            user_name: existingInList.username,
            full_name: existingInList.fullName,
            avatar_url: existingInList.avatarUrl,
            university: existingInList.university,
            department: existingInList.department,
            year: existingInList.year,
            is_premium: existingInList.isPremium,
          });
          activeConnRef.current = existingInList;
        }
        return;
      }

      // Otherwise fetch profile from Supabase
      try {
        const profile = await fetchProfileByUsernameOrId(username);
        if (profile && isMounted) {
          setTargetProfile(profile);
        }
      } catch (err) {
        console.error("Error resolving profile for chat:", err);
      }
    };

    resolveTarget();

    return () => {
      isMounted = false;
    };
  }, [username, conversations]);

  // Find active conversation from conversations list or target profile
  const matchedConv = conversations.find((c) => {
    if (!username) return false;
    const lower = username.toLowerCase();
    return (
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower ||
      (targetProfile && c.userId === targetProfile.id)
    );
  });

  const connectionId = matchedConv?.connectionId || null;
  const targetUserId = targetProfile?.id || matchedConv?.userId || null;

  // 5. Smart active chat polling (3-second lightweight REST sync)
  // Runs ONLY when actively viewing this open chat, AND only when tab is visible.
  // Consumes 0 Realtime WebSocket connections!
  const refreshActiveMessages = useCallback(async () => {
    if (!connectionId || !currentUserId) return;
    const msgs = await getMessages(connectionId, currentUserId);
    setCurrentMessages(msgs);
  }, [connectionId, currentUserId]);

  useEffect(() => {
    if (!connectionId || !currentUserId) {
      if (!matchedConv) setCurrentMessages([]);
      return;
    }

    let isMounted = true;

    const performSync = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        // 1. Fetch latest messages from DB
        const latestMsgs = await getMessages(connectionId, currentUserId);
        if (!isMounted) return;

        // 2. Check if messages have changed or if read status updated
        setCurrentMessages((prev) => {
          if (prev.length !== latestMsgs.length) return latestMsgs;
          const hasDiff = prev.some((m, idx) => {
            const next = latestMsgs[idx];
            return (
              !next ||
              m.id !== next.id ||
              m.status !== next.status ||
              m.text !== next.text
            );
          });
          return hasDiff ? latestMsgs : prev;
        });

        // 3. If there are incoming unread messages from "them", mark them read
        const hasUnreadIncoming = latestMsgs.some(
          (m) => m.sender === "them" && m.status !== "read"
        );
        if (hasUnreadIncoming) {
          await markRead(connectionId, currentUserId);
          if (isMounted) {
            setCurrentMessages((prev) =>
              prev.map((m) =>
                m.sender === "them" ? { ...m, status: "read" } : m
              )
            );
            refreshConversations();
          }
        }
      } catch (err) {
        console.error("Chat sync error:", err);
      }
    };

    // Initial sync
    performSync();

    // 3-second active sync interval while chat is open
    const interval = setInterval(performSync, 3000);

    // Sync immediately when tab is focused or becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        performSync();
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [connectionId, currentUserId, matchedConv, refreshConversations]);

  // Construct currentConv UI model
  const currentConv = matchedConv
    ? {
        ...matchedConv,
        messages: currentMessages.length > 0 ? currentMessages : matchedConv.messages || [],
      }
    : targetProfile
    ? {
        connectionId: null,
        userId: targetProfile.id,
        username: targetProfile.user_name || targetProfile.id,
        fullName: targetProfile.full_name || targetProfile.user_name || "Scholar",
        avatarUrl: targetProfile.avatar_url,
        university: targetProfile.university || "University",
        department: targetProfile.department || "General Studies",
        year: targetProfile.year || 1,
        isPremium: Boolean(targetProfile.is_premium),
        connectionState: "none",
        unread: false,
        unreadCount: 0,
        lastActivity: new Date().toISOString(),
        messages: currentMessages,
      }
    : null;

  const connectionState = currentConv ? currentConv.connectionState : "none";

  // Calculate total unread count across all conversations
  const totalUnreadCount = conversations.reduce((acc, conv) => {
    if (conv.unread) {
      return acc + (conv.unreadCount > 0 ? conv.unreadCount : 1);
    }
    return acc;
  }, 0);

  // Send message handler
  const sendMessage = useCallback(
    async (text) => {
      if (!text?.trim() || !currentUserId || !targetUserId) return null;

      try {
        let activeConnId = connectionId;

        // If no connection row exists, create one
        if (!activeConnId) {
          const conn = await getOrCreateConnection(currentUserId, targetUserId);
          if (!conn) throw new Error("Could not initialize connection");
          activeConnId = conn.id;
          await sendFirstMessage(activeConnId, currentUserId, text);
        } else {
          // If request_received, sending a reply automatically accepts the request!
          if (connectionState === "request_received") {
            await acceptConnection(activeConnId);
          }
          await sendMsg(activeConnId, currentUserId, text);
        }

        await refreshActiveMessages();
        await refreshConversations();
      } catch (err) {
        console.error("Failed to send message:", err);
        throw err;
      }
    },
    [
      currentUserId,
      targetUserId,
      connectionId,
      connectionState,
      refreshActiveMessages,
      refreshConversations,
    ]
  );

  const accept = useCallback(async () => {
    if (!connectionId) return;
    try {
      await acceptConnection(connectionId);
      await refreshConversations();
    } catch (err) {
      console.error("Failed to accept connection:", err);
    }
  }, [connectionId, refreshConversations]);

  const decline = useCallback(async () => {
    if (!connectionId) return;
    try {
      await declineConnection(connectionId);
      await refreshConversations();
    } catch (err) {
      console.error("Failed to decline connection:", err);
    }
  }, [connectionId, refreshConversations]);

  const block = useCallback(async () => {
    if (!currentUserId || !targetUserId) return;
    try {
      await blockUserFn(currentUserId, targetUserId, connectionId);
      await refreshConversations();
    } catch (err) {
      console.error("Failed to block user:", err);
    }
  }, [currentUserId, targetUserId, connectionId, refreshConversations]);

  const markAsRead = useCallback(async () => {
    if (connectionId && currentUserId) {
      await markRead(connectionId, currentUserId);
    }
  }, [connectionId, currentUserId]);

  const report = useCallback(
    async ({ reason, description, blockToo = false }) => {
      if (!currentUserId || !targetUserId) return;
      return await createReport({
        reporterId: currentUserId,
        reportedId: targetUserId,
        reason,
        description,
        blockToo,
        connectionId,
      });
    },
    [currentUserId, targetUserId, connectionId]
  );

  return {
    conversations,
    totalUnreadCount,
    currentConv,
    connectionState,
    loading,
    sendMessage,
    accept,
    decline,
    block,
    markAsRead,
    report,
    refreshConversations,
  };
};

export default useMessaging;
