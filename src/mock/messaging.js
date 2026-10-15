// Mock messaging layer for Quiz Bolt demo
// Manages local state and mock conversations store without backend/realtime calls.

const STORAGE_KEY = "quizbolt_mock_conversations_v1";

const SEED_CONVERSATIONS = [
  {
    username: "tundeb",
    userId: "mock-user-1",
    fullName: "Tunde Bakare",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    university: "TASUED",
    department: "Computer Science",
    year: 3,
    isPremium: true,
    connectionState: "request_received",
    unread: true,
    lastActivity: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg-seed-1",
        sender: "them",
        text: "Hey! Saw your score on the leaderboard, do you have any tips for CSC 301?",
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    username: "aminay",
    userId: "mock-user-2",
    fullName: "Amina Yusuf",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    university: "UNILAG",
    department: "Economics",
    year: 4,
    isPremium: true,
    connectionState: "accepted",
    unread: false,
    lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg-seed-2",
        sender: "them",
        text: "Are you prepping for the mock exam this weekend?",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-seed-3",
        sender: "me",
        text: "Yes, currently revising past questions on Quiz Bolt!",
        timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "msg-seed-4",
        sender: "them",
        text: "Awesome! Let's compare scores later tonight.",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    username: "chidio",
    userId: "mock-user-3",
    fullName: "Chidi Okafor",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
    university: "OAU",
    department: "Civil Engineering",
    year: 2,
    isPremium: false,
    connectionState: "request_sent",
    unread: false,
    lastActivity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    messages: [
      {
        id: "msg-seed-5",
        sender: "me",
        text: "Hey Chidi, great run on the leaderboard! How did you tackle the speed round?",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

const listeners = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("Error in messaging listener:", e);
    }
  });
};

export const loadStoredConversations = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CONVERSATIONS));
      return [...SEED_CONVERSATIONS];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load mock messaging store:", err);
  }
  return [...SEED_CONVERSATIONS];
};

export const saveStoredConversations = (conversations) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    notifyListeners();
  } catch (err) {
    console.error("Failed to save mock messaging store:", err);
  }
};

export const subscribeToMessaging = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getConversations = () => {
  return loadStoredConversations();
};

export const getConversationByUsername = (username) => {
  if (!username) return null;
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  return list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  ) || null;
};

export const getConnectionState = (username) => {
  if (!username) return "none";
  const conv = getConversationByUsername(username);
  return conv ? conv.connectionState : "none";
};

export const createOrGetConversation = (user) => {
  if (!user) return null;
  const username = user.user_name || user.username || user.id || "anonymous";
  let conv = getConversationByUsername(username);
  if (!conv) {
    conv = {
      username,
      userId: user.id || username,
      fullName: user.full_name || user.fullName || "Scholar",
      avatarUrl: user.avatar_url || user.avatarUrl || null,
      university: user.university || "University",
      department: user.department || "General Studies",
      year: user.year || 1,
      isPremium: user.is_premium === true || user.isPremium === true,
      connectionState: "none",
      unread: false,
      lastActivity: new Date().toISOString(),
      messages: [],
    };
    const list = loadStoredConversations();
    list.unshift(conv);
    saveStoredConversations(list);
  }
  return conv;
};

/**
 * Sends a message from the viewer to the specified user.
 * - If connectionState is "none", requester sends their 1 message and transitions to "request_sent".
 * - If connectionState is "request_received", sending a reply automatically accepts the request!
 * - If connectionState is "accepted", regular message sent.
 */
export const sendMessage = (targetUser, text) => {
  if (!targetUser || !text?.trim()) return null;
  const username =
    typeof targetUser === "string"
      ? targetUser
      : targetUser.user_name || targetUser.username || targetUser.id;

  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  let conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );

  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: "me",
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };

  if (!conv) {
    conv = {
      username,
      userId: typeof targetUser === "object" ? targetUser.id : username,
      fullName:
        typeof targetUser === "object"
          ? targetUser.full_name || targetUser.fullName || "Scholar"
          : "Scholar",
      avatarUrl:
        typeof targetUser === "object"
          ? targetUser.avatar_url || targetUser.avatarUrl
          : null,
      university:
        typeof targetUser === "object"
          ? targetUser.university || "University"
          : "University",
      department:
        typeof targetUser === "object"
          ? targetUser.department || "General Studies"
          : "General Studies",
      year: typeof targetUser === "object" ? targetUser.year || 1 : 1,
      isPremium:
        typeof targetUser === "object"
          ? targetUser.is_premium === true || targetUser.isPremium === true
          : false,
      connectionState: "request_sent",
      unread: false,
      lastActivity: newMsg.timestamp,
      messages: [newMsg],
    };
    list.unshift(conv);
  } else {
    // If request_received, sending a reply counts as accepting!
    if (conv.connectionState === "request_received") {
      conv.connectionState = "accepted";
    } else if (conv.connectionState === "none") {
      conv.connectionState = "request_sent";
    }
    conv.messages.push(newMsg);
    conv.lastActivity = newMsg.timestamp;
    conv.unread = false;
  }

  saveStoredConversations(list);
  return conv;
};

export const acceptRequest = (username) => {
  if (!username) return;
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  const conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );
  if (conv) {
    conv.connectionState = "accepted";
    conv.unread = false;
    saveStoredConversations(list);
  }
};

export const declineRequest = (username) => {
  if (!username) return;
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  const conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );
  if (conv) {
    conv.connectionState = "declined";
    saveStoredConversations(list);
  }
};

export const blockUser = (username) => {
  if (!username) return;
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  let conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );
  if (conv) {
    conv.connectionState = "blocked";
  } else {
    conv = {
      username,
      userId: username,
      fullName: username,
      connectionState: "blocked",
      messages: [],
      lastActivity: new Date().toISOString(),
    };
    list.push(conv);
  }
  saveStoredConversations(list);
};

// ── DEV SIMULATION HELPERS ───────────────────────────────────────────────────

export const simulateIncomingRequest = (userData, messageText) => {
  const username = userData?.user_name || userData?.username || "newscholar";
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  let conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );

  const msg = {
    id: `sim-${Date.now()}`,
    sender: "them",
    text: messageText || "Hey! Would love to study together for Quiz Bolt.",
    timestamp: new Date().toISOString(),
  };

  if (!conv) {
    conv = {
      username,
      userId: userData?.id || `mock-${Date.now()}`,
      fullName: userData?.full_name || userData?.fullName || "Scholar Friend",
      avatarUrl: userData?.avatar_url || userData?.avatarUrl || null,
      university: userData?.university || "TASUED",
      department: userData?.department || "Education",
      year: userData?.year || 2,
      isPremium: false,
      connectionState: "request_received",
      unread: true,
      lastActivity: msg.timestamp,
      messages: [msg],
    };
    list.unshift(conv);
  } else {
    conv.connectionState = "request_received";
    conv.messages.push(msg);
    conv.lastActivity = msg.timestamp;
    conv.unread = true;
  }

  saveStoredConversations(list);
  return conv;
};

export const simulateReply = (username, replyText) => {
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  const conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );
  if (!conv) return null;

  // Replying implies accepted if it was request_sent
  if (conv.connectionState === "request_sent") {
    conv.connectionState = "accepted";
  }

  conv.messages.push({
    id: `reply-${Date.now()}`,
    sender: "them",
    text:
      replyText ||
      "Thanks for reaching out! Happy to connect and share notes.",
    timestamp: new Date().toISOString(),
  });
  conv.lastActivity = new Date().toISOString();
  saveStoredConversations(list);
  return conv;
};

export const simulateAccept = (username) => {
  const list = loadStoredConversations();
  const lower = username.toLowerCase();
  const conv = list.find(
    (c) =>
      c.username?.toLowerCase() === lower ||
      c.userId?.toLowerCase() === lower
  );
  if (!conv) return null;
  conv.connectionState = "accepted";
  saveStoredConversations(list);
  return conv;
};

export const resetDemoMessaging = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_CONVERSATIONS));
  notifyListeners();
};

// Expose on window for easy developer console simulation
if (typeof window !== "undefined") {
  window.quizboltMessaging = {
    getConversations,
    getConversationByUsername,
    getConnectionState,
    sendMessage,
    acceptRequest,
    declineRequest,
    blockUser,
    simulateIncomingRequest,
    simulateReply,
    simulateAccept,
    resetDemoMessaging,
  };
}
