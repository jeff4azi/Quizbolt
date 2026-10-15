import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaCrown, FaFire } from "react-icons/fa";
import { FiX, FiAward, FiArrowRight } from "react-icons/fi";
import Avatar from "./Avatar";
import MessageButton from "./MessageButton";
import ImageOverlayModal from "./ImageOverlayModal";

const isValidStreak = (lastStudyDate, currentStreak) => {
  if (!lastStudyDate || !currentStreak) return 0;
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-CA");
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA");
  const lastStudyStr = new Date(lastStudyDate).toLocaleDateString("en-CA");

  if (lastStudyStr === todayStr || lastStudyStr === yesterdayStr) {
    return currentStreak;
  }
  return 0;
};

const QuickViewSheet = ({
  isOpen,
  onClose,
  userProfile,
  isPremium,
  stats,
}) => {
  const navigate = useNavigate();
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isImageOverlayOpen) {
          setIsImageOverlayOpen(false);
          return;
        }
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current && !isImageOverlayOpen) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Initial focus on modal
    const timer = setTimeout(() => {
      const firstBtn = modalRef.current?.querySelector("button");
      if (firstBtn) firstBtn.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
      if (previousActiveElementRef.current?.focus) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, isImageOverlayOpen]);

  if (!isOpen || !userProfile) return null;

  const username = userProfile.user_name || userProfile.id;
  const displayName = userProfile.full_name || "Scholar";
  const university = userProfile.university?.trim() || "";
  const department = userProfile.department?.trim() || "";
  const levelNum = userProfile.year
    ? String(userProfile.year).length === 1
      ? `${userProfile.year}00`
      : userProfile.year
    : null;
  const levelText = levelNum ? `${levelNum}L` : "";

  const academicLine = [university, department, levelText]
    .filter(Boolean)
    .join(" · ") || "Scholar";

  // Rank config - clean gradients without glowing halos
  const rankStr = stats?.rank ? String(stats.rank) : null;
  const rankNum = rankStr ? parseInt(rankStr.replace("#", ""), 10) : null;
  const isTop1 = rankNum === 1;
  const isTop2 = rankNum === 2;
  const isTop3 = rankNum === 3;

  const rankConfig = isTop1
    ? {
        gradient: "from-amber-500 via-amber-600 to-amber-700",
        crown: "text-amber-100",
      }
    : isTop2
      ? {
          gradient: "from-slate-400 via-slate-500 to-slate-600",
          crown: "text-slate-100",
        }
      : isTop3
        ? {
            gradient: "from-orange-400 via-orange-500 to-orange-700",
            crown: "text-orange-100",
          }
        : {
            gradient: "from-blue-600 to-indigo-600",
            crown: null,
          };

  const currentStreak = isValidStreak(
    userProfile.last_study_date,
    userProfile.current_streak
  );
  const bestStreak = userProfile.best_streak || 0;
  const bestScore = stats?.bestScore || "—";

  const handleViewProfile = () => {
    onClose();
    navigate(`/u/${username}`, {
      state: {
        profile: userProfile,
        stats,
        isPremium,
        rank: rankStr,
      },
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center px-0 lg:px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-view-title"
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Sheet on Mobile / Modal on Desktop (lg: max-w-md) */}
        <div
          ref={modalRef}
          className="relative w-full lg:max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-[2rem] lg:rounded-3xl shadow-xl border-t lg:border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-6 lg:zoom-in-95 duration-200 overflow-hidden z-10"
        >
          {/* Mobile Grabber */}
          <div className="flex justify-center pt-3 pb-1 lg:hidden">
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>

          {/* Top Bar with Close button */}
          <div className="flex items-center justify-between px-6 pt-3 lg:pt-5 pb-2">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
              Scholar Quick View
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close quick view"
              className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-transform active:scale-90"
            >
              <FiX size={15} />
            </button>
          </div>

          <div className="px-6 pb-6 pt-1 space-y-4">
            {/* Identity & Rank Hero */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Clickable Profile Picture */}
                <button
                  type="button"
                  onClick={() => setIsImageOverlayOpen(true)}
                  className="relative shrink-0 focus:outline-none transition-transform active:scale-95 cursor-pointer group"
                  title="Click to view full photo"
                  aria-label={`View full profile photo of ${displayName}`}
                >
                  <Avatar
                    avatarUrl={userProfile.avatar_url}
                    size="lg"
                    className="rounded-2xl ring-2 ring-slate-100 dark:ring-slate-800 group-hover:opacity-90 transition-opacity"
                  />
                  {isPremium && (
                    <div
                      className="absolute -top-1 -right-1 bg-amber-400 p-1 rounded-lg border-2 border-white dark:border-slate-900"
                      title="Premium Scholar"
                    >
                      <FaCrown className="text-white text-[9px]" />
                    </div>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <h3
                    id="quick-view-title"
                    className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight"
                  >
                    {displayName}
                  </h3>
                  {username && (
                    <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 truncate">
                      @{username}
                    </p>
                  )}

                  <div className="mt-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isPremium
                          ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/40 dark:border-amber-800/40"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50"
                      }`}
                    >
                      {isPremium && <FaCrown size={8} />}
                      {isPremium ? "Premium" : "Free tier"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Podium / Rank badge on the right - clean styling without glowing halo */}
              {rankStr && (
                <div className="shrink-0 flex items-center justify-center">
                  <div
                    className={`size-16 rounded-2xl bg-gradient-to-br ${rankConfig.gradient} flex flex-col items-center justify-center text-white relative overflow-hidden shadow-sm dark:shadow-none border border-white/10`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center">
                      {(isTop1 || isTop2 || isTop3) && (
                        <FaCrown size={11} className={`${rankConfig.crown} mb-0.5`} />
                      )}
                      <span className="font-black text-lg leading-none tracking-tight">
                        {rankStr}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-[0.16em] opacity-80 mt-0.5">
                        Rank
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* One muted line: "{University} · {Department} · {Level}L" */}
            <div className="pt-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                {academicLine}
              </p>
            </div>

            {/* One row of 3 stats: best score, current streak, best streak */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800/80 p-3">
              <div className="flex flex-col items-center text-center px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">
                  Best Score
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {bestScore}
                </span>
              </div>

              <div className="flex flex-col items-center text-center px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <FaFire className="text-orange-500 size-2.5" />
                  Streak
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {currentStreak}d
                </span>
              </div>

              <div className="flex flex-col items-center text-center px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1">
                  <FiAward className="text-amber-500 size-2.5" />
                  Best
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {bestStreak}d
                </span>
              </div>
            </div>

            {/* Two buttons: Primary "Connect" / "Message" & Secondary "View profile" */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <MessageButton
                username={username}
                userProfile={userProfile}
                className="w-full h-11 text-xs"
                onAfterClick={onClose}
              />

              <button
                type="button"
                onClick={handleViewProfile}
                aria-label={`View full profile of ${displayName}`}
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm dark:shadow-none active:scale-[0.98]"
              >
                <span>View profile</span>
                <FiArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Profile Picture Image Modal */}
      <ImageOverlayModal
        isOpen={isImageOverlayOpen}
        onClose={() => setIsImageOverlayOpen(false)}
        avatarUrl={userProfile.avatar_url}
        fullName={displayName}
      />
    </>
  );
};

export default QuickViewSheet;
