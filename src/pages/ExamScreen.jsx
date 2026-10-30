import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import useDocumentTitle from "../hooks/useDocumentTitle";
import "swiper/css";
import { useNavigate } from "react-router-dom";
import ConfirmOverlay from "../components/ConfirmOverlay";
import LoadingScreen from "../components/LoadingScreen";
import { RenderMathText } from "../utils/RenderMathText";
import ProgressBar from "../components/ProgressBar";
import Timer from "../components/Timer";
import {
  clearExamSession,
  loadExamSession,
  saveExamSession,
} from "../utils/examSessionStorage";
import {
  FiChevronLeft,
  FiBookmark,
  FiSend,
  FiChevronRight,
  FiX,
  FiInfo,
} from "react-icons/fi";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import { FaCrown } from "react-icons/fa";
import {
  trackExamSubmit,
  trackExamTimeUp,
  trackExamExit,
  trackBookmarkToggle,
  trackPremiumGateHit,
} from "../utils/analytics";
import { gradeTheoryAnswer } from "../utils/theoryGrader";
import { gradeFibAnswer } from "../utils/fibGrader";

const FREE_FIB_LIMIT = 8;

// ─── Premium gate overlay (FIB) ──────────────────────────────────────────────
const FibPremiumGateOverlay = ({ onUpgrade, onQuit }) => (
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
          You&apos;ve answered {FREE_FIB_LIMIT} fill-in-the-blank questions.
          Upgrade to Premium for unlimited access.
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
            <FiX size={14} /> Quit Exam
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Pagination Strip ────────────────────────────────────────────────────────
const PaginationStrip = ({ total, currentIndex, answers, onSelect }) => {
  const swiperRef = useRef(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (swiperRef.current && !isMaximized) {
      swiperRef.current.slideTo(currentIndex, 300);
    }
  }, [currentIndex, isMaximized]);

  return (
    <div className="relative mt-5 mx-3">
      {/* Toggle button */}
      <button
        onClick={() => setIsMaximized(!isMaximized)}
        className="absolute -top-8 right-2 z-10 text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-800/90 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
      >
        {isMaximized ? "Minimize" : "Maximize"}
      </button>

      {/* Minimized state - original scrollable */}
      {!isMaximized && (
        <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 px-2 py-3 rounded-[1.75rem] shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-none overflow-hidden">
          {/* subtle top accent line so the strip reads as a distinct "navigator" module */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-200/70 dark:bg-slate-600/50" />

          <Swiper
            onSwiper={(swiper) => (swiperRef.current = swiper)}
            slidesPerView="auto"
            spaceBetween={8}
            slidesOffsetBefore={6}
            slidesOffsetAfter={6}
            slideToClickedSlide={true}
            onSlideClick={(swiper) => onSelect(swiper.clickedIndex)}
            className="!overflow-visible"
          >
            {Array.from({ length: total }).map((_, idx) => {
              const isActive = idx === currentIndex;
              const isAnswered = answers[idx] != null && answers[idx] !== "";

              return (
                <SwiperSlide key={idx} style={{ width: "auto" }}>
                  <button
                    onClick={() => onSelect(idx)}
                    aria-current={isActive}
                    aria-label={`Question ${idx + 1}${isAnswered ? ", answered" : ""}`}
                    className={`relative flex items-center justify-center rounded-xl font-bold text-[11px] shrink-0 select-none transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                      ${
                        isActive
                          ? "size-9 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                          : isAnswered
                            ? "size-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                            : "size-8 bg-slate-50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                  >
                    {idx + 1}
                    {/* tiny dot under answered (non-active) items — quieter than a full fill change */}
                    {isAnswered && !isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      )}

      {/* Maximized state - shows all squares at once */}
      {isMaximized && (
        <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-100 dark:border-slate-700/50 px-4 py-4 rounded-[1.75rem] shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-none animate-in fade-in zoom-in-95 duration-200">
          {/* subtle top accent line so the strip reads as a distinct "navigator" module */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-200/70 dark:bg-slate-600/50" />

          <div className="flex flex-wrap gap-2 justify-center">
            {Array.from({ length: total }).map((_, idx) => {
              const isActive = idx === currentIndex;
              const isAnswered = answers[idx] != null && answers[idx] !== "";

              return (
                <button
                  key={idx}
                  onClick={() => onSelect(idx)}
                  aria-current={isActive}
                  aria-label={`Question ${idx + 1}${isAnswered ? ", answered" : ""}`}
                  className={`relative flex items-center justify-center rounded-xl font-bold text-[11px] shrink-0 select-none transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                    ${
                      isActive
                        ? "size-9 bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                        : isAnswered
                          ? "size-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                          : "size-8 bg-slate-50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-500 ring-1 ring-slate-100 dark:ring-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                >
                  {idx + 1}
                  {/* tiny dot under answered (non-active) items — quieter than a full fill change */}
                  {isAnswered && !isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const calculateTotalTime = (questionCount, isMath, isTheory, isFib) => {
  if (isTheory) return questionCount * 4.5 * 60; // 4m30s per theory question
  if (isFib) return Math.ceil((questionCount / 10) * 3.5 * 60); // 4min per 10 fib questions
  const timePer10 = isMath ? 6 * 60 : 3.33 * 60;
  return Math.ceil((questionCount / 10) * timePer10);
};

// Theory grading handled by ../utils/theoryGrader.js


const isTheoryQuestion = (q) =>
  q?.type === "theory" || Array.isArray(q?.keywords);

const isFibQuestion = (q) => q?.type === "fib" || Array.isArray(q?.answers);

// FIB grading handled by ../utils/fibGrader.js


// Split question text on _____ sequences, return array of parts
const splitFibQuestion = (text) => text.split(/_{2,}/g);

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** Plain-text length for MCQ options (math delimiters stripped). */
const getOptionPlainLength = (option) => {
  const text = typeof option === "string" ? option : String(option ?? "");
  return text
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
};

const getOptionTextSizeClass = (option, viewportTier = "mobile") => {
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

const getTimeLeftFromEndsAtMs = (endsAtMs) => {
  if (!Number.isFinite(endsAtMs)) return null;
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
};

const DEFAULT_PERSIST_INTERVAL_MS = 15000;

const ExamScreen = ({
  answers,
  setAnswers,
  questions,
  onSubmit,
  selectedCourse,
  setSelectedCourse,
  bookmarks,
  setBookmarks,
  hasRetaken,
  questionsLoading,
  isPremium,
  autoAdvance,
  shuffleOptions,
  unlimitedHints,
  showPagination,
  userProfile,
  questionType,
  questionsContext,
}) => {
  const courseCode = selectedCourse?.id || selectedCourse?.code;
  useDocumentTitle(courseCode ? `${courseCode} Exam | QuizBolt` : "Exam | QuizBolt");
  const isMathCourse = selectedCourse?.id === "MTH101";
  const isTheoryExam = questionType === "theory";
  const isFibExam = questionType === "fib";
  const navigate = useNavigate();

  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const getViewportTier = () => {
    if (typeof window === "undefined") return "mobile";
    if (window.matchMedia("(min-width: 1024px)").matches) return "desktop";
    if (window.matchMedia("(min-width: 640px)").matches) return "tablet";
    return "mobile";
  };
  const [viewportTier, setViewportTier] = useState(getViewportTier);

  const savedSession = useMemo(() => loadExamSession(), []);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const savedIndex = savedSession?.currentIndex;
    if (typeof savedIndex === "number" && savedIndex >= 0) return savedIndex;
    return 0;
  });

  const [endsAtMs, setEndsAtMs] = useState(() => {
    const savedTimeLeft = savedSession?.timeLeft;
    if (typeof savedTimeLeft === "number" && savedTimeLeft > 0) {
      return Date.now() + savedTimeLeft * 1000;
    }

    const v = savedSession?.endsAtMs;
    return Number.isFinite(v) ? v : null;
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const savedTimeLeft = savedSession?.timeLeft;
    if (typeof savedTimeLeft === "number" && savedTimeLeft > 0) {
      return savedTimeLeft;
    }

    const fromEnds = getTimeLeftFromEndsAtMs(savedSession?.endsAtMs);
    if (typeof fromEnds === "number") return fromEnds;

    return 0;
  });
  const timeLeftRef = useRef(timeLeft);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const [isSubmitOverlayOpen, setSubmitOverlayOpen] = useState(false);
  const [isExitOverlayOpen, setExitOverlayOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [isFibGateOpen, setFibGateOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // Set of question IDs whose hints have been revealed this session
  const [hintsUsed, setHintsUsed] = useState(() => {
    try {
      const s = savedSession?.hintsUsed;
      return Array.isArray(s) ? new Set(s) : new Set();
    } catch {
      return new Set();
    }
  });

  const [kbHeight, setKbHeight] = useState(0);

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

  useEffect(() => {
    const desktopQuery = window.matchMedia(
      "(min-width: 640px), (min-width: 1024px)",
    );
    const handleChange = () => setViewportTier(getViewportTier());

    setViewportTier(getViewportTier());
    desktopQuery.addEventListener("change", handleChange);
    return () => desktopQuery.removeEventListener("change", handleChange);
  }, []);

  const hasMatchingQuestions =
    questionsContext?.courseId === selectedCourse?.id &&
    questionsContext?.questionType === questionType;

  // Ignore stale question arrays while a different course/type is loading.
  const totalQuestions = hasMatchingQuestions
    ? shuffledQuestions.length || questions.length
    : 0;
  const totalTime = useMemo(
    () =>
      calculateTotalTime(totalQuestions, isMathCourse, isTheoryExam, isFibExam),
    [totalQuestions, isMathCourse, isTheoryExam, isFibExam],
  );

  const currentQuestion = shuffledQuestions[currentIndex];
  const selectedOption = answers[currentIndex];
  const isBookmarked = bookmarks.includes(currentQuestion?.id);
  const FREE_BOOKMARK_LIMIT = 5;
  const isBookmarkLocked =
    !isPremium && !isBookmarked && bookmarks.length >= FREE_BOOKMARK_LIMIT;

  useEffect(() => {
    if (!hasMatchingQuestions) {
      setShuffledQuestions([]);
      setCurrentIndex(0);
      setEndsAtMs(null);
      setTimeLeft(0);
      return;
    }

    // 1. Try to restore an in-progress exam from localStorage
    if (
      Array.isArray(savedSession?.questions) &&
      savedSession.questions.length
    ) {
      // ✅ VALIDATE: Only restore if course AND question type match
      const savedCourseId = savedSession?.selectedCourse?.id;
      const currentCourseId = selectedCourse?.id;
      const savedQuestionType = savedSession?.questionType ?? "objective";
      const sessionMatches =
        savedCourseId === currentCourseId && savedQuestionType === questionType;

      if (sessionMatches) {
        setShuffledQuestions(savedSession.questions);
        setCurrentIndex(
          typeof savedSession.currentIndex === "number" &&
            savedSession.currentIndex >= 0
            ? savedSession.currentIndex
            : 0,
        );

        if (Array.isArray(savedSession.answers)) {
          setAnswers(savedSession.answers);
        }

        if (Array.isArray(savedSession.hintsUsed)) {
          setHintsUsed(new Set(savedSession.hintsUsed));
        }

        const savedTimeLeft =
          typeof savedSession.timeLeft === "number" && savedSession.timeLeft > 0
            ? savedSession.timeLeft
            : null;
        if (savedTimeLeft != null) {
          setEndsAtMs(Date.now() + savedTimeLeft * 1000);
          setTimeLeft(savedTimeLeft);
        } else if (!Number.isFinite(savedSession.endsAtMs)) {
          setEndsAtMs(null);
        }

        return; // session is valid, skip fresh exam setup
      }

      // ❌ Session is stale (different course or type) — discard it
      clearExamSession();
    }

    // 2. Fresh exam – shuffle options and start a new session
    if (
      hasMatchingQuestions &&
      questions.length > 0 &&
      shuffledQuestions.length === 0
    ) {
      // shuffleOptions defaults to true; premium users can disable it
      const shouldShuffle = shuffleOptions !== false;
      const shuffled = questions.map((q) => ({
        ...q,
        options:
          shouldShuffle && Array.isArray(q.options)
            ? shuffleArray([...q.options])
            : q.options,
      }));
      setShuffledQuestions(shuffled);
    }
  }, [
    questions,
    savedSession,
    setAnswers,
    shuffledQuestions.length,
    selectedCourse?.id,
    questionType,
    hasMatchingQuestions,
    shuffleOptions,
  ]);

  // Ensure we always have an endsAtMs when exam starts/resumes.
  useEffect(() => {
    if (!totalQuestions) return;
    if (Number.isFinite(endsAtMs)) return;

    const baseTimeLeft =
      typeof timeLeft === "number" && timeLeft > 0 ? timeLeft : totalTime;
    const nextEndsAt = Date.now() + baseTimeLeft * 1000;
    setEndsAtMs(nextEndsAt);
    setTimeLeft(baseTimeLeft);
  }, [endsAtMs, timeLeft, totalQuestions, totalTime]);

  const persistMetaRef = useRef({ lastWriteMs: 0 });

  const buildSessionPayload = useCallback(() => {
    const effectiveTimeLeft =
      getTimeLeftFromEndsAtMs(endsAtMs) ??
      (typeof timeLeftRef.current === "number" ? timeLeftRef.current : 0);

    return {
      version: 2,
      selectedCourse,
      questionType,
      questions: shuffledQuestions.length ? shuffledQuestions : questions,
      answers,
      currentIndex,
      hasRetaken,
      timeLeft: effectiveTimeLeft,
      hintsUsed: Array.from(hintsUsed),
    };
  }, [
    answers,
    currentIndex,
    hasRetaken,
    endsAtMs,
    questions,
    questionType,
    selectedCourse,
    shuffledQuestions,
    hintsUsed,
  ]);

  const persistExamSessionThrottled = useCallback(
    ({ force = false } = {}) => {
      if (!totalQuestions) return;
      const now = Date.now();
      const { lastWriteMs } = persistMetaRef.current;
      if (!force && now - lastWriteMs < DEFAULT_PERSIST_INTERVAL_MS) return;

      persistMetaRef.current.lastWriteMs = now;
      saveExamSession(buildSessionPayload());
    },
    [buildSessionPayload, totalQuestions],
  );

  // Persist immediately on key progress changes (but without per-second writes).
  useEffect(() => {
    persistExamSessionThrottled({ force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, currentIndex, shuffledQuestions, selectedCourse, hintsUsed]);

  // Persist time periodically + on page hide/unload (reliable refresh resume, minimal drift).
  useEffect(() => {
    if (!totalQuestions || !Number.isFinite(endsAtMs)) return;

    const id = setInterval(() => {
      persistExamSessionThrottled();
    }, DEFAULT_PERSIST_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistExamSessionThrottled({ force: true });
      }
    };

    const onBeforeUnload = () => {
      persistExamSessionThrottled({ force: true });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      if (!isSubmittingRef.current) {
        persistExamSessionThrottled({ force: true });
      }
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [endsAtMs, persistExamSessionThrottled, totalQuestions]);

  const saveResultToSupabase = async (finalTime, correctCount) => {
    try {
      let {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        session = data.session;
      }

      const user = session?.user;
      if (!user) throw new Error("User not authenticated");

      let { error } = await supabase.from("exam_attempts").insert({
        user_id: user.id,
        course_id: selectedCourse.id,
        score: correctCount,
        total_questions: totalQuestions,
        time_taken: finalTime,
        is_retake: hasRetaken,
        university: userProfile?.university || null,
        type: isTheoryExam ? "THY" : isFibExam ? "FIB" : "OBJ",
      });

      if (error?.message?.toLowerCase().includes("jwt")) {
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError) throw refreshError;

        const retryUser = refreshData.session?.user;
        if (!retryUser) throw new Error("Retry failed: no user");

        const retry = await supabase.from("exam_attempts").insert({
          user_id: retryUser.id,
          course_id: selectedCourse.id,
          score: correctCount,
          total_questions: totalQuestions,
          time_taken: finalTime,
          is_retake: hasRetaken,
          university: userProfile?.university || null,
          type: isTheoryExam ? "THY" : isFibExam ? "FIB" : "OBJ",
        });

        if (retry.error) throw retry.error;
      } else if (error) {
        throw error;
      }

      return true;
    } catch (_error) {
      // Failed to save online (e.g. offline / poor network)
      return false;
    }
  };

  const handleBookmarkClick = async () => {
    if (!currentQuestion?.id) return;
    setBookmarks((prev) => {
      const isCurrentlyBookmarked = prev.includes(currentQuestion.id);
      const updated = isCurrentlyBookmarked
        ? prev.filter((id) => id !== currentQuestion.id)
        : [...prev, currentQuestion.id];

      trackBookmarkToggle(currentQuestion.id, !isCurrentlyBookmarked);

      // Persist to Supabase in the background
      (async () => {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("profiles")
              .update({ bookmarks: updated })
              .eq("id", user.id);
          }
        } catch (err) {
          console.error("Failed to sync bookmark:", err);
        }
      })();

      return updated;
    });
  };

  const onOptionClick = (option) => {
    setAnswers((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next[currentIndex] = option;
      return next;
    });

    // Only auto-advance if the preference is enabled
    if (autoAdvance) {
      setTimeout(() => {
        setCurrentIndex((prev) => {
          if (prev < totalQuestions - 1) return prev + 1;
          setSubmitOverlayOpen(true);
          return prev;
        });
      }, 200); // small delay for UX smoothness
    }
  };

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitOverlayOpen(false);
    setIsSubmitting(true);

    const finalTime = totalTime - timeLeft;

    const correctCount = shuffledQuestions.reduce((acc, q, idx) => {
      if (isTheoryQuestion(q)) {
        return acc + gradeTheoryAnswer(answers[idx], q.keywords, q.model_answer); // fractional 0-1
      }
      if (isFibQuestion(q)) {
        return acc + gradeFibAnswer(answers[idx], q.answers); // fractional 0-1
      }
      return acc + (answers[idx] === q.correct ? 1 : 0);
    }, 0);

    let savedOnline = false;
    try {
      const res = await withTimeout(
        saveResultToSupabase(finalTime, correctCount),
        10000,
        "Saving results took too long.",
      );
      savedOnline = Boolean(res);
    } catch (_err) {
      savedOnline = false;
    }

    if (onSubmit) onSubmit(correctCount, shuffledQuestions.length, finalTime);
    clearExamSession();
    trackExamSubmit(
      selectedCourse.id,
      correctCount,
      shuffledQuestions.length,
      finalTime,
      questionType,
    );
    navigate("/results", { state: { savedOnline } });
  };

  const handleTimeUp = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const finalTime = totalTime - timeLeft;

    const correctCount = shuffledQuestions.reduce((acc, q, idx) => {
      if (isTheoryQuestion(q)) {
        return acc + gradeTheoryAnswer(answers[idx], q.keywords, q.model_answer); // fractional 0-1
      }
      if (isFibQuestion(q)) {
        return acc + gradeFibAnswer(answers[idx], q.answers); // fractional 0-1
      }
      return acc + (answers[idx] === q.correct ? 1 : 0);
    }, 0);

    let savedOnline = false;
    try {
      const res = await withTimeout(
        saveResultToSupabase(finalTime, correctCount),
        10000,
        "Saving results took too long.",
      );
      savedOnline = Boolean(res);
    } catch (_err) {
      savedOnline = false;
    }

    if (onSubmit) onSubmit(correctCount, shuffledQuestions.length, finalTime);
    clearExamSession();
    trackExamTimeUp(
      selectedCourse.id,
      answers.filter(Boolean).length,
      shuffledQuestions.length,
    );
    navigate("/results", { state: { savedOnline } });
  };

  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  // Hint limit: 3 for 30–50 questions, 5 for more than 50.
  // Premium users with unlimitedHints on have no cap.
  const hintLimit =
    isPremium && unlimitedHints ? Infinity : totalQuestions > 50 ? 5 : 3;
  const hintsRemaining =
    hintLimit === Infinity ? Infinity : hintLimit - hintsUsed.size;
  const currentQuestionHintRevealed = hintsUsed.has(currentQuestion?.id);

  // Collapse hint whenever the user moves to a different question
  useEffect(() => {
    setShowHint(false);
  }, [currentIndex]);

  // Show a loading screen while questions are being fetched or prepared
  if (
    questionsLoading ||
    !hasMatchingQuestions ||
    shuffledQuestions.length === 0 ||
    !currentQuestion
  ) {
    return <LoadingScreen text="Preparing questions" />;
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-500 flex flex-col">
      {/* SUBMITTING LOADING OVERLAY */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="flex gap-1.5">
            <div className="h-8 w-1.5 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-blue-600"></div>
            <div className="h-8 w-1.5 animate-[loading_1s_ease-in-out_0.1s_infinite] rounded-full bg-blue-500"></div>
            <div className="h-8 w-1.5 animate-[loading_1s_ease-in-out_0.2s_infinite] rounded-full bg-blue-400"></div>
          </div>
          <h2 className="mt-6 text-sm font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
            Submitting Exam
          </h2>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="sticky top-0 z-30 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-md px-5 pt-6 pb-2">
        <div className="max-w-2xl mx-auto flex justify-between items-center mb-4">
          <button
            onClick={() => {
              setExitOverlayOpen(true);
              trackExamExit(selectedCourse.id, currentIndex, totalQuestions);
            }}
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 active:scale-90 transition-all"
          >
            <FiChevronLeft className="-translate-x-1/18 size-6 text-slate-600 dark:text-slate-300" />
          </button>

          <div className="absolute left-1/2 flex flex-col items-center -translate-x-1/2">
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

          <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
            <Timer
              endsAtMs={endsAtMs}
              timeLeft={timeLeft}
              onTick={setTimeLeft}
              onTimeUp={handleTimeUp}
            />
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <ProgressBar progress={progress} />
        </div>
      </div>

      {/* QUESTION CONTENT */}
      <div className="flex-1 px-5 pb-32 pt-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-gray-50 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                {selectedCourse.name}{" "}
                {isFibExam ? "· FIB" : isTheoryExam ? "· Theory" : ""}
              </div>
              <div className="flex items-center gap-2">
                {currentQuestion?.hint && (
                  <button
                    onClick={() => {
                      if (showHint) {
                        // toggling off is always free
                        setShowHint(false);
                        return;
                      }
                      // Already revealed this question's hint before — free re-open
                      if (currentQuestionHintRevealed) {
                        setShowHint(true);
                        return;
                      }
                      // First reveal — consume a hint slot if available
                      if (hintsRemaining <= 0) return;
                      setHintsUsed(
                        (prev) => new Set([...prev, currentQuestion.id]),
                      );
                      setShowHint(true);
                    }}
                    disabled={
                      !showHint &&
                      !currentQuestionHintRevealed &&
                      hintsRemaining <= 0
                    }
                    className={`relative p-2 rounded-xl transition-all ${
                      showHint
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                        : !currentQuestionHintRevealed && hintsRemaining <= 0
                          ? "bg-gray-50 dark:bg-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed"
                          : "bg-gray-50 dark:bg-slate-700 text-gray-400"
                    }`}
                    aria-label={showHint ? "Hide hint" : "Show hint"}
                    title={
                      !showHint &&
                      !currentQuestionHintRevealed &&
                      hintsRemaining <= 0
                        ? "No hints remaining"
                        : showHint
                          ? "Hide hint"
                          : `Show hint (${hintsRemaining} remaining)`
                    }
                  >
                    <FiInfo className="size-5" />
                    {!currentQuestionHintRevealed &&
                      hintsRemaining > 0 &&
                      hintsRemaining !== Infinity &&
                      !showHint && (
                        <span className="absolute -top-1 -right-1 size-4 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center">
                          {hintsRemaining}
                        </span>
                      )}
                  </button>
                )}
                <button
                  onClick={
                    isBookmarkLocked
                      ? () => {
                          setPremiumOverlayOpen(true);
                          trackPremiumGateHit("bookmark");
                        }
                      : handleBookmarkClick
                  }
                  className={`relative p-2 rounded-xl transition-all ${isBookmarked ? "bg-yellow-100 text-yellow-600" : "bg-gray-50 dark:bg-slate-700 text-gray-400"} ${isBookmarkLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <FiBookmark
                    className={`size-5 ${isBookmarked ? "fill-current" : ""}`}
                  />
                  {isBookmarkLocked && (
                    <div className="absolute -top-1 -right-1 bg-amber-400 dark:bg-yellow-500 rounded-full p-1 border-2 border-gray-50 dark:border-slate-900 shadow-sm flex items-center justify-center">
                      <FaCrown className="text-[8px] text-white" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="lg:text-xl font-bold text-slate-800 dark:text-slate-100 leading-relaxed mb-5">
              {isFibQuestion(currentQuestion) ? (
                <span className="leading-[2.4]">
                  {splitFibQuestion(currentQuestion.question).map(
                    (part, i, arr) => {
                      const blanks = Array.isArray(selectedOption)
                        ? selectedOption
                        : [];
                      return (
                        <span key={i}>
                          <RenderMathText
                            text={part}
                            courseId={selectedCourse?.id}
                          />
                          {i < arr.length - 1 && (
                            <input
                              type="text"
                              value={blanks[i] ?? ""}
                              size={Math.max(6, (blanks[i] ?? "").length + 2)}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAnswers((prev) => {
                                  const next = Array.isArray(prev)
                                    ? [...prev]
                                    : [];
                                  const cur = Array.isArray(next[currentIndex])
                                    ? [...next[currentIndex]]
                                    : [];
                                  cur[i] = val;
                                  next[currentIndex] = cur;
                                  return next;
                                });
                              }}
                              className="inline mx-1 bg-transparent border-b-2 border-blue-500 dark:border-blue-400 text-blue-700 dark:text-blue-300 font-bold text-base focus:outline-none focus:border-blue-700 dark:focus:border-blue-300 transition-colors text-center"
                            />
                          )}
                        </span>
                      );
                    },
                  )}
                </span>
              ) : (
                <RenderMathText
                  text={currentQuestion?.question ?? ""}
                  courseId={selectedCourse?.id}
                />
              )}
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
                      {hintsRemaining === Infinity
                        ? "Unlimited hints"
                        : `${hintsRemaining} hint${hintsRemaining !== 1 ? "s" : ""} remaining`}
                    </p>
                  </div>
                </div>
              )}
              {isTheoryQuestion(currentQuestion) ? (
                <textarea
                  value={selectedOption ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAnswers((prev) => {
                      const next = Array.isArray(prev) ? [...prev] : [];
                      next[currentIndex] = val;
                      return next;
                    });
                  }}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium p-4 text-sm resize-none focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                />
              ) : isFibQuestion(currentQuestion) ? null : (
                (currentQuestion?.options ?? []).map((option, index) => {
                  const isSelected = selectedOption === option;
                  const label = String.fromCharCode(65 + index);
                  const optionSizeClass = getOptionTextSizeClass(
                    option,
                    viewportTier,
                  );

                  return (
                    <button
                      key={index}
                      onClick={() => onOptionClick(option)}
                      className={`group w-full flex items-center gap-2 p-2 rounded-3xl border-2 transition-all duration-300 active:scale-[0.98] ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/50 dark:bg-blue-600/10"
                          : "border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600"
                      }`}
                    >
                      <div
                        className={`size-10 shrink-0 rounded-2xl flex items-center justify-center font-black transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {label}
                      </div>
                      <div
                        className={`min-w-0 flex-1 text-left font-semibold ${optionSizeClass} ${isSelected ? "text-blue-700 dark:text-blue-400" : "text-slate-600 dark:text-slate-300"}`}
                      >
                        <RenderMathText
                          text={option}
                          courseId={selectedCourse?.id}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Pagination strip below question card */}
          {showPagination && (
            <PaginationStrip
              total={shuffledQuestions.length}
              currentIndex={currentIndex}
              answers={answers}
              onSelect={(idx) => {
                if (isFibExam && !isPremium && idx >= FREE_FIB_LIMIT) {
                  setFibGateOpen(true);
                  return;
                }
                setCurrentIndex(idx);
              }}
            />
          )}
        </div>
      </div>

      {/* BOTTOM NAVIGATION BAR */}
      <div
        className="fixed bottom-0 inset-x-0 px-6 lg:pl-70 py-2 z-40 transition-all duration-200"
        style={{ bottom: kbHeight }}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {/* Prev / Next row */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 p-3 rounded-[2.5rem] shadow-2xl flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setCurrentIndex((prev) => Math.max(0, prev - 1));
              }}
              disabled={currentIndex === 0}
              className="size-14 rounded-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-20 transition-all active:scale-90"
            >
              <FiChevronLeft size={24} />
            </button>

            {currentIndex === totalQuestions - 1 ? (
              <button
                onClick={() => setSubmitOverlayOpen(true)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white h-14 rounded-[1.8rem] font-black text-lg shadow-lg shadow-green-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <span>Submit Quiz</span>
                <FiSend />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (
                    isFibExam &&
                    !isPremium &&
                    currentIndex >= FREE_FIB_LIMIT - 1
                  ) {
                    setFibGateOpen(true);
                    return;
                  }
                  setCurrentIndex((prev) =>
                    Math.min(totalQuestions - 1, prev + 1),
                  );
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-14 rounded-[1.8rem] font-black shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Next Question</span>
                <FiChevronRight />
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmOverlay
        isOpen={isSubmitOverlayOpen}
        onClose={() => setSubmitOverlayOpen(false)}
        onConfirm={handleSubmit}
        title="Submit Exam?"
        message="Review your answers before submitting. You cannot go back after this!"
        confirmText="Yes, Submit"
        cancelText="Review"
      />

      <ConfirmOverlay
        isOpen={isExitOverlayOpen}
        onClose={() => setExitOverlayOpen(false)}
        onConfirm={() => {
          isSubmittingRef.current = true;
          clearExamSession();
          navigate(isPremium ? -1 : "/");
          setSelectedCourse(null);
        }}
        title="Quit Exam?"
        message="Your current progress will be lost. Are you sure?"
        confirmText="Quit"
        cancelText="Stay"
        danger={true}
      />

      <ConfirmOverlay
        isOpen={isPremiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Bookmark This Question"
        message="Save important questions to revisit later. Free users can view up to 5 bookmarks — upgrade for unlimited saves and full review."
        confirmText="Upgrade to Premium"
        cancelText="Not now"
      />

      {isFibGateOpen && (
        <FibPremiumGateOverlay
          onUpgrade={() => navigate("/premium")}
          onQuit={() => {
            setFibGateOpen(false);
            clearExamSession();
            navigate(isPremium ? -1 : "/");
            setSelectedCourse(null);
          }}
        />
      )}
    </div>
  );
};

export default ExamScreen;
