import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMessageSquare,
  FiClock,
  FiCheck,
  FiChevronRight,
  FiRotateCcw,
  FiUserPlus,
  FiSearch,
} from "react-icons/fi";
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
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Messages
            </h1>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-400">
              Demo conversations and connection requests
            </p>
          </div>

          {/* Dev Demo Controls Toggle */}
          <button
            type="button"
            onClick={() => setShowDevControls((p) => !p)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40 hover:bg-blue-100 transition-colors"
          >
            🛠️ {showDevControls ? "Hide Demo Controls" : "Demo Controls"}
          </button>
        </div>

        {/* Dev Controls Bar */}
        {showDevControls && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 space-y-2.5 animate-in fade-in duration-150">
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
          <section aria-labelledby="requests-title" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2
                  id="requests-title"
                  className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400"
                >
                  Message Requests
                </h2>
                <span className="size-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                  {filteredRequests.length}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {filteredRequests.map((conv) => {
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <div
                    key={conv.username}
                    onClick={() => navigate(`/messages/${conv.username}`)}
                    className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 to-indigo-50/40 dark:from-blue-950/20 dark:to-indigo-950/10 border border-blue-200/60 dark:border-blue-900/30 hover:border-blue-300 transition-all cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar avatarUrl={conv.avatarUrl} size="md" />
                        {conv.isPremium && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900">
                            <FaCrown className="text-white text-[8px]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {conv.fullName}
                          </p>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider shrink-0">
                            Request
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate mt-0.5">
                          {lastMsg?.text || "Sent you a message request"}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                          {conv.university} · {conv.department}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-xs">
                      <span>Review</span>
                      <FiChevronRight size={14} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 2. CONVERSATIONS LIST ────────────────────────────────────────── */}
        <section aria-labelledby="all-chats-title" className="space-y-3">
          <h2
            id="all-chats-title"
            className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 px-1"
          >
            Conversations
          </h2>

          {filteredActive.length === 0 ? (
            <div className="py-12 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800/60 p-6">
              <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <FiMessageSquare size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No conversations yet
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-400 max-w-xs mx-auto mt-1">
                Tap on any scholar on the Leaderboard and click "Message" to connect.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredActive.map((conv) => {
                const lastMsg = conv.messages[conv.messages.length - 1];
                const isSentRequest = conv.connectionState === "request_sent";
                const isAccepted = conv.connectionState === "accepted";

                return (
                  <div
                    key={conv.username}
                    onClick={() => navigate(`/messages/${conv.username}`)}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 hover:border-slate-200 dark:hover:border-slate-600 transition-all cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar avatarUrl={conv.avatarUrl} size="md" />
                        {conv.isPremium && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900">
                            <FaCrown className="text-white text-[8px]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                            {conv.fullName}
                          </p>
                          {isSentRequest && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/50 text-[10px] font-bold shrink-0">
                              <FiClock size={10} />
                              Pending
                            </span>
                          )}
                          {isAccepted && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 text-[10px] font-bold shrink-0">
                              <FiCheck size={10} />
                              Connected
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {lastMsg ? (
                            <>
                              {lastMsg.sender === "me" ? "You: " : ""}
                              {lastMsg.text}
                            </>
                          ) : (
                            "Start a conversation"
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-semibold text-slate-400">
                        {formatTimeAgo(conv.lastActivity)}
                      </p>
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
