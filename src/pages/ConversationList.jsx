import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiMessageSquare,
  FiChevronRight,
  FiSearch,
  FiX,
  FiClock,
  FiCheck,
  FiSend,
} from "react-icons/fi";
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import Avatar from "../components/Avatar";
import { useMessaging } from "../hooks/useMessaging";
import { usePresence } from "../hooks/usePresence";
import useDocumentTitle from "../hooks/useDocumentTitle";
import {
  searchUsers,
  formatQuizResultPreview,
  isQuizResultPayload,
  isDeletedMessage,
} from "../services/messagingService";

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
  const { conversations, loading, currentUserId } = useMessaging();
  const [search, setSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced real-time user search across all platform profiles
  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setUserSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsers(term, currentUserId);
        setUserSearchResults(results);
      } catch (err) {
        console.error("Error searching scholars:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search, currentUserId]);

  // Combined presence tracking: conversations + all searched scholars in real time!
  const watchUserIds = useMemo(() => {
    const set = new Set(conversations.map((c) => c.userId).filter(Boolean));
    userSearchResults.forEach((u) => {
      if (u.id) set.add(u.id);
    });
    return Array.from(set);
  }, [conversations, userSearchResults]);

  const { isOnline } = usePresence(watchUserIds);

  // Categorize conversations
  const requests = conversations.filter(
    (c) => c.connectionState === "request_received",
  );
  const activeChats = conversations.filter(
    (c) => c.connectionState !== "request_received",
  );

  const filterChats = (list) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q),
    );
  };

  const filteredRequests = filterChats(requests);
  const filteredActive = filterChats(activeChats);
  const isSearchActive = search.trim().length > 0;

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
              className="lg:hidden size-10 sm:size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
              aria-label="Go back"
            >
              <FiArrowLeft size={19} />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                Messages
              </h1>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                Direct messages & connections
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Search Bar */}
        <div className="relative">
          <FiSearch
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            size={16}
          />
          <input
            type="text"
            placeholder="Search scholars by @username or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-10 rounded-2xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
          {searchLoading ? (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : search.length > 0 ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 size-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              <FiX size={14} />
            </button>
          ) : null}
        </div>

        {/* ── SEARCH MODE: SCHOLARS ON QUIZBOLT ────────────────────────────── */}
        {isSearchActive && (
          <section
            aria-labelledby="scholars-search-title"
            className="space-y-2.5"
          >
            <div className="flex items-center justify-between px-1">
              <h2
                id="scholars-search-title"
                className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 flex items-center gap-2"
              >
                <span>Scholars</span>
                {!searchLoading && userSearchResults.length > 0 && (
                  <span className="size-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                    {userSearchResults.length}
                  </span>
                )}
              </h2>
            </div>

            {searchLoading ? (
              <div className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700/40 overflow-hidden shadow-sm">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-3.5 animate-pulse"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="size-14 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-36 bg-slate-200 dark:bg-slate-700 rounded-md" />
                        <div className="h-3 w-24 bg-slate-200/60 dark:bg-slate-700/60 rounded-md" />
                      </div>
                    </div>
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0" />
                  </div>
                ))}
              </div>
            ) : userSearchResults.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200/70 dark:border-slate-800/60 p-6 shadow-sm">
                <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <FiSearch size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No scholars found
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 max-w-xs mx-auto mt-1">
                  Couldn&apos;t find anyone matching &ldquo;{search}&rdquo;. Try
                  searching with their username or full name.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700/40 overflow-hidden shadow-sm">
                {userSearchResults.map((user) => {
                  const online = isOnline(user.id);
                  const existingConv = conversations.find(
                    (c) =>
                      c.userId === user.id ||
                      c.username?.toLowerCase() ===
                        user.user_name?.toLowerCase(),
                  );

                  return (
                    <div
                      key={user.id}
                      onClick={() =>
                        navigate(`/u/${user.user_name || user.id}`)
                      }
                      className="px-4 py-3.5 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors cursor-pointer flex items-center justify-between gap-3.5"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <Avatar
                            avatarUrl={user.avatar_url}
                            size="md"
                            isOnline={online}
                          />
                          {user.is_premium && (
                            <div
                              className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900 shadow-xs"
                              title="Premium Scholar"
                            >
                              <FaCrown className="text-white text-[8px]" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                              {user.full_name || user.user_name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              @{user.user_name || "user"}
                            </span>
                            {user.department && (
                              <>
                                <span>•</span>
                                <span className="truncate">
                                  {user.department}
                                </span>
                              </>
                            )}
                          </div>
                          {user.university && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                              {user.university}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status / Message Action */}
                      <div className="shrink-0">
                        {(() => {
                          const state = existingConv?.connectionState;
                          const goChat = (e) => {
                            e.stopPropagation();
                            navigate(`/messages/${user.user_name || user.id}`);
                          };

                          if (state === "accepted") {
                            return (
                              <button
                                type="button"
                                onClick={goChat}
                                aria-label={`Open chat with ${user.full_name || user.user_name}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-95 transition-transform"
                              >
                                <FiCheck size={12} />
                                <span>Chat</span>
                              </button>
                            );
                          }
                          if (state === "request_sent") {
                            return (
                              <button
                                type="button"
                                onClick={goChat}
                                aria-label={`Connection request to ${user.full_name || user.user_name} is pending`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition-transform"
                              >
                                <FiClock size={12} />
                                <span>Pending</span>
                              </button>
                            );
                          }
                          if (state === "request_received") {
                            return (
                              <button
                                type="button"
                                onClick={goChat}
                                aria-label={`Review connection request from ${user.full_name || user.user_name}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-transform"
                              >
                                <span>Review</span>
                              </button>
                            );
                          }
                          // connectionState === "none" (not connected yet)
                          return (
                            <button
                              type="button"
                              onClick={goChat}
                              aria-label={`Send a message to ${user.full_name || user.user_name}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-transform"
                            >
                              <FiSend size={11} />
                              <span>Message</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── 1. REQUESTS SECTION (When not searching or when search matches) ────────────────── */}
        {!isSearchActive && filteredRequests.length > 0 && (
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
                const online = isOnline(conv.userId);

                return (
                  <div
                    key={conv.username}
                    onClick={() => navigate(`/messages/${conv.username}`)}
                    className="px-4 py-3.5 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors cursor-pointer flex items-center justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <Avatar
                          avatarUrl={conv.avatarUrl}
                          size="md"
                          isOnline={online}
                        />
                        {conv.isPremium && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900 shadow-xs">
                            <FaCrown className="text-white text-[8px]" />
                          </div>
                        )}
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
                            {lastMsg
                              ? formatQuizResultPreview(lastMsg.text)
                              : "Sent you a message request"}
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
        {(!isSearchActive || filteredActive.length > 0) && (
          <section aria-labelledby="all-chats-title" className="space-y-2.5">
            <h2
              id="all-chats-title"
              className="text-xs font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 px-1"
            >
              {isSearchActive ? "Existing Conversations" : "Conversations"}
            </h2>

            {loading ? (
              <div className="py-12 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200/70 dark:border-slate-800/60 p-6 shadow-sm">
                <div className="size-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-400">
                  Loading your conversations...
                </p>
              </div>
            ) : filteredActive.length === 0 ? (
              <div className="py-12 text-center bg-white dark:bg-slate-800/40 rounded-3xl border border-slate-200/70 dark:border-slate-800/60 p-6 shadow-sm">
                <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <FiMessageSquare size={20} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No conversations yet
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-400 max-w-xs mx-auto mt-1">
                  Search any scholar by username above to send a message
                  request!
                </p>
              </div>
            ) : (
              <div className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-700/40 overflow-hidden shadow-sm">
                {filteredActive.map((conv) => {
                  const msgs = Array.isArray(conv.messages)
                    ? conv.messages
                    : [];
                  const lastMsg = msgs[msgs.length - 1];
                  const isMe = lastMsg?.sender === "me";
                  const hasUnread = Boolean(
                    conv.unread &&
                    (conv.unreadCount > 0 ||
                      conv.connectionState === "request_received"),
                  );
                  const online = isOnline(conv.userId);

                  return (
                    <div
                      key={conv.username}
                      onClick={() => navigate(`/messages/${conv.username}`)}
                      className="px-4 py-3.5 sm:px-5 hover:bg-slate-50 dark:hover:bg-slate-700/30 active:bg-slate-100 dark:active:bg-slate-700/50 transition-colors cursor-pointer flex items-center justify-between gap-3.5"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="relative shrink-0">
                          <Avatar
                            avatarUrl={conv.avatarUrl}
                            size="md"
                            isOnline={online}
                          />
                          {conv.isPremium && (
                            <div className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border border-white dark:border-slate-900 shadow-xs">
                              <FaCrown className="text-white text-[8px]" />
                            </div>
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
                                    <IoCheckmark
                                      size={14}
                                      className="opacity-70"
                                    />
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
                                  ? isDeletedMessage(lastMsg.text)
                                    ? isMe
                                      ? "You unsent a message"
                                      : "This message was deleted"
                                    : isQuizResultPayload(lastMsg.text)
                                    ? formatQuizResultPreview(lastMsg.text, isMe)
                                    : isMe
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
        )}
      </div>
    </div>
  );
};

export default ConversationList;
