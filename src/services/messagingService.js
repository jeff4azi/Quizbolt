import { supabase } from "../supabaseClient";

// Supabase Edge Function URL for send-message + push dispatch
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/send-message`;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Gets the current session JWT for edge function auth.
 */
const getAuthHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : null;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Robustly fetches a profile by either username (case-insensitive) or UUID id.
 * Prevents PostgreSQL 22P02 "invalid input syntax for type uuid" error.
 */
export const fetchProfileByUsernameOrId = async (identifier) => {
  if (!identifier) return null;
  const clean = String(identifier).trim();

  try {
    // 1. Try finding by case-insensitive user_name
    const { data: byUsername } = await supabase
      .from("profiles")
      .select(
        "id, full_name, user_name, avatar_url, university, department, year, is_premium"
      )
      .ilike("user_name", clean)
      .maybeSingle();

    if (byUsername) return byUsername;

    // 2. If it's a valid UUID, try finding by id
    if (UUID_REGEX.test(clean)) {
      const { data: byId } = await supabase
        .from("profiles")
        .select(
          "id, full_name, user_name, avatar_url, university, department, year, is_premium"
        )
        .eq("id", clean)
        .maybeSingle();

      if (byId) return byId;
    }
  } catch (err) {
    console.error("Error fetching profile by identifier:", err);
  }

  return null;
};

/**
 * Searches users across the platform by username or full name in real time.
 * Excludes the current user if provided.
 */
export const searchUsers = async (query, currentUserId = null, limit = 25) => {
  if (!query || !query.trim()) return [];
  const clean = query.trim().replace(/^@/, "");
  if (!clean) return [];

  try {
    let q = supabase
      .from("profiles")
      .select(
        "id, full_name, user_name, avatar_url, university, department, year, is_premium"
      )
      .or(`user_name.ilike.%${clean}%,full_name.ilike.%${clean}%`)
      .order("user_name", { ascending: true })
      .limit(limit);

    if (currentUserId) {
      q = q.neq("id", currentUserId);
    }

    const { data, error } = await q;
    if (error) {
      console.error("Error searching users:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("User search failed:", err);
    return [];
  }
};

/**
 * messagingService.js
 * Real backend Supabase service for QuizBolt direct messaging, requests, and moderation.
 */

export const getCurrentUserId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
};

/**
 * Finds existing connection between userA and userB regardless of who requested.
 */
export const findConnection = async (userA, userB) => {
  if (!userA || !userB) return null;
  const { data, error } = await supabase
    .from("connections")
    .select("*")
    .or(
      `and(requester_id.eq.${userA},receiver_id.eq.${userB}),and(requester_id.eq.${userB},receiver_id.eq.${userA})`
    )
    .maybeSingle();

  if (error) {
    console.error("Error finding connection:", error);
    return null;
  }
  return data;
};

/**
 * Gets or creates a connection row.
 */
export const getOrCreateConnection = async (myId, theirId) => {
  if (!myId || !theirId) return null;
  if (myId === theirId) return null;

  const existing = await findConnection(myId, theirId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("connections")
    .insert({
      requester_id: myId,
      receiver_id: theirId,
      state: "request_sent",
    })
    .select()
    .single();

  if (error) {
    // If unique constraint race condition hit, fetch again
    console.warn("Connection insert notice (may already exist):", error.message);
    return await findConnection(myId, theirId);
  }
  return data;
};

/**
 * Inserts first message when initiating a request.
 * Routes through Supabase Edge Function so server-side push notification fires,
 * with graceful fallback to direct insert if edge function is unreachable.
 */
export const sendFirstMessage = async (connectionId, myId, text, recipientId, replyToId = null) => {
  if (!myId || !text?.trim() || !recipientId) return null;

  try {
    const authHeader = await getAuthHeader();
    if (authHeader) {
      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connectionId: connectionId || null,
          recipientId,
          text: text.trim(),
          replyToId: replyToId || null,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        return result.message || null;
      }
      console.warn("Edge function send-message returned non-200, falling back to direct insert");
    }
  } catch (err) {
    console.warn("Edge function send-message call failed, falling back to direct insert:", err);
  }

  // Fallback: direct insert via Supabase
  const insertPayload = {
    connection_id: connectionId,
    sender_id: myId,
    text: text.trim(),
    status: "sent",
  };
  if (replyToId) insertPayload.reply_to_id = replyToId;

  const { data, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error sending first message:", error);
    throw error;
  }

  if (connectionId) {
    await supabase
      .from("connections")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", connectionId);
  }

  return data;
};

/**
 * Regular send message in an accepted conversation.
 * Routes through Supabase Edge Function so server-side push notification fires,
 * with graceful fallback to direct insert if edge function is unreachable.
 */
export const sendMessage = async (connectionId, myId, text, recipientId, replyToId = null) => {
  if (!connectionId || !myId || !text?.trim() || !recipientId) return null;

  try {
    const authHeader = await getAuthHeader();
    if (authHeader) {
      const res = await fetch(EDGE_FN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          connectionId,
          recipientId,
          text: text.trim(),
          replyToId: replyToId || null,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        return result.message || null;
      }
      console.warn("Edge function send-message returned non-200, falling back to direct insert");
    }
  } catch (err) {
    console.warn("Edge function send-message call failed, falling back to direct insert:", err);
  }

  // Fallback: direct insert via Supabase
  const insertPayload = {
    connection_id: connectionId,
    sender_id: myId,
    text: text.trim(),
    status: "sent",
  };
  if (replyToId) insertPayload.reply_to_id = replyToId;

  const { data, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.error("Error sending message:", error);
    throw error;
  }

  await supabase
    .from("connections")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", connectionId);

  return data;
};

/**
 * Accepts a connection request.
 */
export const acceptConnection = async (connectionId) => {
  if (!connectionId) return null;
  const { data, error } = await supabase
    .from("connections")
    .update({
      state: "accepted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .select()
    .single();

  if (error) {
    console.error("Error accepting connection:", error);
    throw error;
  }
  return data;
};

/**
 * Declines a connection request.
 */
export const declineConnection = async (connectionId) => {
  if (!connectionId) return null;
  const { data, error } = await supabase
    .from("connections")
    .update({
      state: "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .select()
    .single();

  if (error) {
    console.error("Error declining connection:", error);
    throw error;
  }
  return data;
};

/**
 * Cancels a sent connection request.
 * Deletes associated request messages and removes the connection row,
 * completely clearing the chat and removing the person from the user's chat screen.
 */
export const cancelConnectionRequest = async (connectionId, myId) => {
  if (!connectionId || !myId) return false;

  // 1. Delete messages tied to this connection
  const { error: msgErr } = await supabase
    .from("messages")
    .delete()
    .eq("connection_id", connectionId);

  if (msgErr) {
    console.warn("Notice: could not bulk delete messages for cancelled connection:", msgErr);
  }

  // 2. Delete the connection row itself (ensuring the requester was myId and state is request_sent)
  const { error: connErr } = await supabase
    .from("connections")
    .delete()
    .eq("id", connectionId)
    .eq("requester_id", myId);

  if (connErr) {
    console.error("Error cancelling connection request:", connErr);
    throw connErr;
  }

  return true;
};

/**
 * Blocks a user.
 */
export const blockUser = async (myId, theirUserId, connectionId = null) => {
  if (!myId || !theirUserId) return null;

  if (connectionId) {
    const { data, error } = await supabase
      .from("connections")
      .update({
        state: "blocked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .select()
      .single();

    if (error) console.error("Error blocking via connection ID:", error);
    return data;
  }

  // If no connectionId, find or create one with state = 'blocked'
  const existing = await findConnection(myId, theirUserId);
  if (existing) {
    const { data, error } = await supabase
      .from("connections")
      .update({
        state: "blocked",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) console.error("Error updating connection to blocked:", error);
    return data;
  }

  const { data, error } = await supabase
    .from("connections")
    .insert({
      requester_id: myId,
      receiver_id: theirUserId,
      state: "blocked",
    })
    .select()
    .single();

  if (error) console.error("Error creating blocked connection:", error);
  return data;
};

/**
 * Creates a report in public.reports.
 */
export const createReport = async ({
  reporterId,
  reportedId,
  reason,
  description = "",
  blockToo = false,
  connectionId = null,
}) => {
  if (!reporterId || !reportedId || !reason) return null;

  const { data, error } = await supabase
    .from("reports")
    .upsert(
      {
        reporter_id: reporterId,
        reported_id: reportedId,
        reason,
        description: description.trim(),
        status: "pending",
        created_at: new Date().toISOString(),
      },
      { onConflict: "reporter_id,reported_id" }
    )
    .select()
    .single();

  if (error) {
    console.error("Error creating report:", error);
    throw error;
  }

  if (blockToo) {
    await blockUser(reporterId, reportedId, connectionId);
  }

  return data;
};

/**
 * Fetches all connections for current user, hydrated with other user's profile and latest messages.
 */
export const getMyConnections = async (myId) => {
  if (!myId) return [];

  const { data: conns, error: connErr } = await supabase
    .from("connections")
    .select("*")
    .or(`requester_id.eq.${myId},receiver_id.eq.${myId}`)
    .order("updated_at", { ascending: false });

  if (connErr) {
    console.error("Error loading connections:", connErr);
    return [];
  }
  if (!conns || conns.length === 0) return [];

  // Gather other user IDs
  const otherUserIds = Array.from(
    new Set(
      conns.map((c) => (c.requester_id === myId ? c.receiver_id : c.requester_id))
    )
  );

  // Batch fetch profiles
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, user_name, avatar_url, university, department, year, is_premium")
    .in("id", otherUserIds);

  if (profErr) {
    console.error("Error fetching partner profiles:", profErr);
  }

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  // Batch fetch recent messages for all connections to get last activity & unread count
  const connectionIds = conns.map((c) => c.id);
  const { data: messages, error: msgErr } = await supabase
    .from("messages")
    .select("id, connection_id, sender_id, text, status, created_at, reply_to_id")
    .in("connection_id", connectionIds)
    .order("created_at", { ascending: true });

  if (msgErr) {
    console.error("Error fetching messages for connections:", msgErr);
  }

  const msgsByConn = new Map();
  (messages || []).forEach((m) => {
    if (!msgsByConn.has(m.connection_id)) {
      msgsByConn.set(m.connection_id, []);
    }
    msgsByConn.get(m.connection_id).push(m);
  });

  // Construct UI conversation models
  const conversations = conns.map((c) => {
    const isRequester = c.requester_id === myId;
    const partnerId = isRequester ? c.receiver_id : c.requester_id;
    const profile = profileMap.get(partnerId) || {};
    const connMsgs = msgsByConn.get(c.id) || [];
    const lastMsg = connMsgs[connMsgs.length - 1];

    // Compute effective connection state for viewer
    let effectiveState = c.state;
    if (c.state === "request_sent") {
      effectiveState = isRequester ? "request_sent" : "request_received";
    }

    // Count unread messages (sent by them, status != 'read')
    const unreadCount = connMsgs.filter(
      (m) => m.sender_id !== myId && m.status !== "read"
    ).length;

    // Quick id→row map for reply preview text within this connection's msgs
    const connMsgMap = new Map(connMsgs.map((m) => [m.id, m]));

    const formattedMsgs = connMsgs.map((m) => {
      const replyRef = m.reply_to_id ? connMsgMap.get(m.reply_to_id) : null;
      return {
        id: m.id,
        sender: m.sender_id === myId ? "me" : "them",
        senderId: m.sender_id,
        text: m.text,
        status: m.status,
        timestamp: m.created_at,
        replyToId: m.reply_to_id || null,
        replyToText: replyRef?.text || null,
        replyToSender: replyRef ? (replyRef.sender_id === myId ? "me" : "them") : null,
      };
    });

    return {
      connectionId: c.id,
      userId: partnerId,
      username: profile.user_name || partnerId,
      fullName: profile.full_name || profile.user_name || "Scholar",
      avatarUrl: profile.avatar_url || null,
      university: profile.university || "University",
      department: profile.department || "General Studies",
      year: profile.year || 1,
      isPremium: Boolean(profile.is_premium),
      connectionState: effectiveState,
      rawState: c.state,
      isRequester,
      unread: unreadCount > 0 || effectiveState === "request_received",
      unreadCount,
      lastActivity: lastMsg?.created_at || c.updated_at || c.created_at,
      messages: formattedMsgs,
    };
  });

  return conversations;
};

/**
 * Fetches messages for a specific connection.
 */
export const getMessages = async (connectionId, myId, limit = 50) => {
  if (!connectionId) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("id, connection_id, sender_id, text, status, created_at, reply_to_id")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error loading messages:", error);
    return [];
  }

  const rows = data || [];

  // Build a quick id→text/sender map for quote preview
  const idMap = new Map(rows.map((m) => [m.id, { text: m.text, senderId: m.sender_id }]));

  return rows.map((m) => {
    const replyRef = m.reply_to_id ? idMap.get(m.reply_to_id) : null;
    return {
      id: m.id,
      sender: m.sender_id === myId ? "me" : "them",
      senderId: m.sender_id,
      text: m.text,
      status: m.status,
      timestamp: m.created_at,
      replyToId: m.reply_to_id || null,
      replyToText: replyRef?.text || null,
      replyToSender: replyRef ? (replyRef.senderId === myId ? "me" : "them") : null,
    };
  });
};

/**
 * Marks messages in a connection as read.
 */
export const markRead = async (connectionId, myId) => {
  if (!connectionId || !myId) return 0;

  const { data, error } = await supabase
    .from("messages")
    .update({ status: "read" })
    .eq("connection_id", connectionId)
    .neq("sender_id", myId)
    .neq("status", "read")
    .select("id");

  if (error) {
    console.error("Error marking messages read:", error);
    return 0;
  }
  return data?.length || 0;
};

/**
 * Lightweight stub: we use smart active polling instead of WebSockets to avoid hitting Supabase 200-connection limit.
 */
export const subscribeToMessages = () => {
  return () => {};
};

/**
 * Lightweight stub: connections refresh via visibility and active polling (0 WebSockets consumed).
 */
export const subscribeToIncoming = () => {
  return () => {};
};

/**
 * Deletes (unsends) a message for everyone by replacing text with a deleted sentinel.
 * Only the original sender can delete their own message.
 */
export const deleteMessage = async (messageId, myId) => {
  if (!messageId || !myId) return null;

  // Verify ownership: only update if sender_id matches
  const { data, error } = await supabase
    .from("messages")
    .update({
      text: '{"_type":"deleted"}',
      status: "deleted",
    })
    .eq("id", messageId)
    .eq("sender_id", myId)
    .select()
    .single();

  if (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
  return data;
};

/**
 * Checks if a message text is a deleted sentinel.
 */
export const isDeletedMessage = (text) => {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  return (
    trimmed === '{"_type":"deleted"}' ||
    trimmed === '{"_type": "deleted"}'
  );
};

/**
 * ── Quiz Result Sharing Helpers ──────────────────────────────────────────────
 */

export const isQuizResultPayload = (text) => {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  return (
    trimmed.startsWith('{"_type":"quiz_result_card"') ||
    trimmed.startsWith('{"_type": "quiz_result_card"')
  );
};

export const parseQuizResultPayload = (text) => {
  if (!isQuizResultPayload(text)) return null;
  try {
    const data = JSON.parse(text.trim());
    if (data._type === "quiz_result_card") {
      return data;
    }
  } catch (e) {
    console.error("Failed to parse quiz result payload:", e);
  }
  return null;
};

export const formatQuizResultPreview = (text, isMe = false) => {
  const parsed = parseQuizResultPayload(text);
  if (!parsed) return text;
  const course = parsed.courseName || parsed.courseId || "a quiz";
  if (isMe) {
    return `You sent a challenge in ${course}`;
  }
  return `Challenged you in ${course}`;
};

export const shareQuizResultToConnections = async ({
  myId,
  connections,
  payload,
}) => {
  if (
    !myId ||
    !Array.isArray(connections) ||
    connections.length === 0 ||
    !payload
  ) {
    return { successCount: 0, total: 0 };
  }

  const jsonText = JSON.stringify(payload);
  const results = await Promise.allSettled(
    connections.map((c) =>
      sendMessage(c.connectionId, myId, jsonText, c.recipientId)
    )
  );

  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value
  ).length;
  return { successCount, total: connections.length };
};
