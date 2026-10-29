import useDocumentTitle from "../hooks/useDocumentTitle";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../apiConfig";
import { supabase } from "../supabaseClient";
import CoursePicker from "../components/CoursePicker";
import { RenderMathText } from "../utils/RenderMathText";
import ProgressBar from "../components/ProgressBar";
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiSend,
  FiLoader,
  FiCheckCircle,
  FiXCircle,
  FiX,
  FiInfo,
  FiCheck,
  FiZap,
  FiBookOpen,
  FiTarget,
  FiRepeat,
  FiLayers,
  FiLock,
} from "react-icons/fi";
import { FaCrown, FaTrophy } from "react-icons/fa";
import { withTimeout } from "../utils/withTimeout";
import { gradeTheoryAnswer, parseKeywords } from "../utils/theoryGrader";
import { gradeFibAnswer } from "../utils/fibGrader";
const FREE_QUESTION_LIMIT = 11;

// ─── Premium gate overlay ─────────────────────────────────────────────────────
const PremiumGateOverlay = ({ onUpgrade, onQuit }) => (
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
          You&apos;ve answered {FREE_QUESTION_LIMIT} questions. Upgrade to
          Premium for unlimited tests and full access.
        </p>
        <div className="flex flex-col w-full gap-3">
          <button
            onClick={onUpgrade}
            className="w-full py-4 rounded-2xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <FaCrown size={14} /> Go Premium
          </button>
          <button
            onClick={onQuit}
            className="w-full py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <FiX size={14} /> Quit Test
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── helpers ─────────────────────────────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Theory grading handled by ../utils/theoryGrader.js


// FIB grading handled by ../utils/fibGrader.js


const isTheory = (q) => q?.type === "theory" || Array.isArray(q?.keywords);
const isFib = (q) => q?.type === "fib" || Array.isArray(q?.answers);
const splitFib = (text) => text.split(/_{2,}/g);

const gradeQuestion = (q, answer) => {
  if (isTheory(q)) return gradeTheoryAnswer(answer, q.keywords, q.model_answer);
  if (isFib(q)) return gradeFibAnswer(answer, q.answers);
  return answer === q.correct ? 1 : 0;
};

const getResult = (q, answer) => {
  const grade = gradeQuestion(q, answer);
  if (grade >= 1) return "correct";
  if (grade > 0) return "partial";
  return "wrong";
};

const QUESTION_COUNTS = [10, 20, 30, 50];

// ─── FeedbackBadge shown after answering ─────────────────────────────────────
const FeedbackBadge = ({ result }) => {
  if (result === "correct")
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-black text-sm animate-in fade-in zoom-in-95 duration-300">
        <FiCheckCircle className="size-4" /> Correct!
      </div>
    );
  if (result === "partial")
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-black text-sm animate-in fade-in zoom-in-95 duration-300">
        <FiCheckCircle className="size-4" /> Partial
      </div>
    );
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-black text-sm animate-in fade-in zoom-in-95 duration-300">
      <FiXCircle className="size-4" /> Wrong
    </div>
  );
};

// ─── SectionDropdown ──────────────────────────────────────────────────────────
const SectionDropdown = ({ sections, selected, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceNeeded = 256; // max-h-64 is 256px
    setDropUp(spaceBelow < spaceNeeded && rect.top > spaceNeeded);
  }, [open]);

  const options = [{ key: null, label: "All Sections" }, ...sections];
  const current = options.find((o) => o.key === selected) ?? options[0];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-slate-600"
      >
        <div className="size-8 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <FiLayers className="size-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="flex-1 text-left text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {current.label}
        </span>
        <FiChevronDown
          className={`size-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-[80] w-full max-h-64 overflow-y-auto rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 py-1.5 animate-in fade-in ${dropUp
              ? "bottom-full mb-2 slide-in-from-bottom-1"
              : "top-full mt-2 slide-in-from-top-1"
            } duration-150`}
        >
          {options.map((opt) => {
            const isActive = selected === opt.key;
            return (
              <button
                key={opt.key ?? "all"}
                type="button"
                onClick={() => {
                  onSelect(opt.key);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-left transition-colors ${isActive
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
                    : "text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  }`}
              >
                <span className="truncate">{opt.label}</span>
                {isActive && <FiCheck className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── QuestionCountPicker ──────────────────────────────────────────────────────
const QuestionCountPicker = ({
  isPremium,
  onSelect,
  onBack,
  courseName,
  course,
  selectedQuestionType,
  onSelectQuestionType,
  selectedDifficulty,
  onSelectDifficulty,
  selectedSection,
  onSelectSection,
}) => {
  const getAvailableQuestions = () => {
    let objectiveBase = course?.questionCount || 0;
    if (selectedDifficulty) {
      objectiveBase = course?.difficultyCounts?.[selectedDifficulty] || 0;
    }
    if (selectedSection) {
      objectiveBase = course?.sectionCounts?.[selectedSection] || 0;
    }

    switch (selectedQuestionType) {
      case "all":
        return (
          objectiveBase +
          (course?.theoryQuestionCount || 0) +
          (course?.fibQuestionCount || 0)
        );
      case "objective":
        return objectiveBase;
      case "theory":
        return course?.theoryQuestionCount || 0;
      case "fib":
        return course?.fibQuestionCount || 0;
      default:
        return objectiveBase;
    }
  };

  const hasDifficultyQuestions =
    course?.difficultyCounts &&
    Object.values(course.difficultyCounts).reduce((a, b) => a + b, 0) > 0;
  const hasSectionQuestions =
    course?.sectionCounts &&
    Object.values(course.sectionCounts).reduce((a, b) => a + b, 0) > 0;

  const availableQuestions = getAvailableQuestions();
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

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-md px-6 pt-6 pb-4 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm active:scale-90 transition-all"
          >
            <FiChevronLeft className="size-5 text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Test Mode
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {courseName}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-8 flex flex-col items-center">
        <div className="w-full max-w-2xl space-y-7">
          {/* Question Type Selector */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
              Question Type
            </p>
            <div className="grid grid-cols-4 gap-1.5 bg-white dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700/60 rounded-2xl p-1.5 shadow-sm">
              {[
                { key: "all", label: "All" },
                { key: "objective", label: "Objective" },
                { key: "fib", label: "FIB" },
                { key: "theory", label: "Theory" },
              ].map(({ key, label }) => {
                const isLocked = key === "theory" && !isPremium;
                const isActive = selectedQuestionType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (isLocked) return;
                      onSelectQuestionType(key);
                      if (key !== "all" && key !== "objective") {
                        onSelectDifficulty(null);
                        onSelectSection(null);
                      }
                    }}
                    className={`relative py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 ${isActive
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                        : "text-slate-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                      } ${isLocked ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {label}
                    {isLocked && (
                      <div className="absolute -top-1.5 -right-1 bg-amber-500 rounded-full p-1 shadow-sm">
                        <FaCrown className="text-[6px] text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty Selector */}
          {hasDifficultyQuestions &&
            (selectedQuestionType === "all" ||
              selectedQuestionType === "objective") && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
                  Difficulty
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: null, label: "All" },
                    { key: "Easy", label: "Easy" },
                    { key: "Medium", label: "Medium" },
                    { key: "Hard", label: "Hard" },
                  ].map(({ key, label }) => {
                    const isActive = selectedDifficulty === key;
                    return (
                      <button
                        key={key ?? "all"}
                        type="button"
                        onClick={() => onSelectDifficulty(key)}
                        className={`px-4 py-2 rounded-full text-xs font-bold border transition-all duration-200 ${isActive
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20"
                            : "bg-white dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-600"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-1">
                  {(() => {
                    const count = selectedDifficulty
                      ? course.difficultyCounts[selectedDifficulty] || 0
                      : course.questionCount || 0;
                    return `${count} objective question${count !== 1 ? "s" : ""} available`;
                  })()}
                </p>
              </div>
            )}

          {/* Section Selector — dropdown, scales to any number of sections */}
          {hasSectionQuestions &&
            (selectedQuestionType === "all" ||
              selectedQuestionType === "objective") && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1">
                  Section
                </p>
                <SectionDropdown
                  sections={Object.keys(course.sectionCounts).map((s) => ({
                    key: s,
                    label: s,
                  }))}
                  selected={selectedSection}
                  onSelect={onSelectSection}
                />
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 px-1">
                  {(() => {
                    const count = selectedSection
                      ? course.sectionCounts[selectedSection] || 0
                      : course.questionCount || 0;
                    return `${count} objective question${count !== 1 ? "s" : ""} available`;
                  })()}
                </p>
              </div>
            )}

          {/* Question Count Selector */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between px-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                How many questions?
              </p>
              <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                {availableQuestions} available
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {availableQuestionCounts.map((count) => {
                const isAll = count === "All";
                const num = isAll ? availableQuestions : count;
                const locked = !isPremium && num > 10;
                const Icon = countIcons[count] ?? FiBookOpen;
                return (
                  <button
                    key={count}
                    onClick={() => (locked ? null : onSelect(num))}
                    disabled={locked}
                    className={`group relative flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.97] ${isAll ? "col-span-2" : ""
                      } ${locked
                        ? "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40 opacity-60 cursor-not-allowed"
                        : "border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5"
                      }`}
                  >
                    <div
                      className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${locked
                          ? "bg-gray-100 dark:bg-slate-700"
                          : "bg-blue-50 dark:bg-blue-500/10"
                        }`}
                    >
                      <Icon
                        className={`size-5 ${locked ? "text-slate-400" : "text-blue-600 dark:text-blue-400"}`}
                      />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                        {isAll ? "All" : count}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                        {isAll ? `${num} questions` : "Questions"}
                      </span>
                    </div>
                    {locked && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-full shrink-0">
                        <FaCrown size={9} /> PRO
                      </span>
                    )}
                    {!locked && (
                      <FiChevronRight className="ml-auto text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </button>
                );
              })}
              {availableQuestionCounts.length === 0 && (
                <div className="col-span-2 py-10 text-center rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    No questions available for this type
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const TestModeScreen = ({
  courses,
  coursesLoading,
  isPremium,
  userProfile,
}) => {
  const navigate = useNavigate();

  // phase: "pick" | "count" | "test" | "done"
  const [phase, setPhase] = useState("pick");
  const [selectedCourse, setSelectedCourse] = useState(null);
  useDocumentTitle(selectedCourse?.id || selectedCourse?.code ? `${selectedCourse.id || selectedCourse.code} Weekly Test | QuizBolt` : "Weekly Test | QuizBolt");
  const [questionCount, setQuestionCount] = useState(null); // eslint-disable-line no-unused-vars
  const [questionType, setQuestionType] = useState("all"); // "all" | "objective" | "theory" | "fib"
  const [selectedDifficulty, setSelectedDifficulty] = useState(null); // null (all) | "Easy" | "Medium" | "Hard"
  const [selectedSection, setSelectedSection] = useState(null); // null (all) | section name

  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [errorQ, setErrorQ] = useState(null);

  // answers[i] = the user's answer for question i (undefined = unanswered)
  const [answers, setAnswers] = useState([]);
  // answered[i] = true once the user has submitted an answer for question i
  const [answered, setAnswered] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentInput, setCurrentInput] = useState(undefined);

  const isSubmittingRef = useRef(false);
  const [showPremiumGate, setShowPremiumGate] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  // Hint state (no limits!)
  const [showHint, setShowHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(new Set());

  // Viewport tier for dynamic option text sizes
  const getViewportTier = () => {
    if (typeof window === "undefined") return "mobile";
    if (window.matchMedia("(min-width: 1024px)").matches) return "desktop";
    if (window.matchMedia("(min-width: 640px)").matches) return "tablet";
    return "mobile";
  };
  const [viewportTier, setViewportTier] = useState(getViewportTier);

  // Helper function to get plain text length of options
  const getOptionPlainLength = (option) => {
    const text = typeof option === "string" ? option : String(option ?? "");
    return text
      .replace(/\$[^$]*\$/g, " ")
      .replace(/\s+/g, " ")
      .trim().length;
  };

  // Updated getOptionTextSizeClass that uses viewport tier
  const getOptionTextSizeClass = (option) => {
    const len = getOptionPlainLength(option);
    const limits = {
      mobile: { compact: 60, relaxed: 45 },
      tablet: { compact: 100, relaxed: 72 },
      desktop: { compact: 120, relaxed: 92 },
    };
    const { compact, relaxed } = limits[viewportTier] ?? limits.mobile;
    if (len >= compact) return "text-xs leading-snug";
    if (len >= relaxed) return "text-sm leading-snug";
    return "";
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbHeight(height);
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);

  // Update viewport tier on resize
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 640px), (min-width: 1024px)");
    const handleChange = () => setViewportTier(getViewportTier());
    setViewportTier(getViewportTier());
    desktopQuery.addEventListener("change", handleChange);
    return () => desktopQuery.removeEventListener("change", handleChange);
  }, []);

  // Reset showHint when moving to a new question
  useEffect(() => {
    setShowHint(false);
  }, [currentIndex]);

  // ── fetch questions ──
  const fetchQuestions = useCallback(async (course, count, type, difficulty, section) => {
    setLoadingQ(true);
    setErrorQ(null);
    try {
      const base = `${API_BASE_URL}${course.questionsEndpoint || `/courses/${course.id}/questions`}`;
      let questionsData = [];

      // Build query params helper
      const buildUrl = (baseUrl, params = {}) => {
        const url = new URL(baseUrl, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, value);
          }
        });
        return url.toString();
      };

      if (type === "all") {
        // Fetch all types, only apply difficulty/section to objective
        const [objRes, thyRes, fibRes] = await Promise.all([
          fetch(buildUrl(base, { difficulty, section })),
          fetch(buildUrl(base, { type: "theory" })),
          fetch(buildUrl(base, { type: "fib" })),
        ]);
        const [objData, thyData, fibData] = await Promise.all([
          objRes.json(),
          thyRes.json(),
          fibRes.json(),
        ]);
        const objective = objRes.ok && Array.isArray(objData) ? objData : [];
        const theory =
          thyRes.ok && Array.isArray(thyData)
            ? thyData.map((q) => ({ ...q, type: "theory" }))
            : [];
        const fib =
          fibRes.ok && Array.isArray(fibData)
            ? fibData.map((q) => ({ ...q, type: "fib" }))
            : [];
        questionsData = [...objective, ...theory, ...fib];
      } else if (type === "objective") {
        const res = await fetch(buildUrl(base, { difficulty, section }));
        if (res.ok) {
          const data = await res.json();
          questionsData = Array.isArray(data) ? data : [];
        }
      } else if (type === "theory") {
        const res = await fetch(buildUrl(base, { type: "theory" }));
        if (res.ok) {
          const data = await res.json();
          questionsData = Array.isArray(data)
            ? data.map((q) => ({ ...q, type: "theory" }))
            : [];
        }
      } else if (type === "fib") {
        const res = await fetch(buildUrl(base, { type: "fib" }));
        if (res.ok) {
          const data = await res.json();
          questionsData = Array.isArray(data)
            ? data.map((q) => ({ ...q, type: "fib" }))
            : [];
        }
      }

      const all = shuffle([...questionsData]);
      if (all.length === 0)
        throw new Error("No questions found for this course.");
      const picked = all.slice(0, count).map((q) => ({
        ...q,
        options: Array.isArray(q.options) ? shuffle([...q.options]) : undefined,
      }));
      setQuestions(picked);
      setAnswers(new Array(picked.length).fill(undefined));
      setAnswered(new Array(picked.length).fill(false));
      setCurrentIndex(0);
      setCurrentInput(undefined);
    } catch (err) {
      setErrorQ(err.message || "Failed to load questions.");
    } finally {
      setLoadingQ(false);
    }
  }, []);

  const handleCourseSelect = (course) => {
    setSelectedCourse(course);
    setSelectedDifficulty(null);
    setSelectedSection(null);
    setPhase("count");
  };

  const handleCountSelect = (count) => {
    setQuestionCount(count);
    setPhase("test");
    fetchQuestions(selectedCourse, count, questionType, selectedDifficulty, selectedSection);
  };

  // ── answer submission for current question ──
  const handleAnswerSubmit = () => {
    if (answered[currentIndex]) return;
    const ans = currentInput;
    setAnswers((prev) => {
      const n = [...prev];
      n[currentIndex] = ans;
      return n;
    });
    setAnswered((prev) => {
      const n = [...prev];
      n[currentIndex] = true;
      // trigger premium gate for free users after FREE_QUESTION_LIMIT answers
      if (!isPremium) {
        const newCount = n.filter(Boolean).length;
        if (newCount >= FREE_QUESTION_LIMIT) setShowPremiumGate(true);
      }
      return n;
    });
  };

  // When navigating to a question, restore its input
  useEffect(() => {
    if (answered[currentIndex]) {
      setCurrentInput(answers[currentIndex]);
    } else {
      setCurrentInput(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const currentQuestion = questions[currentIndex];
  const currentQuestionHintRevealed = hintsUsed.has(currentQuestion?.id);
  const hintsRemaining = Infinity;
  const isAnswered = answered[currentIndex];
  const totalQuestions = questions.length;
  const progress = totalQuestions
    ? ((currentIndex + 1) / totalQuestions) * 100
    : 0;
  const allAnswered = answered.every(Boolean);

  const answeredIndices = answered
    .map((a, i) => (a ? i : null))
    .filter((i) => i !== null);

  const accuracyPercent =
    answeredIndices.length === 0
      ? null
      : Math.round(
        (answeredIndices.reduce(
          (acc, i) => acc + gradeQuestion(questions[i], answers[i]),
          0,
        ) /
          answeredIndices.length) *
        100,
      );

  const ringColor =
    accuracyPercent === null
      ? "text-slate-300 dark:text-slate-600"
      : accuracyPercent >= 80
        ? "text-green-500"
        : accuracyPercent >= 50
          ? "text-amber-500"
          : "text-red-400";

  const RING_RADIUS = 16;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const ringDashoffset =
    RING_CIRCUMFERENCE -
    ((accuracyPercent ?? 0) / 100) * RING_CIRCUMFERENCE;

  // ── save result and navigate ──
  const handleFinish = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const score = questions.reduce(
      (acc, q, i) => acc + gradeQuestion(q, answers[i]),
      0,
    );

    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const { data } = await supabase.auth.refreshSession();
        session = data.session;
      }
      const user = session?.user;
      if (user) {
        const { error } = await withTimeout(
          supabase.from("test_attempts").insert({
            user_id: user.id,
            course_id: selectedCourse.id,
            score: parseFloat(score.toFixed(2)),
            total_questions: totalQuestions,
            university: userProfile?.university || null,
          }),
          15000,
          "Saving result took too long.",
        );
        if (error?.message?.toLowerCase().includes("jwt")) {
          const { data: rd } = await supabase.auth.refreshSession();
          await supabase.from("test_attempts").insert({
            user_id: rd.session.user.id,
            course_id: selectedCourse.id,
            score: parseFloat(score.toFixed(2)),
            total_questions: totalQuestions,
            university: userProfile?.university || null,
          });
        }
      }
    } catch (err) {
      console.error("Failed to save test attempt:", err);
    }

    navigate("/test-result", {
      state: {
        score: parseFloat(
          questions
            .reduce((acc, q, i) => acc + gradeQuestion(q, answers[i]), 0)
            .toFixed(2),
        ),
        totalQuestions,
        courseId: selectedCourse.id,
        courseName: selectedCourse.name,
        answers,
        questions,
        university: userProfile?.university || null,
      },
    });
  };

  // ── phase: pick ──
  if (phase === "pick") {
    return (
      <CoursePicker
        courses={courses}
        loading={coursesLoading}
        onSelect={handleCourseSelect}
        onBack={() => navigate("/")}
        title="Test Mode"
        subtitle="Pick a course to test yourself"
        mode="test"
        rightButton={
          <button
            type="button"
            onClick={() => navigate("/test-leaderboard")}
            className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shadow-sm active:scale-90 transition-all"
            aria-label="View Test Leaderboard"
            title="View Test Leaderboard"
          >
            <FaTrophy className="size-5" />
          </button>
        }
      />
    );
  }

  // ── phase: count ──
  if (phase === "count") {
    return (
      <QuestionCountPicker
        isPremium={isPremium}
        onSelect={handleCountSelect}
        onBack={() => setPhase("pick")}
        courseName={selectedCourse?.name}
        course={selectedCourse}
        selectedQuestionType={questionType}
        onSelectQuestionType={setQuestionType}
        selectedDifficulty={selectedDifficulty}
        onSelectDifficulty={setSelectedDifficulty}
        selectedSection={selectedSection}
        onSelectSection={setSelectedSection}
      />
    );
  }

  // ── loading ──
  if (loadingQ || (!currentQuestion && !errorQ)) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
            <div className="relative size-16 rounded-3xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-slate-700 flex items-center justify-center shadow-lg">
              <FiLoader className="size-8 text-blue-600 animate-spin" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Preparing your test...
          </p>
        </div>
      </div>
    );
  }

  // ── error ──
  if (errorQ) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <p className="text-slate-500 dark:text-slate-400">{errorQ}</p>
          <button
            onClick={() => setPhase("pick")}
            className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── phase: test ──
  const isObjQ = !isTheory(currentQuestion) && !isFib(currentQuestion);
  const isThyQ = isTheory(currentQuestion);
  const isFibQ = isFib(currentQuestion);
  const result = isAnswered
    ? getResult(currentQuestion, answers[currentIndex])
    : null;

  // For FIB, currentInput is an array
  const fibBlanks = isFibQ
    ? Array.isArray(currentInput)
      ? currentInput
      : []
    : [];
  const fibParts = isFibQ ? splitFib(currentQuestion.question) : [];

  const canSubmit = isAnswered
    ? false
    : isObjQ
      ? currentInput !== undefined
      : isThyQ
        ? typeof currentInput === "string" && currentInput.trim().length > 0
        : fibBlanks.some((b) => (b || "").trim().length > 0);

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-500">
      {/* Premium gate overlay */}
      {showPremiumGate && (
        <PremiumGateOverlay
          onUpgrade={() => navigate("/premium")}
          onQuit={() => {
            setShowPremiumGate(false);
            setPhase("pick");
          }}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-md px-5 pt-6 pb-2">
        <div className="max-w-2xl mx-auto flex justify-between items-center mb-4">
          <button
            onClick={() => setPhase("pick")}
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all"
          >
            <FiChevronLeft className="size-6 text-slate-600 dark:text-slate-300" />
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-0.5">
              Progress
            </span>
            <div className="font-black text-slate-900 dark:text-white">
              {currentIndex + 1}{" "}
              <span className="text-slate-400 font-medium">
                / {totalQuestions}
              </span>
            </div>
          </div>
          <div className="relative size-11 shrink-0">
            <svg viewBox="0 0 40 40" className="size-11 -rotate-90">
              <circle
                cx="20"
                cy="20"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="4"
                className="stroke-gray-100 dark:stroke-slate-700"
              />
              <circle
                cx="20"
                cy="20"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="4"
                strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringDashoffset}
                className={`${ringColor} transition-all duration-500 ease-out`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                {accuracyPercent === null ? "—" : `${accuracyPercent}%`}
              </span>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <ProgressBar progress={progress} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 px-5 pb-32 pt-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-gray-50 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                {selectedCourse?.name}
                {isThyQ ? " · Theory" : isFibQ ? " · FIB" : ""}
              </div>
              <div className="flex items-center gap-2">
                {/* Hint button */}
                {currentQuestion?.hint && (
                  <button
                    type="button"
                    onClick={() => {
                      if (showHint) {
                        setShowHint(false);
                        return;
                      }
                      if (currentQuestionHintRevealed) {
                        setShowHint(true);
                        return;
                      }
                      setHintsUsed(
                        (prev) => new Set([...prev, currentQuestion.id]),
                      );
                      setShowHint(true);
                    }}
                    className={`relative p-2 rounded-xl transition-all ${
                      showHint
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        : "bg-gray-50 dark:bg-slate-700 text-gray-400"
                    }`}
                    aria-label={showHint ? "Hide hint" : "Show hint"}
                    title={
                      showHint
                        ? "Hide hint"
                        : "Show hint (unlimited hints available)"
                    }
                  >
                    <FiInfo className="size-5" />
                  </button>
                )}
                {isAnswered && <FeedbackBadge result={result} />}
              </div>
            </div>

            <div className="space-y-4">
              {/* Hint panel — only for questions that have a hint */}
              {currentQuestion?.hint && showHint && (
                <div className="flex gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <FiInfo
                    className="shrink-0 mt-0.5 text-amber-500 dark:text-amber-400"
                    size={16}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
                      <RenderMathText
                        text={currentQuestion.hint}
                        courseId={selectedCourse?.id}
                      />
                    </p>
                    <p className="text-[10px] font-bold text-amber-500 dark:text-amber-600 mt-1.5 uppercase tracking-wider">
                      Unlimited hints
                    </p>
                  </div>
                </div>
              )}

              {/* Question text */}
              <div className="lg:text-xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                {isFibQ ? (
                  <span className="leading-[2.4]">
                    {fibParts.map((part, i, arr) => (
                      <span key={i}>
                        <RenderMathText
                          text={part}
                          courseId={selectedCourse?.id}
                        />
                        {i < arr.length - 1 && (
                          <input
                            type="text"
                            value={fibBlanks[i] ?? ""}
                            disabled={isAnswered}
                            size={Math.max(6, (fibBlanks[i] ?? "").length + 2)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCurrentInput((prev) => {
                                const cur = Array.isArray(prev)
                                  ? [...prev]
                                  : [];
                                cur[i] = val;
                                return cur;
                              });
                            }}
                            className="inline mx-1 bg-transparent border-b-2 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-bold text-base focus:outline-none focus:border-blue-700 transition-colors text-center disabled:opacity-70"
                          />
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  <RenderMathText
                    text={currentQuestion?.question ?? ""}
                    courseId={selectedCourse?.id}
                  />
                )}
              </div>

              {/* Answer area */}
              <div className="space-y-3">
                {isThyQ ? (
                  <textarea
                    value={typeof currentInput === "string" ? currentInput : ""}
                    disabled={isAnswered}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    placeholder="Type your answer here..."
                    rows={5}
                    className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium p-4 text-sm resize-none focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-70"
                  />
                ) : isObjQ ? (
                  (currentQuestion?.options ?? []).map((option, idx) => {
                    const label = String.fromCharCode(65 + idx);
                    const optionSizeClass = getOptionTextSizeClass(option);
                    const isSelected =
                      currentInput === option ||
                      (isAnswered && answers[currentIndex] === option);
                    const isRight =
                      isAnswered && option === currentQuestion.correct;
                    const isWrong =
                      isAnswered &&
                      isSelected &&
                      option !== currentQuestion.correct;

                    return (
                      <button
                        key={idx}
                        disabled={isAnswered}
                        onClick={() => {
                          if (!isAnswered) {
                            setCurrentInput(option);
                          }
                        }}
                        className={`group w-full flex items-center gap-2 p-2 rounded-3xl border-2 transition-all duration-300 active:scale-[0.98] disabled:cursor-default ${
                          isRight
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : isWrong
                              ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                              : isSelected
                                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-600/10"
                                : "border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600"
                        }`}
                      >
                        <div
                          className={`size-10 shrink-0 rounded-2xl flex items-center justify-center font-black transition-colors ${
                            isRight
                              ? "bg-green-500 text-white"
                              : isWrong
                                ? "bg-red-400 text-white"
                                : isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-slate-700 text-slate-500"
                          }`}
                        >
                          {label}
                        </div>
                        <div
                          className={`min-w-0 flex-1 text-left font-semibold ${optionSizeClass} ${isRight ? "text-green-700 dark:text-green-400" : isWrong ? "text-red-600 dark:text-red-400" : isSelected ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-300"}`}
                        >
                          <RenderMathText
                            text={option}
                            courseId={selectedCourse?.id}
                          />
                        </div>
                      </button>
                    );
                  })
                ) : null}
              </div>

              {/* Theory/FIB correct answer reveal */}
              {isAnswered && (isThyQ || isFibQ) && (
                <div
                  className={`p-4 rounded-2xl border-2 ${result === "correct" ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : result === "partial" ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"}`}
                >
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                    Correct Answer
                  </p>
                  {isThyQ ? (
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      {currentQuestion.model_answer ||
                        `Key points: ${parseKeywords(currentQuestion.keywords)
                          .map((group) =>
                            typeof group === "object" && group?.primary
                              ? group.primary
                              : Array.isArray(group)
                              ? group[0]
                              : group,
                          )
                          .join(", ")}`}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                      {(currentQuestion.answers || [])
                        .map((g) => (Array.isArray(g) ? g[0] : g))
                        .join(" / ")}
                    </p>
                  )}
                </div>
              )}
              {/* Reason for objective questions (when incorrect) — premium-gated */}
              {isAnswered &&
                isObjQ &&
                result !== "correct" &&
                currentQuestion.reason && (
                  <div className="relative rounded-2xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden">
                    <div
                      className={`p-4 bg-amber-50 dark:bg-amber-900/20 transition-all duration-300 ${
                        !isPremium
                          ? "blur-sm select-none pointer-events-none"
                          : ""
                      }`}
                    >
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
                        Reason
                      </p>
                      <div className="text-sm text-slate-700 dark:text-slate-200">
                        <RenderMathText
                          text={currentQuestion.reason}
                          courseId={selectedCourse?.id}
                        />
                      </div>
                    </div>

                    {!isPremium && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-[1px] px-4">
                        <div className="size-9 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shadow-sm">
                          <FiLock className="size-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center">
                          Explanation locked
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate("/premium")}
                          className="px-4 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all"
                        >
                          Go Premium to view
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        className="fixed bottom-0 inset-x-0 px-6 lg:pl-64 py-2 z-40 transition-all duration-200"
        style={{ bottom: kbHeight }}
      >
        <div className="max-w-2xl mx-auto bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 p-3 rounded-[2.5rem] shadow-2xl flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setCurrentIndex((p) => Math.max(0, p - 1));
            }}
            disabled={currentIndex === 0}
            className="size-14 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-20 transition-all active:scale-90"
          >
            <FiChevronLeft size={24} />
          </button>

          {!isAnswered ? (
            <button
              onClick={handleAnswerSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-blue-600 disabled:opacity-40 text-white h-14 rounded-[1.8rem] font-black shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Submit Answer
            </button>
          ) : allAnswered && currentIndex === totalQuestions - 1 ? (
            <button
              onClick={handleFinish}
              className="flex-1 bg-green-600 text-white h-14 rounded-[1.8rem] font-black shadow-lg shadow-green-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>See Results</span>
              <FiSend />
            </button>
          ) : (
            <button
              onClick={() => {
                if (currentIndex < totalQuestions - 1)
                  setCurrentIndex((p) => p + 1);
                else if (allAnswered) handleFinish();
              }}
              className="flex-1 bg-blue-600 text-white h-14 rounded-[1.8rem] font-black shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {currentIndex === totalQuestions - 1 && allAnswered ? (
                <>
                  <span>See Results</span>
                  <FiSend />
                </>
              ) : (
                <>
                  <span>Next</span>
                  <FiChevronRight />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestModeScreen;
