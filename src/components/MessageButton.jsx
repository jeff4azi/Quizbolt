import React from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageSquare, FiClock, FiUserPlus } from "react-icons/fi";
import { useMessaging } from "../hooks/useMessaging";

const MessageButton = ({
  username,
  userProfile,
  className = "",
  onAfterClick,
}) => {
  const navigate = useNavigate();
  const targetUsername = username || userProfile?.user_name || userProfile?.id;
  const { connectionState } = useMessaging(targetUsername);

  // Hidden or disabled if blocked or declined
  if (connectionState === "blocked" || connectionState === "declined") {
    return (
      <button
        type="button"
        disabled
        className={`px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold cursor-not-allowed opacity-60 ${className}`}
      >
        Unavailable
      </button>
    );
  }

  const handleClick = (e) => {
    e.stopPropagation();
    navigate(`/messages/${targetUsername}`);
    if (onAfterClick) onAfterClick();
  };

  if (connectionState === "request_sent") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Connection request pending"
        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 text-xs font-bold transition-all active:scale-[0.98] dark:shadow-none ${className}`}
      >
        <FiClock className="size-3.5 shrink-0" />
        <span>Request pending</span>
      </button>
    );
  }

  if (connectionState === "request_received") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Respond to connection request"
        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm dark:shadow-none text-xs font-bold transition-all active:scale-[0.98] ${className}`}
      >
        <FiMessageSquare className="size-3.5 shrink-0" />
        <span>Respond to request</span>
      </button>
    );
  }

  if (connectionState === "accepted") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Send message to ${userProfile?.full_name || targetUsername}`}
        className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm dark:shadow-none text-xs font-bold transition-all active:scale-[0.98] ${className}`}
      >
        <FiMessageSquare className="size-3.5 shrink-0" />
        <span>Message</span>
      </button>
    );
  }

  // connectionState === "none" (not connected yet) -> "Connect"
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Connect with ${userProfile?.full_name || targetUsername}`}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm dark:shadow-none text-xs font-bold transition-all active:scale-[0.98] ${className}`}
    >
      <FiUserPlus className="size-3.5 shrink-0" />
      <span>Connect</span>
    </button>
  );
};

export default MessageButton;
