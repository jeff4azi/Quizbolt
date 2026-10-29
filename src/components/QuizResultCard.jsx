import React from "react";
import { useNavigate } from "react-router-dom";
import { FaCrown } from "react-icons/fa";
import { FiZap, FiArrowRight } from "react-icons/fi";
import Avatar from "./Avatar";
import Logo from "../images/Logo";

/**
 * QuizResultCard
 * Identical 1:1 vector recreation of the QuizBolt sharable result image.
 * Uses pure CSS/SVG (0KB image payload) so it renders flawlessly at any resolution.
 */
const QuizResultCard = ({
  data,
  interactive = true,
  onAcceptChallenge = null,
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

  const formatNum = (num) => String(num).padStart(2, "0");
  const timeTakenSafe = durationSeconds || 0;
  const minutes = String(Math.floor(timeTakenSafe / 60)).padStart(2, "0");
  const seconds = String(timeTakenSafe % 60).padStart(2, "0");

  const formattedDate = (() => {
    try {
      const d = new Date(date || timestamp || Date.now());
      return d.toLocaleDateString();
    } catch {
      return new Date().toLocaleDateString();
    }
  })();

  const typeLabel =
    questionType === "theory" ? "thy" : questionType === "fib" ? "fib" : "obj";

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
      className="w-[330px] sm:w-[350px] min-h-[480px] bg-slate-50 dark:bg-gray-950 p-6 sm:p-7 flex flex-col justify-between shadow-2xl rounded-[2.5rem] overflow-hidden relative border border-slate-200/80 dark:border-gray-800 select-none transition-all"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* ── 1. Header (Identical to sharable image) ────────────────────────── */}
      <div className="flex justify-between items-start">
        {/* User Pill */}
        <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 pr-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
          <div className="relative">
            <Avatar
              avatarUrl={user.avatarUrl}
              size="sm"
              className="ring-2 ring-blue-50 dark:ring-blue-900/20"
            />
            {user.isPremium && (
              <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 border-2 border-white dark:border-gray-900 shadow-xs">
                <FaCrown className="text-[6px] text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-slate-800 dark:text-white leading-none truncate max-w-[120px]">
              {user.fullName || user.username || "Scholar"}
            </span>
            <span className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[120px]">
              {user.college || "Scholar"}
            </span>
          </div>
        </div>

        {/* Logo & Date */}
        <div className="flex flex-col items-end gap-1">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl">
            <Logo className="w-8 h-8" />
          </div>
          <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tighter text-center mr-1.5">
            {formattedDate}
          </span>
        </div>
      </div>

      {/* ── 2. Center Score (Identical to sharable image) ─────────────────── */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="bg-blue-100/50 dark:bg-blue-900/30 px-3 py-1 rounded-full mb-3 shadow-xs">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest truncate max-w-[240px]">
            {courseName || courseId || "Exam"}
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="absolute size-32 bg-blue-200 dark:bg-blue-500 blur-[40px] opacity-30 dark:opacity-20 rounded-full" />
          <svg className="size-36 sm:size-40 -rotate-90 drop-shadow-sm">
            {/* Background Circle */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="currentColor"
              className="text-slate-200 dark:text-gray-800"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Progress Circle (Blue Part) */}
            <circle
              cx="80"
              cy="80"
              r="70"
              stroke="#2563EB"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={
                2 * Math.PI * 70 -
                (Math.min(100, Math.max(0, scorePercentage)) / 100) * (2 * Math.PI * 70)
              }
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
              {scorePercentage}
              <span className="text-xl">%</span>
            </span>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">
              Accuracy
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Stats Grid (Identical to sharable image) ────────────────────── */}
      <div className="flex gap-3 px-1">
        {/* Questions count pill */}
        <div className="bg-white dark:bg-gray-900 p-3.5 sm:p-4 rounded-[2rem] flex-1 flex flex-col items-center shadow-sm border border-slate-100 dark:border-gray-800">
          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
            Questions
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
              {formatNum(total)}
            </span>
            <span className="text-[9px] font-bold text-blue-500 uppercase">
              {typeLabel}
            </span>
          </div>
        </div>

        {/* Duration pill */}
        <div className="bg-slate-900 dark:bg-slate-800 p-3.5 sm:p-4 rounded-[2rem] flex-1 flex flex-col items-center shadow-lg">
          <span className="text-[9px] font-bold text-slate-500 uppercase mb-1">
            Duration
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg sm:text-xl font-black text-white">
              {minutes}:{seconds}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              Min
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Footer CTA & Interactive Button ─────────────────────────────── */}
      <div className="text-center pt-3 flex flex-col items-center gap-1.5">
        <p className="text-[13px] sm:text-[14px] font-extrabold text-slate-800 dark:text-slate-200 tracking-tight italic line-clamp-2">
          "{caption}"
        </p>
        <p className="text-[10px] text-slate-400 font-medium">
          Challenge yourself at{" "}
          <span className="text-blue-600 dark:text-blue-400 font-bold">
            quizbolt.site
          </span>
        </p>

        {interactive && (
          <button
            type="button"
            onClick={handleChallengeClick}
            className="mt-2 w-full py-2.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-black shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition"
          >
            <FiZap size={14} className="fill-current text-amber-300" />
            <span>Accept Challenge</span>
            <FiArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizResultCard;
