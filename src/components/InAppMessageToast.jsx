import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiX } from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import Avatar from "./Avatar";
import { formatQuizResultPreview } from "../services/messagingService";

/**
 * InAppMessageToast
 * A floating, slide-dismissible notification banner for incoming messages.
 * - Supports touch and mouse swipe-up to dismiss.
 * - Auto-dismisses after duration (default 5s), pauses on hover/touch.
 * - Clicking navigates directly to `/messages/:username`.
 */
const InAppMessageToast = ({
  notification,
  onDismiss,
  duration = 5000,
}) => {
  const navigate = useNavigate();
  const [isExiting, setIsExiting] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const timerRef = useRef(null);
  const remainingTimeRef = useRef(duration);
  const startTimeRef = useRef(Date.now());

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 250);
  };

  const handleClick = (e) => {
    // If user was dragging, don't trigger click
    if (Math.abs(dragY) > 8) return;
    handleClose();
    if (notification?.username) {
      navigate(`/messages/${notification.username}`);
    }
  };

  // Auto-dismiss timer with pause-on-hover
  const startTimer = () => {
    startTimeRef.current = Date.now();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(handleClose, remainingTimeRef.current);
  };

  const pauseTimer = () => {
    clearTimeout(timerRef.current);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(1000, remainingTimeRef.current - elapsed);
  };

  useEffect(() => {
    startTimer();
    return () => clearTimeout(timerRef.current);
  }, [notification?.id]);

  // Touch Gesture Handlers (Swipe Up)
  const onTouchStart = (e) => {
    pauseTimer();
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    // Only allow dragging upwards or slight downward resistance
    if (diff < 0) {
      setDragY(diff);
    } else {
      setDragY(diff * 0.2);
    }
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (dragY < -35) {
      handleClose();
    } else {
      setDragY(0);
      startTimer();
    }
  };

  // Mouse Drag Handlers
  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    pauseTimer();
    startYRef.current = e.clientY;
    setIsDragging(true);
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const diff = e.clientY - startYRef.current;
    if (diff < 0) {
      setDragY(diff);
    } else {
      setDragY(diff * 0.2);
    }
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY < -35) {
      handleClose();
    } else {
      setDragY(0);
      startTimer();
    }
  };

  if (!notification) return null;

  const isRequest = notification.isRequest || notification.type === "request";
  const extraCount = notification.extraCount || 0;

  return (
    <div
      role="alert"
      aria-live="polite"
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={handleClick}
      style={{
        transform: `translateY(${dragY}px)`,
        transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease",
        opacity: isExiting ? 0 : 1,
      }}
      className={`group relative flex items-center gap-3.5 p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-2xl shadow-slate-900/15 dark:shadow-black/40 cursor-pointer select-none active:scale-[0.98] transition-transform ${
        isExiting ? "scale-95 -translate-y-4" : "animate-in slide-in-from-top-6 duration-300"
      }`}
    >
      {/* Sender Avatar */}
      <div className="relative shrink-0">
        <Avatar
          avatarUrl={notification.avatarUrl}
          size="md"
          isOnline={notification.isOnline}
        />
        {notification.isPremium && (
          <div className="absolute -top-1 -right-1 bg-amber-400 p-0.5 rounded-full border border-white dark:border-slate-900 shadow-xs flex items-center justify-center">
            <FaCrown className="text-white text-[7px]" />
          </div>
        )}
      </div>

      {/* Message Info */}
      <div className="flex-1 min-w-0 pr-6">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
            {notification.fullName || notification.username || "Scholar"}
          </p>
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">
            @{notification.username}
          </span>
          <span className="inline-block size-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            {notification.time || "Just now"}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
          {isRequest ? (
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Sent you a message request
            </span>
          ) : (
            formatQuizResultPreview(notification.text) || "Sent you a message"
          )}
        </p>
      </div>

      {/* Badge / Pill and Dismiss Button */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
        {extraCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black shrink-0">
            +{extraCount}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          aria-label="Dismiss notification"
          className="size-6 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
        >
          <FiX size={13} />
        </button>
      </div>

      {/* Subtle indicator bar on the left edge */}
      <div className="absolute left-0 inset-y-3 w-1 rounded-r-full bg-blue-600 dark:bg-blue-500" />
    </div>
  );
};

export default InAppMessageToast;
