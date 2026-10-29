import { useNavigate } from "react-router-dom";
import WhatsAppCard from "../components/WhatsAppCard";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useEffect, useState, useRef } from "react";
import {
  trackResultShare,
  trackReviewAnswers,
  trackExamRetake,
  trackPremiumGateHit,
} from "../utils/analytics";
import BannerAd from "../components/BannerAd";
import ConfirmOverlay from "../components/ConfirmOverlay";
import { FaCrown } from "react-icons/fa";
import { FiRefreshCw, FiEye, FiChevronDown } from "react-icons/fi";
import Avatar from "../components/Avatar";
/* import NavBar from "../components/NavBar"; */
import Logo from "../images/Logo";
import { toPng } from "html-to-image";
import ShareResultModal from "../components/ShareResultModal";

const FREE_DAILY_RETRY_KEY = "free_retry_date";

const canUseFreeRetry = () => {
  const today = new Date().toDateString();
  return localStorage.getItem(FREE_DAILY_RETRY_KEY) !== today;
};

const consumeFreeRetry = () => {
  localStorage.setItem(FREE_DAILY_RETRY_KEY, new Date().toDateString());
};

const ResultScreen = ({
  questions,
  results,
  answers,
  setAnswers,
  setHasRetaken,
  selectedCourse,
  userProfile,
  isPremium,
  questionType,
  timeTaken,
  hasRetaken,
}) => {
  const navigate = useNavigate();
  const [showAd, setShowAd] = useState(true);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [isRetryOverlayOpen, setRetryOverlayOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [freeRetryAvailable, setFreeRetryAvailable] = useState(canUseFreeRetry);
  const [sectionOpen, setSectionOpen] = useState(false);

  const shareRef = useRef(null);

  useEffect(() => {
    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDarkMode(darkQuery.matches);
    const listener = (e) => setIsDarkMode(e.matches);
    darkQuery.addEventListener("change", listener);
    return () => darkQuery.removeEventListener("change", listener);
  }, []);
  const formatNum = (num) => String(num).padStart(2, "0");
  const answeredCount = answers.filter((a) => a !== undefined).length;

  const handleExportImage = async ({
    caption = "",
    title = "",
    text = "",
    url = "",
    downloadOnly = false,
  } = {}) => {
    setSharing(true);
    if (!shareRef.current) return;

    try {
      const dataUrl = await toPng(shareRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: isDarkMode ? "#030712" : "#f8fafc", // bg-gray-950 or bg-slate-50
        useCORS: true,
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "quizbolt-result.png", {
        type: "image/png",
      });

      if (!downloadOnly && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || "My QuizBolt Result",
          text: text || `I scored ${scorePercentage}% in ${selectedCourse.name}`,
          url: url || undefined,
        });
        trackResultShare(selectedCourse.id, scorePercentage);
      } else {
        const link = document.createElement("a");
        link.download = "quizbolt-result.png";
        link.href = dataUrl;
        link.click();
        trackResultShare(selectedCourse.id, scorePercentage);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Export image share failed:", err);
      }
    } finally {
      setSharing(false);
    }
  };

  const timeTakenSafe = timeTaken ?? 0;
  const minutes = String(Math.floor(timeTakenSafe / 60)).padStart(2, "0");
  const seconds = String(timeTakenSafe % 60).padStart(2, "0");
  const scorePercentage = Math.round(
    (results.correct / (results.answered || questions.length)) * 100,
  );
  const courseCode = selectedCourse?.id || selectedCourse?.code;
  const scorePercent = typeof scorePercentage === "number" ? ` (${scorePercentage}%)` : "";
  useDocumentTitle(courseCode ? `${courseCode} Results${scorePercent} | QuizBolt` : "Results | QuizBolt");
  const strokeDasharray = 2 * Math.PI * 90;
  const strokeDashoffset =
    strokeDasharray - (scorePercentage / 100) * strokeDasharray;

  const getFeedback = () => {
    const firstName = userProfile?.full_name?.split(" ")[0] ?? "";
    const skipped = questions.length - answeredCount;
    const skippedALot = skipped >= Math.ceil(questions.length * 0.2);
    const secondsPerQuestion = timeTakenSafe / (answeredCount || 1);
    const isRushed = timeTakenSafe > 0 && secondsPerQuestion < 8; // < 4 mins for 30q
    const isInsane = timeTakenSafe > 0 && secondsPerQuestion < 4; // < 2 mins for 30q ← new
    const isThorough = timeTakenSafe > 0 && secondsPerQuestion > 45;

    // ── Tier helpers ──────────────────────────────────────────────
    const tier =
      scorePercentage >= 80
        ? "high"
        : scorePercentage >= 60
          ? "mid"
          : scorePercentage >= 45
            ? "low"
            : "fail";

    const color =
      tier === "high"
        ? "text-green-500"
        : tier === "mid"
          ? "text-blue-500"
          : tier === "low"
            ? "text-amber-500"
            : "text-red-500";

    const pick = (msg) => ({ msg, color });

    // ── 1. Retake signals (highest priority) ─────────────────────
    if (hasRetaken) {
      if (tier === "high")
        return pick(
          `That's the one, ${firstName}. You came back and got it done.`,
        );
      if (tier === "mid")
        return pick(
          `Progress, ${firstName}. You're moving in the right direction, one more push.`,
        );
      if (tier === "low")
        return pick(
          `Still grinding, ${firstName}. Break it down by section and attack the weak spots.`,
        );
      return pick(
        `Don't let this one define you, ${firstName}. Look at where the marks went and go again.`,
      );
    }

    // ── 2. Skipped too many ───────────────────────────────────────
    if (skippedALot) {
      if (tier === "high")
        return pick(
          `Strong score, ${firstName}, and you still left ${skipped} questions blank. Imagine the ceiling.`,
        );
      if (tier === "mid")
        return pick(
          `${skipped} questions skipped, ${firstName}. Attempt everything next time and this score climbs.`,
        );
      return pick(
        `${skipped} unanswered questions hurt you here, ${firstName}. Always attempt, an educated guess beats a blank.`,
      );
    }

    // ── 3. Pace signals ───────────────────────────────────────────
    if (isInsane) {
      if (tier === "high")
        return pick(
          `${Math.round(secondsPerQuestion)}s per question and still accurate, ${firstName}? That's elite.`,
        );
      if (tier === "mid")
        return pick(
          `${Math.round(secondsPerQuestion)}s per question, ${firstName}, that pace is costing you marks. Trust the process.`,
        );
      return pick(
        `${Math.round(secondsPerQuestion)}s per question, ${firstName}. Speed means nothing without accuracy.`,
      );
    }

    if (isRushed) {
      if (tier === "high")
        return pick(
          `Quick and accurate, ${firstName}. That's a rare combination.`,
        );
      if (tier === "mid")
        return pick(
          `You moved fast, ${firstName}. Slow down slightly and that score jumps.`,
        );
      return pick(
        `Too fast, ${firstName}. Speed without accuracy costs marks, pace yourself next time.`,
      );
    }

    // ── 4. Unusually thorough (> 45s per question) ───────────────
    if (isThorough) {
      if (tier === "high")
        return pick(
          `Careful and thorough, ${firstName}. That approach clearly paid off.`,
        );
      if (tier === "mid")
        return pick(
          `You took your time, ${firstName}. Trust your first instinct a little more, it's usually right.`,
        );
      return pick(
        `You were methodical, ${firstName}, but the material needs more familiarity before speed matters.`,
      );
    }

    // ── 5. Clean first attempt — score speaks for itself ─────────
    if (tier === "high")
      return pick(
        `Excellent work, ${firstName}. You clearly know this material.`,
      );
    if (tier === "mid")
      return pick(
        `Solid result, ${firstName}. A focused review of the gaps and you'll be at the top.`,
      );
    if (tier === "low")
      return pick(
        `You're partway there, ${firstName}. Identify the weak sections and target them directly.`,
      );
    return pick(
      `This one got away from you, ${firstName}. Review the material section by section and come back.`,
    );
  };;

  const feedback = getFeedback();

  // ── Section breakdown (only for courses that have section attr) ──────────
  const sectionStats = (() => {
    const hasSections = questions.some((q) => q.section);
    if (!hasSections) return null;

    const map = {};
    questions.forEach((q, i) => {
      const sec = q.section || "General";
      if (!map[sec]) map[sec] = { correct: 0, total: 0 };
      map[sec].total += 1;
      const isCorrect = answers[i] === q.correct;
      if (isCorrect) map[sec].correct += 1;
    });
    return map;
  })();

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 p-6 lg:p-10 pb-16 lg:pb-32 flex flex-col lg:max-w-2xl mx-auto transition-colors duration-300">
      <header className="flex justify-between items-center md:mb-8 lg:px-16">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 py-2 px-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <span className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wider font-bold">
            Time
          </span>
          <span className="font-mono text-[#2563EB] dark:text-[#22D3EE] font-bold text-lg">
            {minutes}:{seconds}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-gray-800 dark:text-gray-200 leading-none">
              {userProfile?.full_name}
            </p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter mt-1">
              {userProfile?.college}
            </p>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="relative rounded-2xl"
          >
            <Avatar avatarUrl={userProfile?.avatar_url} size="sm" />
            {isPremium && (
              <div className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-1 border-2 border-white dark:border-gray-950 shadow-md">
                <FaCrown className="text-[8px] text-white" />
              </div>
            )}
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-start pt-6 space-y-6 md:space-y-8 lg:px-16">
        {/* Responsive SVG circle */}
        <div
          onClick={() => navigate("/history")}
          className="relative flex items-center justify-center cursor-pointer group w-45 h-45 sm:w-65 sm:h-65"
        >
          <svg
            viewBox="0 0 224 224"
            className="w-full h-full transform -rotate-90"
          >
            <circle
              cx="112"
              cy="112"
              r="90"
              className="stroke-gray-200 dark:stroke-gray-800"
              strokeWidth="12"
              fill="transparent"
            />
            <circle
              cx="112"
              cy="112"
              r="90"
              stroke="currentColor"
              strokeWidth="12"
              fill="transparent"
              strokeDasharray={strokeDasharray}
              style={{
                strokeDashoffset,
                transition: "stroke-dashoffset 1s ease-out",
              }}
              className="text-[#2563EB] dark:text-[#22D3EE]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl sm:text-5xl font-black text-gray-800 dark:text-white">
              {scorePercentage}
              <span className="text-xl sm:text-2xl">%</span>
            </span>
            <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest">
              Score
            </span>
          </div>
        </div>

        <div className="text-center px-4">
          <h1 className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white tracking-tight">
            {selectedCourse.name}
          </h1>
          <p className="text-[12px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
            {questionType === "theory"
              ? "Theory"
              : questionType === "fib"
                ? "Fill in the Blanks"
                : "Objective"}
          </p>
          {hasRetaken && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-[8px] md:text-[10px] font-black uppercase tracking-[0.18em] text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
              <FiRefreshCw size={12} /> Retake Attempt
            </div>
          )}
          <p className={`text-xs md:text-sm mt-2 font-bold ${feedback.color}`}>
            {feedback.msg}
          </p>
        </div>

        {/* ── Section breakdown ── */}
        {sectionStats &&
          (() => {
            const sectionEntries = Object.entries(sectionStats);
            const goodCount = sectionEntries.filter(
              ([, { correct, total }]) =>
                Math.round((correct / total) * 100) >= 60,
            ).length;

            return (
              <div className="w-full bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xl">
                {/* Header — tappable */}
                <button
                  onClick={() => setSectionOpen((p) => !p)}
                  className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 lg:py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 shrink-0">
                    Section Breakdown
                  </p>
                  <div className="flex items-center gap-2 min-w-0">
                    {!sectionOpen && (
                      <span className="text-[10px] font-bold text-slate-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full truncate">
                        {sectionEntries.length} sections · {goodCount} good
                      </span>
                    )}
                    <FiChevronDown
                      size={16}
                      className={`shrink-0 text-slate-400 transition-transform duration-250 ${sectionOpen ? "rotate-180" : "rotate-0"}`}
                    />
                  </div>
                </button>

                {/* Collapsible body */}
                <div
                  className="grid transition-all duration-300 ease-in-out"
                  style={{ gridTemplateRows: sectionOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                      {sectionEntries.map(([section, { correct, total }]) => {
                        const pct = Math.round((correct / total) * 100);
                        const tier =
                          pct >= 80 ? "great" : pct >= 60 ? "fair" : "weak";
                        const dotColor =
                          tier === "great"
                            ? "bg-green-500"
                            : tier === "fair"
                              ? "bg-amber-400"
                              : "bg-red-400";
                        const badgeStyle =
                          tier === "great"
                            ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                            : tier === "fair"
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400";
                        const badgeLabel =
                          tier === "great"
                            ? "Good"
                            : tier === "fair"
                              ? "Fair"
                              : "Needs work";

                        return (
                          <div
                            key={section}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 px-4 sm:px-5 py-3"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`shrink-0 size-2 rounded-full ${dotColor}`}
                              />
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                                {section}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pl-4 sm:pl-0">
                              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">
                                {correct}/{total}
                              </span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${badgeStyle}`}
                              >
                                {badgeLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        <div className="mt-5 sm:mt-2 bg-white dark:bg-gray-900 w-full p-4 md:p-6 grid grid-cols-2 gap-4 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800">
          <StatItem
            label="Answered"
            value={formatNum(answeredCount)}
            color="bg-blue-500"
            textColor="text-[#2563EB] dark:text-blue-400"
          />
          <StatItem
            label="Total"
            value={formatNum(questions.length)}
            color="bg-gray-400"
            textColor="text-gray-600 dark:text-gray-300"
          />
          <StatItem
            label="Correct"
            value={formatNum(results.correct)}
            color="bg-green-500"
            textColor="text-green-600 dark:text-green-400"
          />
          <StatItem
            label="Wrong"
            value={formatNum(results.wrong)}
            color="bg-red-500"
            textColor="text-red-600 dark:text-red-400"
          />
        </div>
      </main>

      <footer className="mt-10 flex justify-evenly items-center bg-white dark:bg-gray-900 py-3.5 md:py-4 lg:mx-64 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm gap-2">
        {/* Home Button - Most Important */}
        <ActionButton
          label="Home"
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          onClick={() => {
            navigate("/");
          }}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9.75L12 3l9 6.75M19.5 10.5v9a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5v-9"
            />
          }
        />

        <ActionButton
          label="Retake"
          disabled={!isPremium && !freeRetryAvailable}
          showCrown={!isPremium && !freeRetryAvailable}
          color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          onLockedClick={() => {
            setRetryOverlayOpen(true);
            trackPremiumGateHit("retake");
          }}
          onClick={() => {
            if (!isPremium) {
              consumeFreeRetry();
              setFreeRetryAvailable(false);
            }
            setAnswers([]);
            setHasRetaken(true);
            navigate("/exam");
            trackExamRetake(selectedCourse.id);
          }}
          icon={
            <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          }
        />

        <ActionButton
          label="Review"
          disabled={false}
          color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          onClick={() => {
            trackReviewAnswers(selectedCourse.id);
            navigate("/review-answers");
          }}
          icon={
            <>
              <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </>
          }
        />

        <ActionButton
          label={sharing ? "Sharing..." : "Share"}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          onClick={() => setIsShareModalOpen(true)}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
            />
          }
        />
      </footer>

      {/* --- HIDDEN SHAREABLE IMAGE COMPONENT (DARK MODE READY) --- */}
      <div className="fixed top-0 left-0 opacity-0 pointer-events-none">
        <div
          ref={shareRef}
          className="w-[350px] h-[500px] bg-slate-50 dark:bg-gray-950 p-7 flex flex-col justify-between shadow-2xl overflow-hidden relative"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 bg-white dark:bg-gray-900 p-2 pr-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
              <div className="relative">
                <Avatar
                  avatarUrl={userProfile?.avatar_url}
                  size="sm"
                  className="ring-2 ring-blue-50 dark:ring-blue-900/20"
                />
                {isPremium && (
                  <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 border-2 border-white dark:border-gray-900">
                    <FaCrown className="text-[6px] text-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-bold text-slate-800 dark:text-white leading-none truncate max-w-[120px]">
                  {userProfile?.full_name}
                </span>
                <span className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-tight truncate max-w-[120px]">
                  {userProfile?.college}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-xl">
                <Logo className="w-8 h-8" />
              </div>
              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tighter text-center mr-1.5">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Center Score */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="bg-blue-100/50 dark:bg-blue-900/30 px-3 py-1 rounded-full mb-4">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                {selectedCourse.name}
              </p>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute size-32 bg-blue-200 dark:bg-blue-500 blur-[40px] opacity-30 dark:opacity-20 rounded-full" />
              <svg className="size-40 -rotate-90 drop-shadow-sm">
                {/* Background Circle (The "grayed out" part) */}
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  /* CHANGE THIS: Replace className with stroke attribute */
                  stroke={isDarkMode ? "#1f2937" : "#e2e8f0"} // gray-800 for dark, slate-200 for light
                  strokeWidth="10"
                  fill="transparent"
                />
                {/* Progress Circle (The blue part) */}
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
                    (scorePercentage / 100) * (2 * Math.PI * 70)
                  }
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
                  {scorePercentage}
                  <span className="text-xl">%</span>
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Accuracy
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="flex gap-3 px-2">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-[2rem] flex-1 flex flex-col items-center shadow-sm border border-slate-100 dark:border-gray-800">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                Questions
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-800 dark:text-white">
                  {formatNum(questions.length)}
                </span>
                <span className="text-[9px] font-bold text-blue-500 uppercase">
                  {questionType === "theory"
                    ? "thy"
                    : questionType === "fib"
                      ? "fib"
                      : "obj"}
                </span>
              </div>
            </div>
            <div className="bg-slate-900 dark:bg-slate-800 p-4 rounded-[2rem] flex-1 flex flex-col items-center shadow-lg">
              <span className="text-[9px] font-bold text-slate-500 uppercase mb-1">
                Duration
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-white">
                  {minutes}:{seconds}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">
                  Min
                </span>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="text-center pt-2">
            <p className="text-[14px] font-extrabold text-slate-800 dark:text-slate-200 tracking-tight italic">
              "Think you can beat this?"
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Challenge yourself at{" "}
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                quizbolt.site
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-24 right-6 pointer-events-auto">
        <WhatsAppCard university={userProfile?.university} />
      </div>
      {!isPremium && showAd && <BannerAd onAdClose={() => setShowAd(false)} />}
      <ConfirmOverlay
        isOpen={isPremiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Unlock Premium Analysis"
        message="Get Premium to retake exams instantly and review detailed answers for every question."
        confirmText="Get Premium"
        cancelText="Maybe later"
      />
      <ConfirmOverlay
        isOpen={isRetryOverlayOpen}
        onClose={() => setRetryOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Daily Retry Used"
        message="You've already used your 1 free retry today. Upgrade to Premium for unlimited retakes anytime."
        confirmText="Get Premium"
        cancelText="Maybe tomorrow"
        icon={<FiRefreshCw size={32} />}
      />

      <ShareResultModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        course={selectedCourse}
        results={results}
        questions={questions}
        questionType={questionType}
        timeTaken={timeTakenSafe}
        userProfile={userProfile}
        isPremium={isPremium}
        onExportImage={handleExportImage}
      />

      {/* <NavBar
        isPremium={isPremium}
        onLockedClick={() => setPremiumOverlayOpen(true)}
      /> */}
    </div>
  );
};

const StatItem = ({ label, value, color, textColor }) => (
  <div className="flex flex-col items-center justify-center gap-1.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl px-6 py-3 md:py-4 w-full">
    <span
      className={`text-2xl md:text-3xl font-black leading-none tabular-nums ${textColor}`}
    >
      {value}
    </span>
    <div className="flex items-center gap-1.5">
      <div className={`size-1.5 rounded-full ${color}`} />
      <span className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500 font-bold">
        {label}
      </span>
    </div>
  </div>
);

const ActionButton = ({
  label,
  icon,
  onClick,
  onLockedClick,
  color,
  disabled,
  showCrown,
}) => (
  <button
    onClick={disabled ? onLockedClick : onClick}
    className={`relative flex flex-col items-center gap-2 group ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
  >
    <div
      className={`p-2.5 md:p-3 rounded-2xl transition-all duration-200 ${!disabled && "group-hover:scale-110 group-active:scale-95"} ${color}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        className="size-5 md:size-6"
      >
        {icon}
      </svg>
      {disabled && showCrown && (
        <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-1 border-2 border-white dark:border-gray-950 shadow-md">
          <FaCrown className="text-[8px] text-white" />
        </div>
      )}
    </div>
    <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tighter text-gray-500 dark:text-gray-400">
      {label}
    </span>
  </button>
);

export default ResultScreen;
