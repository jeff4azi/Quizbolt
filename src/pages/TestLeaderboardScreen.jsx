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
import { FiCheck, FiChevronLeft } from "react-icons/fi";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import QuickViewSheet from "../components/QuickViewSheet";
import Avatar from "../components/Avatar";

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
import { useNavigate, useLocation } from "react-router-dom";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import { usePresence } from "../hooks/usePresence";
import SectionLoader from "../components/SectionLoader";

const getCurrentWeekStartIso = () => {
  const now = new Date();
  const day = now.getDay();
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - day,
    0,
    0,
    0,
    0
  );
  return weekStart.toISOString();
};

const TestLeaderboardScreen = ({
  courses,
  userProfile,
}) => {
  useDocumentTitle("Weekly Test Leaderboard | QuizBolt");
  const navigate = useNavigate();
  const location = useLocation();
  const [attempts, setAttempts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState(
    location.state?.courseId || "all"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [universityFilter, setUniversityFilter] = useState("mine");
  const [questionCountFilter, setQuestionCountFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const levelOptions = ["all", "100", "200", "300", "400"];

  const normalizeLevel = (year) => {
    const value = String(year || "").trim();
    if (!value) return null;
    return value.length === 1 ? `${value}00` : value;
  };

  const questionCountOptions = ["all", 10, 20, 30, 50, 70, 100];

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setSelectedCourseId("all");
    setQuestionCountFilter("all");
  }, [universityFilter]);

  useEffect(() => {
    if (location.state?.courseId) {
      setSelectedCourseId(location.state.courseId);
    }
  }, [location.state?.courseId]);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetProfile, setSheetProfile] = useState(null);
  const [sheetStats, setSheetStats] = useState(null);
  const [sheetIsPremium, setSheetIsPremium] = useState(false);

  const fetchLeaderboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAttempts([]);

    try {
      const weekStartIso = getCurrentWeekStartIso();

      const { data: attemptsData, error: attemptsError } = await withTimeout(
        supabase
          .from("test_attempts")
          .select("id, user_id, course_id, score, total_questions, created_at, university, profiles!test_attempts_user_id_fkey(full_name, user_name, year, college, is_premium, avatar_url, department)")
          .gte("created_at", weekStartIso),
        15000,
        "Loading leaderboard took too long. Please try again."
      );

      if (attemptsError) {
        console.error(
          "Failed to load test leaderboard attempts:",
          attemptsError.message
        );
        setAttempts([]);
        setProfiles({});
        setLoading(false);
        return;
      }

      const safeAttempts = (attemptsData || []).map(
        (a) => ({
          ...a,
          profiles: a.profiles || null
        })
      );

      const bestByUser = new Map();
      safeAttempts.forEach((attempt) => {
        const existing = bestByUser.get(attempt.user_id);
        const pct = attempt.total_questions
          ? attempt.score / attempt.total_questions
          : 0;
        const existingPct = existing
          ? existing.score / existing.total_questions
          : -1;
        if (!existing || pct > existingPct) {
          bestByUser.set(attempt.user_id, attempt);
        }
      });

      setAttempts(Array.from(bestByUser.values()));

      const profileMap = {};
      Array.from(bestByUser.values()).forEach((attempt) => {
        const p = attempt.profiles;
        if (p) {
          profileMap[attempt.user_id] = {
            full_name: p.full_name,
            user_name: p.user_name,
            year: p.year,
            college: p.college,
            avatar_url: p.avatar_url,
            isPremium: p.is_premium === true,
            department: p.department,
            university: userProfile?.university?.trim()
          };
        }
      });
      setProfiles(profileMap);
    } catch (err) {
      console.error("Test leaderboard fetch error:", err.message);
      setError(
        "We couldn't load the test leaderboard right now. Please try again shortly."
      );
      setAttempts([]);
      setProfiles({});
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchLeaderboardData();
  }, [fetchLeaderboardData]);

  useVisibilityRefresh(fetchLeaderboardData);

  const courseOptions = useMemo(() => {
    if (!Array.isArray(courses) || courses.length === 0) {
      return [{ id: "all", label: "All Courses" }];
    }

    const deduped = [];
    const seen = new Set();

    courses.forEach((c) => {
      const id = c.id || c.course_id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      deduped.push({
        id,
        label: c.name || c.title || c.code || "Course"
      });
    });

    return [{ id: "all", label: "All Courses" }, ...deduped];
  }, [courses]);

  const leaderboardEntries = useMemo(() => {
    if (!attempts.length) return [];

    let filteredAttempts = attempts.slice();

    if (universityFilter === "mine") {
      filteredAttempts = filteredAttempts.filter((a) => {
        const userUni = (userProfile?.university || "").trim().toLowerCase();
        if (!userUni) return true;
        return a.university?.trim().toLowerCase() === userUni;
      });
    }

    if (selectedCourseId !== "all") {
      filteredAttempts = filteredAttempts.filter(
        (a) => a.course_id === selectedCourseId
      );
    }

    if (questionCountFilter !== "all") {
      filteredAttempts = filteredAttempts.filter(
        (a) => Number(a.total_questions) === questionCountFilter
      );
    }

    const entries = filteredAttempts.map((a) => {
      const profile = profiles[a.user_id] || {};
      const bestPercent = a.total_questions
        ? Math.round((a.score / a.total_questions) * 100)
        : 0;
      const fullName = profile.full_name || "Scholar";
      const userName = profile.user_name || null;
      const year = profile.year || "1";

      return {
        userId: a.user_id,
        bestPercent,
        bestCourseId: a.course_id,
        bestTotalQuestions: a.total_questions,
        attemptsCount: 1,
        bestTimeSeconds: 0,
        totalTime: 0,
        fullName,
        userName,
        year,
        university: a.university,
        avatarUrl: profile.avatar_url || null,
        isPremium: profile.isPremium === true,
        department: profile.department
      };
    });

    const levelFilteredEntries =
      levelFilter === "all"
        ? entries
        : entries.filter((entry) =>
            normalizeLevel(entry.year) === levelFilter
          );

    levelFilteredEntries.sort((a, b) => b.bestPercent - a.bestPercent);

    return levelFilteredEntries;
  }, [
    attempts,
    profiles,
    selectedCourseId,
    universityFilter,
    userProfile,
    questionCountFilter,
    levelFilter
  ]);

  const formatTime = () => "—";

  const leaderboardUserIds = useMemo(
    () => leaderboardEntries.map((e) => e.userId).filter(Boolean),
    [leaderboardEntries]
  );
  const { isOnline, onlineCount } = usePresence(leaderboardUserIds);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header className="sticky top-0 z-50 px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-none border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/test")}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm active:scale-90 transition-all shrink-0"
              aria-label="Back to test mode"
            >
              <FiChevronLeft className="size-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                Weekly Test Leaderboard
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
          </div>
        </div>
      </header>

      <main className="px-6 lg:px-10 pt-4 pb-32 flex-1 flex flex-col overflow-y-auto desktop-content-col">
        <section className="mb-4 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-5">
            <div className="flex min-w-0 flex-1 bg-gray-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
              {levelOptions.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setLevelFilter(level)}
                  className={"flex-1 px-2 sm:px-5 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all whitespace-nowrap " + (levelFilter === level ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200")}
                >
                  {level === "all" ? "All Levels" : level}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label="Open test leaderboard filters"
              title="Open test leaderboard filters"
              className="size-11 shrink-0 rounded-2xl bg-blue-600/70 text-gray-100 shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center transition-transform active:scale-95"
            >
              <FaSlidersH />
            </button>
          </div>
        </section>

        {loading ? (
          <SectionLoader text="Loading test leaderboard..." />
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-4 text-sm text-red-600 dark:text-red-200 font-medium">
            {error}
          </div>
        ) : leaderboardEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FaTrophy size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold">No test leaders yet this week</h3>
            <p className="text-slate-500 text-sm max-w-[220px]">
              Complete a test to appear on the test leaderboard.
            </p>
          </div>
        ) : (
          <section className="space-y-4 max-w-5xl mx-auto w-full">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">
              Top Test Scholars
            </h3>
            <div className="space-y-3">
              {leaderboardEntries.map((entry, index) => (
                <TestLeaderboardRow
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
                    });
                    setSheetStats({
                      rank: `#${index + 1}`,
                      bestScore: `${entry.bestPercent}%`,
                      bestTime: entry.bestTimeSeconds,
                      bestCourseId: entry.bestCourseId || null,
                      bestCourseCode:
                        courseMatch?.name ||
                        courseMatch?.code ||
                        entry.bestCourseId ||
                        null,
                      bestCourseTitle: courseMatch?.title || null,
                      bestTotalQuestions: entry.bestTotalQuestions || null,
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
          aria-labelledby="test-leaderboard-filters-title"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-950/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2
                  id="test-leaderboard-filters-title"
                  className="text-base font-black text-slate-950 dark:text-white"
                >
                  Refine test leaderboard
                </h2>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Choose scope, level, course, and question count.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close test leaderboard filters"
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
                      icon: FaUniversity
                    },
                    { key: "all", label: "Global", icon: FaGlobeAfrica }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setUniversityFilter(key)}
                      className={"h-12 rounded-2xl border text-xs font-black flex items-center justify-center gap-2 transition-all " + (universityFilter === key ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-none" : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}
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
                      className={"h-11 rounded-2xl border text-xs font-black transition-all " + (questionCountFilter === count ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200 dark:shadow-none" : "bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}
                    >
                      {count === "all" ? "All" : count}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="test-leaderboard-course-filter"
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
    </div>
  );
};

const TestLeaderboardRow = ({
  rank,
  fullName,
  userName,
  university,
  avatarUrl,
  isPremium,
  bestPercent,
  isCurrentUser = false,
  isOnline = false,
  onClick
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
      className={"group relative flex items-center justify-between p-4 rounded-[1.8rem] shadow-sm hover:shadow-xl transition-all duration-300 active:scale-[0.98] cursor-pointer " + (isCurrentUser ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-400 dark:border-blue-600 shadow-lg shadow-blue-200/40 dark:shadow-blue-900/20" : "bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:shadow-slate-200/40 dark:hover:shadow-none")}
      onClick={onClick}
    >
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
            className={"size-10 rounded-2xl flex items-center justify-center font-black text-sm " + badgeBg}
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
            className={"font-black truncate flex items-center gap-1.5 " + (isCurrentUser ? "text-blue-700 dark:text-blue-400" : "text-slate-900 dark:text-white")}
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
            className={"text-[11px] font-medium truncate " + (isCurrentUser ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")}
          >
            {userName
              ? `@${userName.length > 12 ? userName.slice(0, 12) + "..." : userName} • `
              : ""}
            {university}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p
          className={"text-xs font-semibold text-center " + (isCurrentUser ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")}
        >
          Best
        </p>
        <p
          className={"text-lg font-bold " + (isCurrentUser ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-100")}
        >
          {bestPercent}%
        </p>
      </div>
    </div>
  );
};

export default TestLeaderboardScreen;

import useDocumentTitle from "../hooks/useDocumentTitle";