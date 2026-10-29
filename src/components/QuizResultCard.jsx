import React from "react";
import { useNavigate } from "react-router-dom";
import { FaCrown } from "react-icons/fa";
import { FiZap, FiArrowRight } from "react-icons/fi";
import Avatar from "./Avatar";
import Logo from "../images/Logo";

/**
 * QuizResultCard
 * A pure CSS/SVG vector card representing a scholar's exam result.
 * Highly bandwidth-efficient (~0KB image footprint) and renders crisp on any device.
 */
const QuizResultCard = ({
  data,
  interactive = true,
  onAcceptChallenge = null,
  isMe = false,
}) => {
  const navigate = useNavigate();

  if (!data) return null;

  const {
    courseId,
    courseName,
    scorePercentage = 0,
    total = 0,
    questionType = "obj",
    durationSeconds = 0,
    caption = "Think you can beat this?",
    user = {},
    date,
    timestamp,
  } = data;

  const minutes = String(Math.floor(durationSeconds / 60)).padStart(2, "0");
  const seconds = String(durationSeconds % 60).padStart(2, "0");

  const formattedDate = (() => {
    try {
      const d = new Date(date || timestamp || Date.now());
      return d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  })();

  const typeLabel =
    questionType === "theory" ? "thy" : questionType === "fib" ? "fib" : "obj";

  // Score visual tier
  const tierColor =
    scorePercentage >= 70
      ? "from-blue-600 to-indigo-600"
      : scorePercentage >= 50
        ? "from-sky-500 to-blue-600"
        : "from-amber-500 to-rose-600";

  const strokeColor =
    scorePercentage >= 70
      ? "#2563EB"
      : scorePercentage >= 50
        ? "#0284C7"
        : "#D97706";

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, scorePercentage)) / 100) * circumference;

  const handleChallengeClick = (e) => {
    e.stopPropagation();
    if (onAcceptChallenge) {
      onAcceptChallenge(courseId || courseName);
    } else {
      const targetCourse = courseId || courseName;
      navigate(`/choose-course?course=${encodeURIComponent(targetCourse)}`);
    }
  };

  return (
    <div
      className={`w-full max-w-[340px] sm:max-w-[360px] rounded-3xl p-5 flex flex-col justify-between overflow-hidden relative shadow-lg select-none transition-all ${
        isMe
          ? "bg-slate-900 text-white border border-slate-700/80 shadow-blue-950/40"
          : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 shadow-slate-200/60 dark:shadow-none"
      }`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute -top-12 -right-12 size-36 bg-blue-500/15 dark:bg-blue-400/10 blur-3xl rounded-full pointer-events-none`}
      />

      {/* ── 1. HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <Avatar
              avatarUrl={user.avatarUrl}
              size="sm"
              className="ring-2 ring-blue-500/20"
            />
            {user.isPremium && (
              <div
                className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 border-2 border-white dark:border-slate-900 shadow-xs"
                title="Premium Scholar"
              >
                <FaCrown className="text-[6px] text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black truncate leading-tight">
              {user.fullName || user.username || "QuizBolt Scholar"}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-tight truncate">
              {user.college || "Scholar"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="size-7 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center p-1">
            <Logo className="w-5 h-5" />
          </div>
          {formattedDate && (
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">
              {formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. CENTER SCORE & COURSE ────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center py-4 relative z-10">
        {/* Course badge */}
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200/60 dark:border-blue-700/40 mb-3 shadow-xs">
          <span className="size-1.5 rounded-full bg-blue-600 animate-pulse" />
          <p className="text-[11px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-wider truncate max-w-[220px]">
            {courseName || courseId || "Exam"}
          </p>
        </div>

        {/* Circular SVG Gauge */}
        <div className="relative flex items-center justify-center">
          <div className="absolute size-24 bg-blue-500/10 dark:bg-blue-400/15 blur-2xl rounded-full" />
          <svg className="size-32 -rotate-90 drop-shadow-sm">
            {/* Background ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Progress ring */}
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={strokeColor}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center text-center">
            <span className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
              {scorePercentage}
              <span className="text-lg font-bold text-blue-500">%</span>
            </span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">
              Accuracy
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. STATS PILLS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 pb-3 relative z-10">
        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex flex-col items-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Questions
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black leading-none">{total}</span>
            <span className="text-[9px] font-extrabold text-blue-500 uppercase">
              {typeLabel}
            </span>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex flex-col items-center">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Duration
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-black leading-none">
              {minutes}:{seconds}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              Min
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. CHALLENGE BANNER & CTA ───────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col items-center text-center relative z-10">
        <p className="text-xs font-black tracking-tight italic text-slate-700 dark:text-slate-200 line-clamp-2 mb-2.5">
          "{caption}"
        </p>

        {interactive ? (
          <button
            type="button"
            onClick={handleChallengeClick}
            className={`w-full py-2.5 px-4 rounded-2xl font-black text-xs text-white shadow-md flex items-center justify-center gap-2 active:scale-98 transition-transform bg-gradient-to-r ${tierColor} hover:opacity-95`}
          >
            <FiZap size={14} className="fill-current" />
            <span>Accept Challenge</span>
            <FiArrowRight size={13} />
          </button>
        ) : (
          <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
            <span>Take quiz on</span>
            <span className="text-blue-500 font-bold">quizbolt.site</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizResultCard;
