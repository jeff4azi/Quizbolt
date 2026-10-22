import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  FaChevronDown,
  FaCrown,
  FaGlobeAfrica,
  FaMedal,
  FaSlidersH,
  FaTimes,
  FaTrophy,
  FaUniversity,
  FaBook,
} from "react-icons/fa";
import { FiCheck } from "react-icons/fi";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import QuickViewSheet from "../components/QuickViewSheet";
import Avatar from "../components/Avatar";
import { usePresence } from "../hooks/usePresence";

// ─── CourseDropdown ──────────────────────────────────────────────────────────
const CourseDropdown = ({ options, selected, onSelect }) => {
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

  const current = options.find((o) => o.id === selected) ?? options[0];

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full h-12 flex items-center gap-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-slate-600"
      >
        <div className="size-8 shrink-0 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <FaBook className="size-4 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="flex-1 text-left text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {current.label}
        </span>
        <FaChevronDown
          className={`size-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-[80] w-full max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-slate-900/10 py-1.5 animate-in fade-in ${
            dropUp 
              ? "bottom-full mb-2 slide-in-from-bottom-1" 
              : "top-full mt-2 slide-in-from-top-1"
          } duration-150`}
        >
          {options.map((opt) => {
            const isActive = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm font-semibold text-left transition-colors ${
                  isActive
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
import { useNavigate } from "react-router-dom";
import ConfirmOverlay from "../components/ConfirmOverlay";
import NavBar from "../components/NavBar";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import SectionLoader from "../components/SectionLoader";
import {
  buildLeaderboardEntries,
  compareLeaderboardEntries,
} from "../utils/leaderboardRanking";

const getCurrentWeekStartIso = () => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day; // how many days since Sunday
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff,
    0,
    0,
    0,
    0,
  );
  return weekStart.toISOString();
};

const LeaderboardScreen = ({
  courses,
  isPremium: isUserPremium,
  userProfile,
}) => {
  useDocumentTitle("Leaderboard | QuizBolt");
  const [attempts, setAttempts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [universityFilter, setUniversityFilter] = useState("mine");
  const [questionCountFilter, setQuestionCountFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [examType, setExamType] = useState("OBJ");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const levelOptions = ["all", "100", "200", "300", "400"];

  const normalizeLevel = (year) => {
    const value = String(year ?? "").trim();
    if (!value) return null;
    return value.length === 1 ? `${value}00` : value;
  };

  const questionCountOptions =
    examType === "THY"
      ? ["all", 3, 5, 7, 10]
      : examType === "FIB"
        ? ["all", 10, 15, 20, 30]
        : ["all", 30, 50, 70, 100];

  useEffect(() => {
    setSelectedCourseId("all");
    setQuestionCountFilter("all");
  }, [universityFilter]);

  useEffect(() => {
    setQuestionCountFilter("all");
  }, [examType]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetProfile, setSheetProfile] = useState(null);
  const [sheetStats, setSheetStats] = useState(null);
  const [sheetIsPremium, setSheetIsPremium] = useState(false);

  const navigate = useNavigate();

  const fetchLeaderboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAttempts([]); // clear stale data immediately so old type doesn't show

    try {
      const weekStartIso = getCurrentWeekStartIso();

      const { data: attemptsData, error: attemptsError } = await withTimeout(
        supabase
          .from("exam_attempts")
          .select(
            `
            id,
            user_id,
            course_id,
            score,
            total_questions,
            time_taken,
            date_taken,
            is_retake,
            university,
            type
          `,
          )
          .eq("is_retake", false)
          .eq("type", examType)
          .gte("date_taken", weekStartIso),
        15000,
        "Loading leaderboard took too long. Please try again.",
      );

      if (attemptsError) {
        console.error(
          "Failed to fetch leaderboard attempts:",
          attemptsError.message,
          attemptsError.details,
        );
        setAttempts([]);
        setProfiles({});
        setLoading(false);
        return;
      }

      const safeAttempts = (attemptsData || []).filter(
        (a) => (a.type ?? "OBJ") === examType,
      );
      setAttempts(safeAttempts);

      const userIds = Array.from(
        new Set(safeAttempts.map((a) => a.user_id).filter(Boolean)),
      );

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await withTimeout(
          supabase
            .from("profiles")
            .select(
              "id, full_name, user_name, year, college, is_premium, avatar_url, department, current_streak, best_streak, last_study_date",
            )
            .in("id", userIds),
          15000,
          "Loading leaderboard profiles took too long.",
        );

        if (profilesError) {
          console.error(
            "Failed to fetch leaderboard profiles:",
            profilesError.message,
          );
          setProfiles({});
        } else {
          const profileMap = {};
          (profilesData || []).forEach((p) => {
            profileMap[p.id] = {
              full_name: p.full_name,
              user_name: p.user_name,
              year: p.year,
              college: p.college,
              avatar_url: p.avatar_url,
              isPremium: p.is_premium === true,
              department: p.department || "General Studies",
              university: p.university?.trim(),
              currentStreak: p.current_streak || 0,
              bestStreak: p.best_streak || 0,
              lastStudyDate: p.last_study_date || null,
            };
          });
          setProfiles(profileMap);
        }
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error("Leaderboard fetch error:", err.message);
      setError(
        "We couldn't load the leaderboard right now. Please try again shortly.",
      );
      setAttempts([]);
      setProfiles({});
    } finally {
      setLoading(false);
    }
  }, [examType]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  // Re-fetch leaderboard whenever the tab regains focus after being idle/hidden
  useVisibilityRefresh(fetchLeaderboardData);

  const courseOptions = useMemo(() => {
    if (!Array.isArray(courses) || courses.length === 0) {
      return [{ id: "all", label: "All Courses" }];
    }

    const deduped = [];
    const seen = new Set();

    courses.forEach((c) => {
      const id = c.id ?? c.course_id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      deduped.push({
        id,
        label: c.name || c.title || c.code || "Course",
      });
    });

    return [{ id: "all", label: "All Courses" }, ...deduped];
  }, [courses]);

  const leaderboardEntries = useMemo(() => {
    if (!attempts.length) return [];

    // 1. University filter
    const universityFiltered =
      universityFilter === "mine"
        ? attempts.filter((a) => {
            const attemptUni = (a.university ?? "").trim().toLowerCase();
            const userUni = (userProfile?.university ?? "")
              .trim()
              .toLowerCase();
            if (!userUni) return true; // no university set — show all
            if (!attemptUni) return false; // attempt has no university — exclude
            return attemptUni === userUni;
          })
        : attempts;

    // 2. Course filter
    const courseFiltered =
      selectedCourseId === "all"
        ? universityFiltered
        : universityFiltered.filter((a) => a.course_id === selectedCourseId);

    // 3. Question count filter
    const filteredAttempts =
      questionCountFilter === "all"
        ? courseFiltered
        : courseFiltered.filter(
            (a) => Number(a.total_questions) === questionCountFilter,
          );

    const entries = buildLeaderboardEntries(filteredAttempts).map((entry) => {
      const avgTimeSeconds =
        entry.attemptsCount > 0
          ? Math.round(entry.totalTime / entry.attemptsCount)
          : 0;

      const profile = profiles[entry.userId] || {};
      const fullName = profile.full_name || "Scholar";
      const userName = profile.user_name || null;
      const year = profile.year || "1";

      return {
        ...entry,
        bestPercent: Math.round(entry.bestPercent),
        avgTimeSeconds,
        fullName, // primary display name
        userName, // handle/slug (not used as display fallback)
        year,
        university: entry.university,
        avatarUrl: profile.avatar_url || null,
        isPremium: profile.isPremium === true,
        department: profile.department,
      };
    });

    const levelFilteredEntries =
      levelFilter === "all"
        ? entries
        : entries.filter((entry) => normalizeLevel(entry.year) === levelFilter);

    levelFilteredEntries.sort(compareLeaderboardEntries);

    return levelFilteredEntries;
  }, [
    attempts,
    profiles,
    selectedCourseId,
    universityFilter,
    userProfile,
    questionCountFilter,
    levelFilter,
  ]);

  const formatTime = (seconds) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const leaderboardUserIds = useMemo(
    () => leaderboardEntries.map((e) => e.userId).filter(Boolean),
    [leaderboardEntries]
  );
  const { isOnline, onlineCount } = usePresence(leaderboardUserIds);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500">
      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-none border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                Weekly Leaderboard
                <FaTrophy className="text-amber-400" />
              </h1>
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400 dark:text-slate-500">
                Resets every Sunday
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onlineCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold shadow-2xs"
                title={`${onlineCount} ${onlineCount === 1 ? "scholar" : "scholars"} online right now`}
              >
                <span className="relative flex size-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
                <span className="hidden sm:inline">
                  {onlineCount} {onlineCount === 1 ? "scholar" : "scholars"} online
                </span>
                <span className="sm:hidden">
                  {onlineCount} online
                </span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
              <FaCrown className="text-xs" />
              <span>Top performers only</span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-10 pt-4 pb-32 flex-1 flex flex-col overflow-y-auto desktop-content-col">
        {/* Exam type toggle */}
        <section className="mb-4">
          <div className="flex justify-between items-center gap-5 max-w-5xl mx-auto">
            <div className="flex min-w-0 max-w-2xl flex-1 bg-gray-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
              {[
                { key: "OBJ", label: "Objective" },
                { key: "FIB", label: "Fill in Blank" },
                { key: "THY", label: "Theory" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setExamType(key)}
                  className={`flex-1 px-2 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all whitespace-nowrap ${
                    examType === key
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label="Open leaderboard filters"
              title="Open leaderboard filters"
              className="size-11 shrink-0 rounded-2xl bg-blue-600/70 text-gray-100 shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center transition-transform active:scale-95"
            >
              <FaSlidersH />
            </button>
          </div>
        </section>

        {/* Content */}
        {loading ? (
          <SectionLoader text="Loading leaderboard..." />
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-4 text-sm text-red-600 dark:text-red-200 font-medium">
            {error}
          </div>
        ) : leaderboardEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FaTrophy size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold">No leaders yet this week</h3>
            <p className="text-slate-500 text-sm max-w-[220px]">
              Complete an exam (without a retake) to appear on the leaderboard.
            </p>
          </div>
        ) : (
          <section className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
              Top Scholars
            </h3>

            <div className="space-y-3">
              {leaderboardEntries.map((entry, index) => (
                <LeaderboardRow
                  key={entry.userId}
                  rank={index + 1}
                  fullName={entry.fullName}
                  userName={entry.userName}
                  year={entry.year}
                  avatarUrl={entry.avatarUrl}
                  isPremium={entry.isPremium}
                  bestPercent={entry.bestPercent}
                  attempts={entry.attemptsCount}
                  avgTime={formatTime(entry.avgTimeSeconds)}
                  university={entry.university}
                  isCurrentUser={entry.userId === userProfile?.id}
                  isOnline={isOnline(entry.userId)}
                  onClick={() => {
                    const profile = profiles[entry.userId] || {};
                    const courseMatch = (courses || []).find(
                      (c) =>
                        (c.id ?? c.course_id) === entry.bestCourseId ||
                        c.name?.toLowerCase() === entry.bestCourseId?.toLowerCase() ||
                        c.code?.toLowerCase() === entry.bestCourseId?.toLowerCase()
                    );
                    setSheetProfile({
                      id: entry.userId,
                      full_name: entry.fullName,
                      user_name: entry.userName || null,
                      college: profile.college || "TASUED",
                      avatar_url: entry.avatarUrl,
                      department: entry.department,
                      university: entry.university,
                      year: entry.year,
                      current_streak: profile.currentStreak,
                      best_streak: profile.bestStreak,
                      last_study_date: profile.lastStudyDate,
                      isCurrentUser: entry.userId === userProfile?.id,
                    });
                    setSheetStats({
                      rank: `#${index + 1}`,
                      bestScore: `${entry.bestPercent}%`,
                      bestTime: entry.bestTimeSeconds,
                      bestCourseId: entry.bestCourseId ?? null,
                      bestCourseCode:
                        courseMatch?.name ||
                        courseMatch?.code ||
                        entry.bestCourseId ||
                        null,
                      bestCourseTitle: courseMatch?.title || null,
                      bestTotalQuestions: entry.bestTotalQuestions ?? null,
                    });
                    setSheetIsPremium(entry.isPremium);
                    setIsSheetOpen(true);
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {filtersOpen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm px-4 py-6 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaderboard-filters-title"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-950/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2
                  id="leaderboard-filters-title"
                  className="text-base font-black text-slate-950 dark:text-white"
                >
                  Refine leaderboard
                </h2>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Choose scope, level, course, and question count.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close leaderboard filters"
                className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-transform active:scale-95"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2">
                  Scope
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      key: "mine",
                      label: "My University",
                      icon: FaUniversity,
                    },
                    { key: "all", label: "Global", icon: FaGlobeAfrica },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUniversityFilter(key)}
                      className={`h-12 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all ${
                        universityFilter === key
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-none"
                          : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <Icon className="text-sm" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2">
                  Questions
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {questionCountOptions.map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCountFilter(count)}
                      className={`h-11 rounded-2xl border text-xs font-black transition-all ${
                        questionCountFilter === count
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-none"
                          : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {count === "all" ? "All" : count}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2">
                  Level
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {levelOptions.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLevelFilter(level)}
                      className={`h-11 rounded-2xl border text-xs font-black transition-all ${
                        levelFilter === level
                          ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-none"
                          : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {level === "all" ? "All" : level}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="leaderboard-course-filter"
                  className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 mb-2"
                >
                  Course
                </label>
                <CourseDropdown
                  options={courseOptions}
                  selected={selectedCourseId}
                  onSelect={setSelectedCourseId}
                />
              </div>
            </div>

            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="w-full h-12 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none text-sm font-black transition-transform active:scale-[0.98]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickViewSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        userProfile={sheetProfile}
        isPremium={sheetIsPremium}
        stats={sheetStats}
      />

      <ConfirmOverlay
        isOpen={isPremiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Unlock Premium Features"
        message="Get Premium to save questions for revision, bookmark during exams, and enjoy an ad-free experience."
        confirmText="Get Premium"
        cancelText="Maybe later"
      />

      <NavBar
        isPremium={isUserPremium}
        onLockedClick={() => setPremiumOverlayOpen(true)}
      />
    </div>
  );
};

const LeaderboardRow = ({
  rank,
  fullName,
  userName,
  university,
  avatarUrl,
  isPremium,
  bestPercent,
  attempts,
  avgTime,
  isCurrentUser = false,
  isOnline = false,
  onClick,
}) => {
  const isTop1 = rank === 1;
  const isTop2 = rank === 2;
  const isTop3 = rank === 3;

  let badgeBg =
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  let badgeIcon = null;

  if (isTop1) {
    badgeBg =
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    badgeIcon = <FaCrown className="text-amber-400" />;
  } else if (isTop2) {
    badgeBg =
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
    badgeIcon = <FaMedal className="text-slate-400" />;
  } else if (isTop3) {
    badgeBg =
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    badgeIcon = <FaMedal className="text-orange-400" />;
  }

  return (
    <div
      className={`group relative flex items-center justify-between p-4 rounded-[1.8rem] shadow-sm hover:shadow-xl transition-all duration-300 active:scale-[0.98] cursor-pointer ${
        isCurrentUser
          ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-400 dark:border-blue-600 shadow-lg shadow-blue-200/40 dark:shadow-blue-900/20"
          : "bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:shadow-slate-200/40 dark:hover:shadow-none"
      }`}
      onClick={onClick}
    >
      {/* Current user indicator badge */}
      {isCurrentUser && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-300/50 dark:shadow-blue-900/30">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
            You
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`size-10 rounded-2xl flex items-center justify-center font-black text-sm ${badgeBg}`}
          >
            {badgeIcon ? badgeIcon : <span>#{rank}</span>}
          </div>
          <div className="relative shrink-0 flex items-center justify-center">
            <Avatar
              avatarUrl={avatarUrl}
              size="sm"
              lazy={true}
              isOnline={isOnline}
              className={
                isCurrentUser
                  ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-blue-50 dark:ring-offset-slate-900"
                  : ""
              }
            />
          </div>
        </div>
        <div className="min-w-0">
          <p
            className={`font-black truncate flex items-center gap-1.5 ${
              isCurrentUser
                ? "text-blue-700 dark:text-blue-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {fullName?.trim()?.split(/\s+/)?.[0] || "Scholar"}
            {isPremium && (
              <span
                className="inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]"
                title="Premium user"
              >
                <FaCrown className="mr-0.5" size={8} />
                PRO
              </span>
            )}
          </p>
          <p
            className={`text-[11px] font-medium truncate ${
              isCurrentUser
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {userName
              ? `@${
                  userName.length > 12
                    ? userName.slice(0, 12) + "..."
                    : userName
                } • `
              : ""}
            {university}
          </p>
          <p
            className={`text-[11px] font-medium ${
              isCurrentUser
                ? "text-blue-600 dark:text-blue-400"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            Avg: {avgTime} • Attempts: {attempts}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p
          className={`text-xs font-semibold text-center ${
            isCurrentUser
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          Best
        </p>
        <p
          className={`text-lg font-bold ${
            isCurrentUser
              ? "text-blue-700 dark:text-blue-300"
              : "text-slate-800 dark:text-slate-100"
          }`}
        >
          {bestPercent}%
        </p>
      </div>
    </div>
  );
};

export default LeaderboardScreen;

import useDocumentTitle from "../hooks/useDocumentTitle";