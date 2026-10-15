import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiSend,
  FiClock,
  FiUserCheck,
  FiRotateCcw,
  FiMessageCircle,
} from "react-icons/fi";
import { IoCheckmark, IoCheckmarkDone } from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import Avatar from "../components/Avatar";
import { useMessaging } from "../hooks/useMessaging";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { supabase } from "../supabaseClient";

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
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
    markAsRead,
    simulateAccept,
    simulateReply,
    resetDemo,
  } = useMessaging(username);

  // Mark conversation as read whenever this view is active
  useEffect(() => {
    if (username && markAsRead) {
      markAsRead();
    }
  }, [username, markAsRead, currentConv?.messages?.length]);

  const [input, setInput] = useState("");
  const [profileInfo, setProfileInfo] = useState(null);
  const [showDevControls, setShowDevControls] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const displayName =
    currentConv?.fullName || profileInfo?.full_name || username || "Scholar";
  const avatarUrl = currentConv?.avatarUrl || profileInfo?.avatar_url || null;
  const isPremium =
    currentConv?.isPremium ?? profileInfo?.is_premium ?? false;

  useDocumentTitle(`Chat with ${displayName} | QuizBolt`);

  // Fetch basic profile info if not in mock store
  useEffect(() => {
    if (currentConv) return;
    if (!username) return;

    supabase
      .from("profiles")
      .select("id, full_name, user_name, avatar_url, is_premium")
      .or(`user_name.eq.${username},id.eq.${username}`)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfileInfo(data);
      });
  }, [username, currentConv]);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentConv?.messages]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    // Send the message
    sendMessage(input.trim());
    setInput("");

    // Keep focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
                className="rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700"
              />
              {isPremium && (
                <div className="absolute -top-1 -right-1 bg-amber-400 p-0.5 rounded-full border border-white dark:border-slate-900">
                  <FaCrown className="text-white text-[7px]" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-sm font-black text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {displayName}
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-400">
                <span>@{username}</span>
                <span>•</span>
                {connectionState === "accepted" && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                    <FiCheck size={10} />
                    Connected
                  </span>
                )}
                {connectionState === "request_sent" && (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                    <FiClock size={10} />
                    Request pending
                  </span>
                )}
                {connectionState === "request_received" && (
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">
                    Message request
                  </span>
                )}
                {connectionState === "none" && (
                  <span>New connection</span>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Header Action: Dev Controls Toggle & View Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowDevControls((p) => !p)}
            className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40"
          >
            🛠️ Demo
          </button>
          <Link
            to={`/u/${username}`}
            className="hidden sm:inline-flex text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Profile
          </Link>
        </div>
      </header>

      {/* ── DEV CONTROLS BAR ──────────────────────────────────────────────── */}
      {showDevControls && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200/70 dark:border-amber-800/50 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap text-xs animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-amber-800 dark:text-amber-300">
              Dev Simulator:
            </span>
            {connectionState === "request_sent" && (
              <button
                type="button"
                onClick={() => simulateAccept()}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-sm active:scale-95"
              >
                Simulate {displayName} Accepts
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                simulateReply(
                  "Hey! Thanks for connecting. I'd love to study together!"
                )
              }
              className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] shadow-sm active:scale-95"
            >
              Simulate {displayName} Replies
            </button>
          </div>
          <button
            type="button"
            onClick={resetDemo}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
          >
            <FiRotateCcw size={11} />
            <span>Reset Demo</span>
          </button>
        </div>
      )}

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
              You can send 1 message to initiate a request. Once {displayName}{" "}
              accepts, full chatting will unlock for both of you.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === "me";
            return (
              <div
                key={msg.id}
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

                  {/* Inline timestamp & status ticks inside the bubble */}
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
            You can send more messages once {displayName} accepts.
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
            disabled={isComposerDisabled}
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
            disabled={isComposerDisabled || !input.trim()}
            aria-label="Send message"
            className="size-11 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 flex items-center justify-center transition-all shadow-sm dark:shadow-none active:scale-95"
          >
            <FiSend size={15} />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default ChatView;
