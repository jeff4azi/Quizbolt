import React, { useState, useEffect, useRef, useCallback } from "react";
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
  FiCornerUpLeft,
  FiX,
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

/* ─── helpers ─────────────────────────────────────────────────────────────── */

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
  if (diffDays > 1 && diffDays < 7)
    return d.toLocaleDateString([], { weekday: "long" });
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

/** Detect mobile touch devices (avoids false-positive on touchscreen laptops) */
const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  const isTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const isSmallScreen = window.innerWidth <= 768;
  return isTouch && isSmallScreen;
};

/* ─── ReplyQuote (the small tinted box inside a bubble) ───────────────────── */
const ReplyQuote = ({ replyToText, replyToSender, isMe, onClick }) => {
  if (!replyToText) return null;

  const truncated =
    replyToText.length > 80 ? replyToText.slice(0, 80) + "…" : replyToText;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left mb-2 rounded-xl px-3 py-2 border-l-4 transition-opacity hover:opacity-80 ${
        isMe
          ? "bg-blue-700/50 border-blue-200/70"
          : "bg-slate-100 dark:bg-slate-700/60 border-blue-400"
      }`}
    >
      <p
        className={`text-[10px] font-black mb-0.5 ${
          isMe ? "text-blue-100" : "text-blue-500 dark:text-blue-400"
        }`}
      >
        {replyToSender === "me" ? "You" : "Them"}
      </p>
      <p
        className={`text-[11px] leading-snug line-clamp-2 ${
          isMe ? "text-blue-100/90" : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {truncated}
      </p>
    </button>
  );
};

/* ─── ReplyBar (composer preview strip) ──────────────────────────────────── */
const ReplyBar = ({ replyingTo, displayName, onCancel }) => {
  if (!replyingTo) return null;
  const truncated =
    replyingTo.text.length > 80
      ? replyingTo.text.slice(0, 80) + "…"
      : replyingTo.text;

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-700/60 animate-in slide-in-from-bottom-1 duration-150">
      <div className="flex-1 min-w-0 border-l-4 border-blue-500 pl-3">
        <p className="text-[10px] font-black text-blue-500 dark:text-blue-400 mb-0.5">
          Replying to {replyingTo.sender === "me" ? "yourself" : displayName}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-300 truncate leading-snug">
          {truncated}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="shrink-0 size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
      >
        <FiX size={15} />
      </button>
    </div>
  );
};

/* ─── ChatView ────────────────────────────────────────────────────────────── */
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
    if (username && markAsRead) markAsRead();
  }, [username, markAsRead, currentConv?.messages?.length]);

  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState(null); // { id, text, sender }
  const [selectedMsgId, setSelectedMsgId] = useState(null); // which message pill is currently tapped
  const [profileInfo, setProfileInfo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const menuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  // Map of message id → DOM ref for scroll-to
  const msgRefs = useRef({});

  const displayName =
    currentConv?.fullName || profileInfo?.full_name || username || "Scholar";
  const avatarUrl = currentConv?.avatarUrl || profileInfo?.avatar_url || null;
  const isPremium =
    currentConv?.isPremium ?? profileInfo?.is_premium ?? false;
  const partnerUserId = currentConv?.userId || profileInfo?.id || null;

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
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConv?.messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  /* ── send ───────────────────────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) return;

    const textToSend = input.trim();
    const replyId = replyingTo?.id || null;
    setInput("");
    setReplyingTo(null);
    setSelectedMsgId(null);
    setIsSending(true);

    try {
      await sendMessage(textToSend, replyId);
    } catch (err) {
      console.error("Message send error:", err);
      setInput(textToSend);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isSending, replyingTo, sendMessage]);

  /* ── keyboard ───────────────────────────────────────────────────────── */
  const handleKeyDown = (e) => {
    const mobile = isMobileDevice();
    if (e.key === "Enter") {
      if (mobile) {
        // On mobile: Enter always inserts newline (browser default)
        return;
      }
      // On desktop: Enter sends, Shift+Enter inserts newline
      if (!e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Shift+Enter: let the browser add the newline naturally
    }
    if (e.key === "Escape") {
      if (replyingTo) setReplyingTo(null);
      if (selectedMsgId) setSelectedMsgId(null);
    }
  };

  /* ── reply helpers ──────────────────────────────────────────────────── */
  const startReply = useCallback((msg) => {
    setReplyingTo({ id: msg.id, text: msg.text, sender: msg.sender });
    setSelectedMsgId(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const scrollToMessage = useCallback((id) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash highlight
    el.classList.add("reply-flash");
    setTimeout(() => el.classList.remove("reply-flash"), 1200);
  }, []);

  /* ── block ──────────────────────────────────────────────────────────── */
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

  const isMobile = isMobileDevice();

  return (
    <>
      {/* Flash animation */}
      <style>{`
        @keyframes replyFlash {
          0%   { background-color: transparent; }
          25%  { background-color: rgba(59,130,246,0.18); }
          75%  { background-color: rgba(59,130,246,0.18); }
          100% { background-color: transparent; }
        }
        .reply-flash { animation: replyFlash 1.1s ease; border-radius: 16px; }
      `}</style>

      <div
        className="flex flex-col h-[100dvh] w-full max-w-4xl mx-auto bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 lg:border-x border-slate-200/70 dark:border-slate-800/60 overflow-hidden"
      >
        {/* ── TOP NAV ──────────────────────────────────────────────────────── */}
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

            <Link to={`/u/${username}`} className="flex items-center gap-3 min-w-0 group">
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

          {/* Header actions */}
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
                    onClick={() => { setMenuOpen(false); setReportModalOpen(true); }}
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
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1.5"
          onClick={() => setSelectedMsgId(null)}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
              <div className="size-16 rounded-3xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <FiMessageCircle size={30} />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Connect with {displayName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                You can send 1 message to initiate a connection request. Once{" "}
                {displayName} accepts, full chatting will unlock for both of you.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender === "me";
              const isSelected = selectedMsgId === msg.id;
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
                    ref={(el) => { if (el) msgRefs.current[msg.id] = el; }}
                    className={`flex items-end gap-2 py-0.5 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {/* For 'me' messages: Reply button appears on the left when tapped */}
                    {isMe && isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startReply(msg);
                        }}
                        title="Reply to message"
                        aria-label="Reply to message"
                        className="shrink-0 size-8 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center transition-all animate-in fade-in zoom-in-75 duration-150 active:scale-90"
                      >
                        <FiCornerUpLeft size={15} />
                      </button>
                    )}

                    {/* Message Bubble (tap toggles reply action) */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMsgId((prev) => (prev === msg.id ? null : msg.id));
                      }}
                      className={`relative max-w-[85%] sm:max-w-md px-3.5 pt-2.5 pb-2 rounded-2xl text-xs sm:text-sm shadow-sm leading-relaxed cursor-pointer select-text transition-all ${
                        isMe
                          ? "bg-blue-600 text-white rounded-tr-xs shadow-sm dark:shadow-none"
                          : "bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-xs border border-slate-200/70 dark:border-slate-700/60"
                      } ${
                        isSelected
                          ? "ring-2 ring-blue-400/80 ring-offset-2 ring-offset-[#F8FAFC] dark:ring-offset-[#0F172A]"
                          : ""
                      }`}
                    >
                      {/* Reply quote preview (if this is a reply to another text) */}
                      {msg.replyToText && (
                        <ReplyQuote
                          replyToText={msg.replyToText}
                          replyToSender={msg.replyToSender}
                          isMe={isMe}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (msg.replyToId) scrollToMessage(msg.replyToId);
                          }}
                        />
                      )}

                      <p className="whitespace-pre-wrap break-words inline font-medium">
                        {msg.text}
                      </p>

                      {/* Inline timestamp & status ticks */}
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
                              <IoCheckmark size={14} className="text-blue-200" title="Sent" />
                            ) : (
                              <IoCheckmarkDone size={15} className="text-sky-200" title="Delivered / Read" />
                            )}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* For 'them' messages: Reply button appears on the right when tapped */}
                    {!isMe && isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startReply(msg);
                        }}
                        title="Reply to message"
                        aria-label="Reply to message"
                        className="shrink-0 size-8 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center transition-all animate-in fade-in zoom-in-75 duration-150 active:scale-90"
                      >
                        <FiCornerUpLeft size={15} />
                      </button>
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── REQUEST RECEIVED BANNER ────────────────────────────────────────── */}
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

        {/* ── COMPOSER LOCKED NOTE ───────────────────────────────────────────── */}
        {connectionState === "request_sent" && (
          <div className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200/60 dark:border-amber-800/40 px-4 py-3 text-center">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
              You can send more messages once {displayName} accepts your request.
            </p>
          </div>
        )}

        {/* ── BLOCKED NOTE ──────────────────────────────────────────────────── */}
        {connectionState === "blocked" && (
          <div className="shrink-0 bg-rose-50 dark:bg-rose-950/20 border-t border-rose-200/60 dark:border-rose-900/40 px-4 py-3 text-center">
            <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
              Messaging is unavailable because this user is blocked.
            </p>
          </div>
        )}

        {/* ── REPLY BAR ─────────────────────────────────────────────────────── */}
        <ReplyBar
          replyingTo={replyingTo}
          displayName={displayName}
          onCancel={() => {
            setReplyingTo(null);
            setSelectedMsgId(null);
          }}
        />

        {/* ── COMPOSER FOOTER ───────────────────────────────────────────────── */}
        <footer className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800/80 p-3 sm:p-4">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            <textarea
              ref={inputRef}
              rows={1}
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
              className="flex-1 min-h-[44px] max-h-[120px] px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-y-auto leading-relaxed"
              style={{ scrollbarWidth: "thin" }}
            />

            <button
              type="button"
              onClick={handleSend}
              disabled={isComposerDisabled || !input.trim() || isSending}
              aria-label="Send message"
              className="size-11 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 flex items-center justify-center transition-all shadow-sm dark:shadow-none active:scale-95 shrink-0 self-end"
            >
              <FiSend size={15} />
            </button>
          </div>
          {/* Desktop hint */}
          {!isMobile && input.length > 0 && (
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-1.5 select-none">
              Enter to send · Shift+Enter for new line
            </p>
          )}
        </footer>

        {/* ── REPORT MODAL ──────────────────────────────────────────────────── */}
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          username={username}
          displayName={displayName}
          onSubmitReport={report}
        />
      </div>
    </>
  );
};

export default ChatView;
