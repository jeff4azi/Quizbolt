import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../apiConfig";
import CoursePicker from "../components/CoursePicker";
import FlashCard from "../components/FlashCard";
import {
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
  FiShuffle,
  FiEye,
  FiEyeOff,
  FiRotateCcw,
  FiCheckCircle,
  FiLoader,
  FiZap,
  FiBookOpen,
  FiTarget,
  FiRepeat,
  FiClock,
  FiSearch,
} from "react-icons/fi";
import { FaCrown, FaTrophy } from "react-icons/fa";
import flashCardIcon from "../images/flash-card.webp";

const FREE_CARD_LIMIT = 20;

// ─── helpers ─────────────────────────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─── Premium Gate Overlay ─────────────────────────────────────────────────────
const PremiumGateOverlay = ({ onUpgrade, onDismiss }) => (
  <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300" />
    <div className="relative bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out">
      <div className="flex flex-col items-center text-center">
        <div className="mb-5 size-20 rounded-3xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
          <FaCrown className="text-amber-500" size={36} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          Free limit reached
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-2">
          You&apos;ve studied {FREE_CARD_LIMIT} cards. Upgrade to Premium for
          unlimited flashcards.
        </p>
        <div className="flex flex-col w-full gap-3">
          <button
            onClick={onUpgrade}
            className="w-full py-4 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <FaCrown size={14} /> Go Premium
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Checkbox Row ─────────────────────────────────────────────────────────────
const CheckRow = ({ label, checked, onChange, disabled = false }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    className={`flex items-center gap-3 w-full text-left transition-opacity ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
  >
    <span
      className={`size-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors duration-150 ${
        checked
          ? "bg-violet-600 border-violet-600"
          : "border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800"
      }`}
    >
      {checked && <FiCheck className="size-3 text-white" strokeWidth={3} />}
    </span>
    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
      {label}
    </span>
  </button>
);

// ─── Setup Screen ─────────────────────────────────────────────────────────────
const SetupScreen = ({ course, isPremium, onBack, onStart }) => {
  const hasObjective = (course?.questionCount || 0) > 0;
  const hasTheory = (course?.theoryQuestionCount || 0) > 0;
  const hasFib = (course?.fibQuestionCount || 0) > 0;

  const hasDifficulty =
    course?.difficultyCounts &&
    Object.values(course.difficultyCounts).some((v) => v > 0);
  const hasSections =
    course?.sectionCounts &&
    Object.values(course.sectionCounts).some((v) => v > 0);

  // Question format filter (Secondary in flashcards, default to "all")
  const [selectedQuestionType, setSelectedQuestionType] = useState("all");

  // Difficulty filter (Secondary)
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  // Topics / Sections filter (PRIMARY HERO in flashcards)
  const allSectionsList = useMemo(
    () =>
      hasSections
        ? Object.keys(course.sectionCounts).filter(
            (k) => (course.sectionCounts[k] || 0) > 0,
          )
        : [],
    [course, hasSections],
  );

  const [selectedSections, setSelectedSections] = useState(
    () => new Set(allSectionsList),
  );
  const [sectionSearch, setSectionSearch] = useState("");

  const [cardCount, setCardCount] = useState(20);
  const [doShuffle, setDoShuffle] = useState(true);

  // Keep selected sections synced if allSectionsList updates
  useEffect(() => {
    if (allSectionsList.length > 0) {
      setSelectedSections(new Set(allSectionsList));
    }
  }, [allSectionsList]);

  const isAllSectionsSelected =
    allSectionsList.length > 0 &&
    selectedSections.size === allSectionsList.length;

  const handleSelectAllSections = () => {
    setSelectedSections(new Set(allSectionsList));
  };

  const handleClearAllSections = () => {
    setSelectedSections(new Set());
  };

  const toggleSection = (sec) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sec)) {
        next.delete(sec);
      } else {
        next.add(sec);
      }
      return next;
    });
  };

  // Real-time calculation of available cards
  const availableQuestions = useMemo(() => {
    if (!course) return 0;

    let objCount = 0;
    if (
      selectedQuestionType === "all" ||
      selectedQuestionType === "objective"
    ) {
      if (
        hasSections &&
        selectedSections.size > 0 &&
        selectedSections.size < allSectionsList.length
      ) {
        let secSum = 0;
        selectedSections.forEach((s) => {
          secSum += course.sectionCounts?.[s] || 0;
        });

        if (
          selectedDifficulty &&
          course.difficultyCounts &&
          course.questionCount > 0
        ) {
          const ratio =
            (course.difficultyCounts[selectedDifficulty] || 0) /
            course.questionCount;
          objCount = Math.round(secSum * ratio);
        } else {
          objCount = secSum;
        }
      } else if (hasSections && selectedSections.size === 0) {
        objCount = 0;
      } else if (selectedDifficulty && course.difficultyCounts) {
        objCount = course.difficultyCounts[selectedDifficulty] || 0;
      } else {
        objCount = course.questionCount || 0;
      }
    }

    const thyCount =
      selectedQuestionType === "all" || selectedQuestionType === "theory"
        ? course.theoryQuestionCount || 0
        : 0;

    const fibCount =
      selectedQuestionType === "all" || selectedQuestionType === "fib"
        ? course.fibQuestionCount || 0
        : 0;

    return objCount + thyCount + fibCount;
  }, [
    course,
    selectedQuestionType,
    selectedDifficulty,
    selectedSections,
    allSectionsList,
    hasSections,
  ]);

  // Card count options dynamic filtering
  const QUESTION_COUNTS = [10, 20, 30, 50];
  const availableQuestionCounts = QUESTION_COUNTS.filter(
    (count) => count <= availableQuestions,
  );
  if (availableQuestions > 0 && !availableQuestionCounts.includes("All")) {
    availableQuestionCounts.push("All");
  }

  const countIcons = {
    10: FiZap,
    20: FiBookOpen,
    30: FiTarget,
    50: FaTrophy,
    All: FiRepeat,
  };

  const countSubtitles = {
    10: "Quick 5-min sprint",
    20: "Standard study deck",
    30: "Deep dive focus",
    50: "Mastery sprint",
    All: "Complete full deck",
  };

  const effectiveCardCount = Math.min(
    cardCount === "All" ? availableQuestions : cardCount || 20,
    availableQuestions,
  );

  const estimatedMinutes = Math.max(1, Math.ceil(effectiveCardCount * 0.6));

  const filteredSections = useMemo(() => {
    if (!sectionSearch.trim()) return allSectionsList;
    const q = sectionSearch.toLowerCase();
    return allSectionsList.filter((s) => s.toLowerCase().includes(q));
  }, [allSectionsList, sectionSearch]);

  const handleStart = () => {
    if (availableQuestions === 0) return;

    let types = [];
    if (selectedQuestionType === "all") {
      if (hasObjective) types.push("objective");
      if (hasTheory && isPremium) types.push("theory");
      if (hasFib) types.push("fib");
    } else {
      types = [selectedQuestionType];
    }

    const difficulties =
      selectedDifficulty &&
      (selectedQuestionType === "all" || selectedQuestionType === "objective")
        ? [selectedDifficulty]
        : null;

    const sections =
      hasSections &&
      (selectedQuestionType === "all" || selectedQuestionType === "objective")
        ? Array.from(selectedSections)
        : null;

    const finalCount =
      cardCount === "All"
        ? availableQuestions
        : Math.min(cardCount || 20, availableQuestions);

    onStart({
      types,
      difficulties,
      sections,
      cardCount: finalCount,
      doShuffle,
    });
  };

  const hasMultipleTypes =
    [hasObjective, hasTheory, hasFib].filter(Boolean).length > 1;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col lg:pb-[100px]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-md px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm active:scale-90 transition-all shrink-0"
            >
              <FiChevronLeft className="size-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                Flashcard Deck
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-semibold">
                {course?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-6 overflow-y-auto pb-36">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 1. HERO: Course Topics / Sections */}
          {hasSections && (
            <div className="bg-white dark:bg-slate-800 rounded-[1.75rem] p-5 sm:p-6 border border-gray-100 dark:border-slate-700 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    Topics to Study
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedSections.size} of {allSectionsList.length} topics selected
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      isAllSectionsSelected
                        ? handleClearAllSections
                        : handleSelectAllSections
                    }
                    className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 px-3 py-1 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200/60 dark:border-violet-800/40 transition-all active:scale-95"
                  >
                    {isAllSectionsSelected ? "Clear All" : "Select All"}
                  </button>
                </div>
              </div>

              {/* Dark-mode matched search bar if > 4 sections */}
              {allSectionsList.length > 4 && (
                <div className="relative">
                  <FiSearch
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    size={14}
                  />
                  <input
                    type="text"
                    value={sectionSearch}
                    onChange={(e) => setSectionSearch(e.target.value)}
                    placeholder="Search topics by keyword..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-gray-50 dark:bg-slate-700/60 border border-gray-200/80 dark:border-slate-600 text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                </div>
              )}

              {/* 2-Column Responsive Topic Chips without any scrollbars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
                {filteredSections.map((sec) => {
                  const isChecked = selectedSections.has(sec);
                  const count = course.sectionCounts?.[sec] || 0;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => toggleSection(sec)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 text-left active:scale-[0.98] ${
                        isChecked
                          ? "bg-violet-600/10 dark:bg-violet-500/15 border-violet-500/40 text-violet-950 dark:text-violet-200"
                          : "bg-gray-50/80 dark:bg-slate-750/50 border-gray-100 dark:border-slate-700/70 text-slate-500 dark:text-slate-400 opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`size-4.5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? "bg-violet-600 text-white shadow-xs"
                              : "border border-slate-300 dark:border-slate-600 text-transparent"
                          }`}
                        >
                          <FiCheck size={11} strokeWidth={3} />
                        </div>
                        <span className="text-xs font-bold truncate">
                          {sec}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isChecked
                            ? "bg-violet-200/60 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                            : "bg-gray-100 dark:bg-slate-700 text-slate-400 dark:text-slate-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Cards per Study Session */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                Cards per Session
              </h2>
              <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400">
                {availableQuestions} available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableQuestionCounts.map((count) => {
                const isAll = count === "All";
                const num = isAll ? availableQuestions : count;
                const locked = !isPremium && num > FREE_CARD_LIMIT;
                const isSelected =
                  (cardCount === "All" && isAll) || cardCount === count;
                const Icon = countIcons[count] ?? FiBookOpen;
                const subtitle = countSubtitles[count] ?? "Study cards";

                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => {
                      if (locked) return;
                      setCardCount(count);
                    }}
                    disabled={locked}
                    className={`group relative flex items-center gap-3.5 px-4 sm:px-5 py-3.5 rounded-2xl border transition-all duration-200 text-left active:scale-[0.98] ${
                      isAll ? "sm:col-span-2" : ""
                    } ${
                      locked
                        ? "border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "border-violet-600 dark:border-violet-500 bg-violet-50/50 dark:bg-violet-950/20 shadow-md shadow-violet-500/10"
                        : "border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40"
                    }`}
                  >
                    <div
                      className={`size-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                        locked
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          : isSelected
                          ? "bg-violet-600 text-white shadow-xs"
                          : "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className={`text-sm font-black transition-colors ${
                          isSelected
                            ? "text-violet-700 dark:text-violet-300"
                            : "text-slate-800 dark:text-white"
                        }`}
                      >
                        {isAll
                          ? `All (${availableQuestions} Cards)`
                          : `${count} Cards`}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                        {subtitle}
                      </span>
                    </div>

                    {locked && (
                      <div className="absolute top-2.5 right-2.5 bg-amber-500 rounded-full p-1 shadow-sm">
                        <FaCrown className="text-[7px] text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Study Preferences & Refinements (Secondary) */}
          <div className="bg-white dark:bg-slate-800 rounded-[1.75rem] p-5 sm:p-6 border border-gray-100 dark:border-slate-700 shadow-sm space-y-5">
            <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Study Preferences
            </h2>

            {/* Shuffle Toggle */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <FiShuffle size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Shuffle Cards
                  </h3>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    Randomize card order before review
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDoShuffle(!doShuffle)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none shrink-0 ${
                  doShuffle ? "bg-violet-600" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`size-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                    doShuffle ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Optional Card Format Filter (Quiet pill row, not giant hero) */}
            {hasMultipleTypes && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Card Format
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {selectedQuestionType === "all"
                      ? "All Formats"
                      : selectedQuestionType.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "all", label: "All Formats" },
                    { key: "objective", label: "Objective", disabled: !hasObjective },
                    { key: "fib", label: "FIB", disabled: !hasFib },
                    {
                      key: "theory",
                      label: "Theory",
                      disabled: !hasTheory,
                      isLocked: hasTheory && !isPremium,
                    },
                  ].map(({ key, label, disabled, isLocked }) => {
                    const isActive = selectedQuestionType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled || isLocked}
                        onClick={() => {
                          if (isLocked || disabled) return;
                          setSelectedQuestionType(key);
                        }}
                        className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? "bg-violet-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        } ${disabled || isLocked ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        {label}
                        {isLocked && (
                          <span className="inline-block ml-1">
                            <FaCrown className="inline text-[8px] text-amber-400 -mt-0.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Difficulty Filter */}
            {hasDifficulty && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Difficulty Level
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {selectedDifficulty || "All Levels"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: null, label: "All Levels" },
                    { key: "Easy", label: "Easy" },
                    { key: "Medium", label: "Medium" },
                    { key: "Hard", label: "Hard" },
                  ].map(({ key, label }) => {
                    const isActive = selectedDifficulty === key;
                    return (
                      <button
                        key={key ?? "all"}
                        type="button"
                        onClick={() => setSelectedDifficulty(key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? "bg-violet-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Session Estimate Banner */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/40 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-violet-800 dark:text-violet-300">
            <div className="flex items-center gap-2">
              <FiClock className="size-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <span>
                Est. Duration: ~{estimatedMinutes} min{estimatedMinutes !== 1 ? "s" : ""}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">
              {effectiveCardCount} cards queued
            </span>
          </div>

          {/* Empty state alert if 0 available */}
          {availableQuestions === 0 && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs font-semibold leading-relaxed">
              No flashcards match your current filter selection. Try selecting
              &ldquo;All Topics&rdquo; or clearing difficulty filters.
            </div>
          )}
        </div>
      </div>

      {/* 5. Start CTA (Sticky Bottom) */}
      <div className="fixed bottom-0 inset-x-0 px-6 lg:pl-64 py-4 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-100 dark:border-slate-800 z-20">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleStart}
            disabled={availableQuestions === 0}
            className="w-full py-4 rounded-2xl font-black text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 dark:shadow-none transition-all active:scale-[0.98] text-base flex items-center justify-center gap-2"
          >
            <span>Start Studying</span>
            {availableQuestions > 0 && (
              <span className="text-violet-200 text-sm font-medium">
                • {effectiveCardCount}{" "}
                {effectiveCardCount === 1 ? "Card" : "Cards"}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


// ─── Session Complete Screen ──────────────────────────────────────────────────
const SessionCompleteScreen = ({
  totalViewed,
  reviewCount,
  onReviewAgain,
  onFinish,
}) => (
  <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center px-6">
    <div className="w-full max-w-sm text-center">
      {/* Icon */}
      <div className="mx-auto mb-6 size-24 rounded-3xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shadow-lg shadow-violet-100 dark:shadow-none">
        <FiCheckCircle className="size-12 text-violet-600 dark:text-violet-400" />
      </div>

      <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
        Session Complete
      </h2>
      <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
        You studied {totalViewed} card{totalViewed !== 1 ? "s" : ""}
        {reviewCount > 0 ? `, ${reviewCount} marked for review` : "."}
      </p>

      <div className="flex gap-3">
        {reviewCount > 0 && (
          <button
            onClick={onReviewAgain}
            className="flex-1 py-4 rounded-2xl font-black text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 dark:shadow-none transition-all active:scale-95"
          >
            Review Again
          </button>
        )}
        <button
          onClick={onFinish}
          className={`flex-1 py-4 rounded-2xl font-black transition-all active:scale-95 ${
            reviewCount > 0
              ? "text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
              : "text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 dark:shadow-none"
          }`}
        >
          Finish
        </button>
      </div>
    </div>
  </div>
);

// ─── Study Session (the card experience) ─────────────────────────────────────
const StudySession = ({
  cards,
  course,
  isPremium,
  onFinish,
  onNavigatePremium,
}) => {
  const [queue, setQueue] = useState(() => [...cards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewSet, setReviewSet] = useState([]); // indices of "Need to Review" cards from original cards array
  const [viewedCount, setViewedCount] = useState(0);
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Touch / swipe support
  const touchStartX = useRef(null);
  const cardRef = useRef(null);

  const currentCard = queue[currentIndex] ?? null;
  const total = queue.length;

  // Derive contextual info for the card header
  const topic = currentCard?.topic || currentCard?.section || null;
  const difficulty = currentCard?.difficulty || null;
  const cardNum = currentIndex + 1;

  const handleFlip = () => setIsFlipped((f) => !f);

  const advance = useCallback(() => {
    setIsFlipped(false);
    const next = currentIndex + 1;
    if (next >= total) {
      setIsDone(true);
    } else {
      setCurrentIndex(next);
      setViewedCount((c) => c + 1);
    }
  }, [currentIndex, total]);

  const handleUseful = () => {
    advance();
  };

  const handleNeedReview = () => {
    // Track the original card for review set count
    setReviewSet((prev) => [...prev, currentCard]);
    // Push card to back of queue (append a copy)
    setQueue((prev) => {
      const newQueue = [...prev];
      newQueue.push(currentCard);
      return newQueue;
    });
    advance();
  };


  // Swipe left = next, swipe right = prev (only when not flipped and revealed)
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0 && isFlipped) advance(); // swipe left = next
    if (delta > 0 && currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setIsFlipped(false);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (!isFlipped) handleFlip();
        else advance();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        setCurrentIndex((i) => i - 1);
        setIsFlipped(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFlipped, currentIndex, advance]);

  if (isDone) {
    // How many unique "Need to Review" cards were marked
    const uniqueReviewIds = new Set(reviewSet.map((c) => c?.id));
    return (
      <SessionCompleteScreen
        totalViewed={viewedCount + 1}
        reviewCount={uniqueReviewIds.size}
        onReviewAgain={() => {
          // Build a deduplicated review deck
          const seen = new Set();
          const reviewCards = reviewSet.filter((c) => {
            if (seen.has(c?.id)) return false;
            seen.add(c?.id);
            return true;
          });
          setQueue(reviewCards);
          setCurrentIndex(0);
          setIsFlipped(false);
          setReviewSet([]);
          setViewedCount(0);
          setIsDone(false);
        }}
        onFinish={onFinish}
      />
    );
  }

  if (!currentCard) return null;

  // Premium gate check
  if (!isPremium && viewedCount >= FREE_CARD_LIMIT && showPremiumGate) {
    return (
      <PremiumGateOverlay onUpgrade={onNavigatePremium} onDismiss={onFinish} />
    );
  }

  const progress = (cardNum / total) * 100;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-500">
      {/* Premium gate */}
      {showPremiumGate && (
        <PremiumGateOverlay
          onUpgrade={onNavigatePremium}
          onDismiss={onFinish}
        />
      )}

      {/* Header */}
      {!focusMode ? (
        <div className="sticky top-0 z-30 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-md px-5 pt-6 pb-2">
          <div className="max-w-2xl mx-auto flex justify-between items-center mb-4">
            <button
              onClick={onFinish}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all"
            >
              <FiChevronLeft className="size-6 text-slate-600 dark:text-slate-300" />
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400 mb-0.5">
                Flashcards
              </span>
              <div className="font-black text-slate-900 dark:text-white">
                {cardNum}{" "}
                <span className="text-slate-400 font-medium">/ {total}</span>
              </div>
            </div>

            {/* Focus Mode toggle */}
            <button
              onClick={() => setFocusMode(true)}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all"
              aria-label="Enable focus mode"
              title="Focus Mode"
            >
              <FiEye className="size-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="max-w-2xl mx-auto">
            <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>) : <div className="h-30" />
      }

      {/* Focus mode exit button */}
      {focusMode && (
        <div className="fixed top-4 right-4 z-40">
          <button
            onClick={() => setFocusMode(false)}
            className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all"
            aria-label="Exit focus mode"
          >
            <FiEyeOff className="size-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
      )}

      {/* Card area */}
      <div className="flex-1 px-5 pt-4 pb-36 overflow-y-auto flex flex-col">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
          {/* Contextual info bar */}
          {!focusMode && (topic || difficulty) && (
            <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-300">
              {topic && (
                <span className="px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[11px] font-bold tracking-wide">
                  {topic}
                </span>
              )}
              {difficulty && (
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide ${
                    difficulty === "Easy"
                      ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                      : difficulty === "Hard"
                        ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {difficulty}
                </span>
              )}
            </div>
          )}

          {/* The flip card */}
          <div
            ref={cardRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="w-full"
          >
            <FlashCard
              question={currentCard}
              courseId={course?.id}
              isFlipped={isFlipped}
              onFlip={handleFlip}
            />
          </div>

          {/* "Did this help?" — only shown after reveal */}
          {isFlipped && (
            <div className="bg-white dark:bg-slate-800 rounded-[1.75rem] p-4 border border-gray-100 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-[11px] font-black uppercase tracking-widest text-center text-slate-400 dark:text-slate-500 mb-3">
                Did this help?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleNeedReview}
                  className="flex-1 py-3 rounded-2xl font-black text-sm text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 border border-gray-100 dark:border-slate-600 transition-all active:scale-95"
                >
                  👎 Need to Review
                </button>
                <button
                  onClick={handleUseful}
                  className="flex-1 py-3 rounded-2xl font-black text-sm text-white bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-200 dark:shadow-none transition-all active:scale-95"
                >
                  👍 Useful
                </button>
              </div>
            </div>
          )}

          {/* Swipe hint — only before first reveal, not in focus mode */}
          {!isFlipped && !focusMode && cardNum === 1 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 animate-in fade-in duration-500">
              Tap the card to reveal · Swipe to navigate
            </p>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 inset-x-0 px-6 py-3 z-40 lg:translate-x-31">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 p-3 rounded-[2.5rem] shadow-2xl flex items-center justify-between gap-3">
            <button
              onClick={() => {
                if (currentIndex > 0) {
                  setCurrentIndex((i) => i - 1);
                  setIsFlipped(false);
                }
              }}
              disabled={currentIndex === 0}
              className="size-14 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-20 transition-all active:scale-90"
            >
              <FiChevronLeft size={24} />
            </button>

            <button
              onClick={() => {
                if (!isPremium && viewedCount >= FREE_CARD_LIMIT) {
                  setShowPremiumGate(true);
                  return;
                }
                advance();
              }}
              className="flex-1 h-14 rounded-[1.8rem] font-black text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Next Card <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main FlashcardsScreen ────────────────────────────────────────────────────
const FlashcardsScreen = ({ courses, coursesLoading, isPremium }) => {
  const navigate = useNavigate();
  useDocumentTitle("Flashcards | QuizBolt");

  // phase: "pick" | "setup" | "loading" | "study"
  const [phase, setPhase] = useState("pick");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sessionCards, setSessionCards] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const handleCourseSelect = (course) => {
    setSelectedCourse(course);
    setPhase("setup");
  };

  const handleSetupStart = useCallback(
    async ({ types, difficulties, sections, cardCount, doShuffle }) => {
      if (!selectedCourse) return;
      setPhase("loading");
      setLoadError(null);

      try {
        const base =
          selectedCourse.questionsEndpoint ||
          `/courses/${selectedCourse.id}/questions`;
        const baseUrl = `${API_BASE_URL}${base}`;

        const buildUrl = (params = {}) => {
          const url = new URL(baseUrl, window.location.origin);
          Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null) url.searchParams.append(k, v);
          });
          return url.toString();
        };

        let allCards = [];

        // Fetch each requested type
        if (types.includes("objective")) {
          const totalCourseSections = Object.keys(selectedCourse.sectionCounts || {}).length;
          const hasSpecificSections =
            sections &&
            sections.length > 0 &&
            sections.length < totalCourseSections;

          if (hasSpecificSections) {
            // Fetch per section, combining with difficulty if single difficulty selected
            const fetches = await Promise.all(
              sections.map((s) => {
                const p = { section: s };
                if (difficulties && difficulties.length === 1) {
                  p.difficulty = difficulties[0];
                }
                return fetch(buildUrl(p));
              }),
            );
            const jsons = await Promise.all(fetches.map((r) => r.json()));
            fetches.forEach((r, i) => {
              if (r.ok && Array.isArray(jsons[i])) {
                allCards.push(...jsons[i]);
              }
            });
          } else if (difficulties && difficulties.length > 0) {
            // Fetch per difficulty
            const fetches = await Promise.all(
              difficulties.map((d) => fetch(buildUrl({ difficulty: d }))),
            );
            const jsons = await Promise.all(fetches.map((r) => r.json()));
            fetches.forEach((r, i) => {
              if (r.ok && Array.isArray(jsons[i])) {
                allCards.push(...jsons[i]);
              }
            });
          } else {
            const res = await fetch(buildUrl());
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) allCards.push(...data);
            }
          }
        }

        if (types.includes("theory")) {
          const res = await fetch(buildUrl({ type: "theory" }));
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data))
              allCards.push(...data.map((q) => ({ ...q, type: "theory" })));
          }
        }

        if (types.includes("fib")) {
          const res = await fetch(buildUrl({ type: "fib" }));
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data))
              allCards.push(...data.map((q) => ({ ...q, type: "fib" })));
          }
        }

        // Deduplicate by id
        const seen = new Set();
        allCards = allCards.filter((c) => {
          if (!c?.id || seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });

        if (allCards.length === 0) {
          setLoadError("No cards found for the selected filters.");
          setPhase("setup");
          return;
        }

        // Shuffle if requested
        const ordered = doShuffle ? shuffle(allCards) : allCards;

        // Slice to card count
        const picked = ordered.slice(0, cardCount);

        setSessionCards(picked);
        setPhase("study");
      } catch (err) {
        console.error("[Flashcards] fetch error:", err);
        setLoadError("Failed to load cards. Please try again.");
        setPhase("setup");
      }
    },
    [selectedCourse],
  );

  const handleFinish = () => {
    setPhase("pick");
    setSelectedCourse(null);
    setSessionCards([]);
    setLoadError(null);
  };

  // ── phase: pick ──
  if (phase === "pick") {
    return (
      <CoursePicker
        courses={courses}
        loading={coursesLoading}
        onSelect={handleCourseSelect}
        onBack={() => navigate("/")}
        title="Flashcards"
        subtitle="Pick a course to study"
        mode="flashcard"
      />
    );
  }

  // ── phase: setup ──
  if (phase === "setup") {
    return (
      <>
        {loadError && (
          <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-4 px-4 pointer-events-none">
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-semibold px-4 py-2.5 rounded-2xl shadow-sm pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
              {loadError}
            </div>
          </div>
        )}
        <SetupScreen
          course={selectedCourse}
          isPremium={isPremium}
          onBack={() => {
            setPhase("pick");
            setSelectedCourse(null);
            setLoadError(null);
          }}
          onStart={handleSetupStart}
        />
      </>
    );
  }

  // ── phase: loading ──
  if (phase === "loading") {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-ping" />
            <div className="relative size-16 rounded-3xl bg-white dark:bg-slate-800 border border-violet-100 dark:border-slate-700 flex items-center justify-center shadow-lg">
              <FiLoader className="size-8 text-violet-600 animate-spin" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Preparing your cards...
          </p>
        </div>
      </div>
    );
  }

  // ── phase: study ──
  if (phase === "study") {
    return (
      <StudySession
        cards={sessionCards}
        course={selectedCourse}
        isPremium={isPremium}
        onFinish={handleFinish}
        onNavigatePremium={() => navigate("/premium")}
      />
    );
  }

  return null;
};

export default FlashcardsScreen;
