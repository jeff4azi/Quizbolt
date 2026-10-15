import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiMessageSquare,
  FiChevronRight,
  FiRotateCcw,
  FiUserPlus,
  FiSearch,
} from "react-icons/fi";
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import Avatar from "../components/Avatar";
import { useMessaging } from "../hooks/useMessaging";
import useDocumentTitle from "../hooks/useDocumentTitle";

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMinutes = Math.floor((now - d) / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

const ConversationList = () => {
  useDocumentTitle("Messages | QuizBolt");
  const navigate = useNavigate();
  const { conversations, simulateIncomingRequest, resetDemo } = useMessaging();
  const [search, setSearch] = useState("");
  const [showDevControls, setShowDevControls] = useState(false);

  // Categorize conversations
  const requests = conversations.filter(
    (c) => c.connectionState === "request_received"
  );
  const activeChats = conversations.filter(
    (c) => c.connectionState !== "request_received"
  );

  const filterChats = (list) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q)
    );
  };

  const filteredRequests = filterChats(requests);
  const filteredActive = filterChats(activeChats);

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500 pb-24">
      {/* QuizBolt Site Standard Header with Back Button */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                window.history.length > 1 ? navigate(-1) : navigate("/")
              }
              className="size-10 sm:size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
              aria-label="Go back"
            >
              <FiArrowLeft size={19} />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Messages
              </h1>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                Demo conversations
              </p>
            </div>
          </div>

          {/* Dev Demo Controls Toggle */}
          <button
            type="button"
            onClick={() => setShowDevControls((p) => !p)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            🛠️ {showDevControls ? "Hide Demo" : "Demo"}
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 space-y-5">

        {/* Dev Controls Bar */}
        {showDevControls && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                Demo Testing Simulator
              </span>
              <button
                type="button"
                onClick={resetDemo}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
              >
                <FiRotateCcw size={12} />
                <span>Reset mock data</span>
              </button>
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
              Trigger demo scenarios instantly to test requests, locked composers, and accepted chats:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  simulateIncomingRequest(
                    {
                      username: "kemi_o",
                      fullName: "Kemi Olufemi",
                      university: "OAU",
                      department: "Law",
                      year: 3,
                    },
                    "Hey! Saw your streak on the leaderboard, would you like to review past questions together?"
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 text-[11px] font-bold border border-amber-200 shadow-sm active:scale-95"
              >
                <FiUserPlus size={12} />
                <span>Simulate new incoming request</span>
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <FiSearch
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        {/* ── 1. REQUESTS SECTION (Top) ────────────────────────────────────── */}
        {filteredRequests.length > 0 && (
          <section aria-labelledby="requests-title" className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2
                id="requests-title"
                className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 flex items-center gap-2"
              >
                <span>Message Requests</span>
                <span className="size-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                  {filteredRequests.length}
                </span>
              </h2>
            </div>

            <div className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700/40 overflow-hidden shadow-sm">
              {filteredRequests.map((conv) => {
                const msgs = Array.isArray(conv.messages) ? conv.messages : [];
                const lastMsg = msgs[msgs.length - 1];
                return (
                  <div
                    key={conv.username}
                    onClick={() => navigate(`/messages/${conv.username}`)}
                    className="px-4 py-3.5 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors cursor-pointer flex items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar avatarUrl={conv.avatarUrl} size="md" />
                        {conv.isPremium && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900 shadow-xs">
                            <FaCrown className="text-white text-[8px]" />
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-800" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {conv.fullName}
                          </p>
                          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 shrink-0">
                            {formatTimeAgo(conv.lastActivity)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                            {lastMsg?.text || "Sent you a message request"}
                          </p>
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-0.5">
                            Review <FiChevronRight size={13} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 2. CONVERSATIONS LIST ────────────────────────────────────────── */}
        <section aria-labelledby="all-chats-title" className="space-y-2.5">
          <h2
            id="all-chats-title"
            className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 px-1"
          >
            Conversations
          </h2>

          {filteredActive.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200/70 dark:border-slate-800/60 p-6 shadow-sm">
              <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <FiMessageSquare size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No conversations yet
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-400 max-w-xs mx-auto mt-1">
                Tap on any scholar on the Leaderboard and click "Connect" to chat.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700/40 overflow-hidden shadow-sm">
              {filteredActive.map((conv) => {
                const msgs = Array.isArray(conv.messages) ? conv.messages : [];
                const lastMsg = msgs[msgs.length - 1];
                const isMe = lastMsg?.sender === "me";
                const hasUnread = Boolean(
                  conv.unread &&
                    (conv.unreadCount > 0 ||
                      conv.connectionState === "request_received")
                );

                return (
                  <div
                    key={conv.username}
                    onClick={() => navigate(`/messages/${conv.username}`)}
                    className="px-4 py-3.5 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors cursor-pointer flex items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar avatarUrl={conv.avatarUrl} size="md" />
                        {conv.isPremium && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900 shadow-xs">
                            <FaCrown className="text-white text-[8px]" />
                          </div>
                        )}
                        {hasUnread && (
                          <span className="absolute -bottom-0.5 -right-0.5 size-3 bg-blue-600 rounded-full ring-2 ring-white dark:ring-slate-800 animate-pulse" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-sm truncate ${
                              hasUnread
                                ? "font-black text-slate-900 dark:text-white"
                                : "font-bold text-slate-800 dark:text-slate-100"
                            }`}
                          >
                            {conv.fullName}
                          </p>
                          <span
                            className={`text-[11px] shrink-0 ${
                              hasUnread
                                ? "font-bold text-blue-600 dark:text-blue-400"
                                : "font-semibold text-slate-400 dark:text-slate-400"
                            }`}
                          >
                            {formatTimeAgo(conv.lastActivity)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {isMe && lastMsg && (
                              <span className="shrink-0 text-slate-400 dark:text-slate-400 inline-flex items-center">
                                {lastMsg.status === "sent" ? (
                                  <IoCheckmark size={14} className="opacity-70" />
                                ) : (
                                  <IoCheckmarkDone
                                    size={15}
                                    className="text-sky-500"
                                  />
                                )}
                              </span>
                            )}
                            <p
                              className={`text-xs truncate ${
                                hasUnread
                                  ? "font-bold text-slate-900 dark:text-white"
                                  : "font-medium text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {lastMsg
                                ? isMe
                                  ? `You: ${lastMsg.text}`
                                  : lastMsg.text
                                : "Start a conversation"}
                            </p>
                          </div>

                          {hasUnread && (
                            <span className="size-5 shrink-0 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                              {conv.unreadCount || 1}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ConversationList;
