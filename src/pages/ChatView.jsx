import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiSend,
  FiClock,
  FiUserCheck,
  FiMessageCircle,
  FiCheck,
  FiMoreVertical,
  FiSlash,
  FiFlag,
  FiUser,
} from "react-icons/fi";
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import Avatar from "../components/Avatar";
import { useMessaging } from "../hooks/useMessaging";
import { usePresence } from "../hooks/usePresence";
import ReportModal from "../components/ReportModal";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { supabase } from "../supabaseClient";
import { fetchProfileByUsernameOrId } from "../services/messagingService";

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
};

const getDateSeparatorLabel = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();

  const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "long" });
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const getMessageDateKey = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const ChatView = () => {
  const { username } = useParams();
  const navigate = useNavigate();

  const {
    currentConv,
    connectionState,
    sendMessage,
    accept,
    decline,
    block,
    markAsRead,
    report,
  } = useMessaging(username);

  // Mark conversation as read whenever this view is active
  useEffect(() => {
    if (username && markAsRead) {
      markAsRead();
    }
  }, [username, markAsRead, currentConv?.messages?.length]);

  const [input, setInput] = useState("");
  const [profileInfo, setProfileInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const menuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const displayName =
    currentConv?.fullName || profileInfo?.full_name || username || "Scholar";
  const avatarUrl = currentConv?.avatarUrl || profileInfo?.avatar_url || null;
  const isPremium =
    currentConv?.isPremium ?? profileInfo?.is_premium ?? false;
  const partnerUserId = currentConv?.userId || profileInfo?.id || null;

  // Real presence status
  const { isOnline } = usePresence(partnerUserId ? [partnerUserId] : []);
  const userIsOnline = partnerUserId ? isOnline(partnerUserId) : false;

  useDocumentTitle(`Chat with ${displayName} | QuizBolt`);

  // Fetch basic profile info
  useEffect(() => {
    if (!username) return;

    fetchProfileByUsernameOrId(username).then((data) => {
      if (data) setProfileInfo(data);
    });
  }, [username]);

  // Click outside listener for kebab menu
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [menuOpen]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConv?.messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isSending) return;

    const textToSend = input.trim();
    setInput("");
    setIsSending(true);

    try {
      await sendMessage(textToSend);
    } catch (err) {
      console.error("Message send error:", err);
      // Restore input on failure
      setInput(textToSend);
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBlockUser = async () => {
    if (window.confirm(`Are you sure you want to block @${username}?`)) {
      setMenuOpen(false);
      await block();
    }
  };

  const messages = currentConv?.messages || [];
  const isComposerDisabled =
    connectionState === "request_sent" ||
    connectionState === "declined" ||
    connectionState === "blocked";

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-4xl mx-auto bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 lg:border-x border-slate-200/70 dark:border-slate-800/60 overflow-hidden">
      {/* ── TOP NAV / CHAT HEADER ────────────────────────────────────────── */}
      <header className="shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/messages")
            }
            aria-label="Back to conversations"
            className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition-transform shrink-0"
          >
            <FiArrowLeft size={20} />
          </button>

          <Link
            to={`/u/${username}`}
            className="flex items-center gap-3 min-w-0 group"
          >
            <div className="relative shrink-0">
              <Avatar
                avatarUrl={avatarUrl}
                size="sm"
                isOnline={userIsOnline}
                className="rounded-full ring-2 ring-slate-100 dark:ring-slate-800 group-hover:opacity-90 transition-opacity"
              />
              {isPremium && (
                <div
                  className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-full border-2 border-white dark:border-slate-900 shadow-sm z-10"
                  title="Premium Scholar"
                >
                  <FaCrown className="text-white text-[8px]" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h1 className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {displayName}
                </h1>
                {isPremium && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-[10px] font-black text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0"
                    title="Premium Scholar"
                  >
                    <FaCrown className="text-[9px]" />
                    PRO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-400">
                <span>@{username}</span>
                <span>•</span>
                {userIsOnline ? (
                  <span className="text-emerald-500 font-bold flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    Online
                  </span>
                ) : connectionState === "accepted" ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    <FiCheck size={10} />
                    Connected
                  </span>
                ) : connectionState === "request_sent" ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                    <FiClock size={10} />
                    Request pending
                  </span>
                ) : connectionState === "request_received" ? (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    Message request
                  </span>
                ) : connectionState === "blocked" ? (
                  <span className="text-rose-500 font-semibold">Blocked</span>
                ) : (
                  <span>Offline</span>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Header Actions: Profile link & Kebab menu */}
        <div className="flex items-center gap-1.5 shrink-0" ref={menuRef}>
          <Link
            to={`/u/${username}`}
            className="hidden sm:inline-flex text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Profile
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((p) => !p)}
              aria-label="More chat options"
              className="size-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-750 transition"
            >
              <FiMoreVertical size={18} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                <Link
                  to={`/u/${username}`}
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition"
                >
                  <FiUser className="size-4 text-slate-400" />
                  <span>View Profile</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setReportModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-left"
                >
                  <FiFlag className="size-4 shrink-0" />
                  <span>Report @{username}</span>
                </button>

                {connectionState !== "blocked" && (
                  <button
                    type="button"
                    onClick={handleBlockUser}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition text-left"
                  >
                    <FiSlash className="size-4 text-slate-400 shrink-0" />
                    <span>Block User</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MESSAGES FEED ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
            <div className="size-16 rounded-3xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
              <FiMessageCircle size={30} />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Connect with {displayName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
              You can send 1 message to initiate a connection request. Once {displayName}{" "}
              accepts, full chatting will unlock for both of you.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender === "me";
            const currentDateKey = getMessageDateKey(msg.timestamp);
            const prevDateKey =
              index > 0 ? getMessageDateKey(messages[index - 1].timestamp) : null;
            const showDateSeparator = currentDateKey !== prevDateKey;
            const dateLabel = showDateSeparator
              ? getDateSeparatorLabel(msg.timestamp)
              : null;

            return (
              <React.Fragment key={msg.id || index}>
                {showDateSeparator && dateLabel && (
                  <div className="flex items-center justify-center my-3 select-none">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-xs border border-slate-300/40 dark:border-slate-700/60">
                      {dateLabel}
                    </span>
                  </div>
                )}

                <div
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`relative max-w-[85%] sm:max-w-md px-3.5 pt-2.5 pb-2 rounded-2xl text-xs sm:text-sm shadow-sm leading-relaxed ${
                      isMe
                        ? "bg-blue-600 text-white rounded-tr-xs shadow-sm dark:shadow-none"
                        : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-xs border border-slate-200/70 dark:border-slate-700/60"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words inline font-medium">
                      {msg.text}
                    </p>

                    {/* Inline timestamp & status ticks inside bubble */}
                    <span
                      className={`inline-flex items-center gap-1 float-right mt-1 ml-3 select-none text-[10px] font-medium leading-none ${
                        isMe
                          ? "text-blue-100/80"
                          : "text-slate-400 dark:text-slate-400"
                      }`}
                    >
                      <span>{formatMessageTime(msg.timestamp)}</span>
                      {isMe && (
                        <span className="inline-flex items-center shrink-0">
                          {msg.status === "sent" ? (
                            <IoCheckmark
                              size={14}
                              className="text-blue-200"
                              title="Sent"
                            />
                          ) : (
                            <IoCheckmarkDone
                              size={15}
                              className="text-sky-200"
                              title="Delivered / Read"
                            />
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── REQUEST RECEIVED BANNER (Accept / Decline) ────────────────────── */}
      {connectionState === "request_received" && (
        <div className="shrink-0 bg-blue-50 dark:bg-blue-900/30 border-t border-blue-200/80 dark:border-blue-900/40 p-4 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-2xl mx-auto">
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                {displayName} wants to connect with you
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Accepting allows both of you to chat freely. Replying also accepts.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={decline}
                className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 transition-colors"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={accept}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm dark:shadow-none transition-transform active:scale-95"
              >
                <FiUserCheck size={14} />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMPOSER LOCKED NOTE (request_sent) ───────────────────────────── */}
      {connectionState === "request_sent" && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200/60 dark:border-amber-800/40 px-4 py-3 text-center">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            You can send more messages once {displayName} accepts your request.
          </p>
        </div>
      )}

      {/* ── BLOCKED NOTE ─────────────────────────────────────────────────── */}
      {connectionState === "blocked" && (
        <div className="shrink-0 bg-rose-50 dark:bg-rose-950/20 border-t border-rose-200/60 dark:border-rose-900/40 px-4 py-3 text-center">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
            Messaging is unavailable because this user is blocked.
          </p>
        </div>
      )}

      {/* ── COMPOSER FOOTER ──────────────────────────────────────────────── */}
      <footer className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80 p-3 sm:p-4">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 max-w-3xl mx-auto"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isComposerDisabled || isSending}
            placeholder={
              isComposerDisabled
                ? "Composer locked pending accept..."
                : connectionState === "none"
                  ? "Send your one message request to connect..."
                  : "Type a message..."
            }
            className="flex-1 h-11 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={isComposerDisabled || !input.trim() || isSending}
            aria-label="Send message"
            className="size-11 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 flex items-center justify-center transition-all shadow-sm dark:shadow-none active:scale-95"
          >
            <FiSend size={15} />
          </button>
        </form>
      </footer>

      {/* ── REPORT MODAL ─────────────────────────────────────────────────── */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        username={username}
        displayName={displayName}
        onSubmitReport={report}
      />
    </div>
  );
};

export default ChatView;
