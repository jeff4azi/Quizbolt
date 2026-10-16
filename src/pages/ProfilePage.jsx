import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FiArrowLeft,
  FiAward,
  FiClock,
  FiList,
  FiBook,
  FiHome,
  FiLayers,
  FiUser,
  FiBookOpen,
  FiAlertCircle,
  FiCheckCircle,
  FiHelpCircle,
} from "react-icons/fi";
import { FaFire } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import useDocumentTitle from "../hooks/useDocumentTitle";
import ProfileHeader from "../components/ProfileHeader";
import {
  fetchActiveCoursesForUser,
  getActiveCourseCodeSet,
  isCourseInActiveList,
  normalizeCourseCode,
} from "../utils/activeCourses";

const getRelativeStudyLabel = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

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

const formatBestTime = (t) => {
  if (!t || !Number.isFinite(t) || t === Infinity) return "—";
  const mins = Math.floor(t / 60);
  const secs = t % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const ProfilePageSkeleton = () => (
  <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] animate-pulse pb-24">
    <div className="h-16 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 flex items-center px-6">
      <div className="size-11 rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </div>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8">
        <div className="bg-white dark:bg-slate-800/80 rounded-3xl p-6 border border-slate-200/70 dark:border-slate-700/60 space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="size-24 rounded-3xl bg-slate-200 dark:bg-slate-700" />
            <div className="h-5 w-36 bg-slate-200 dark:bg-slate-700 rounded-lg" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-2xl mt-4" />
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700/60">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700/60"
              />
            ))}
          </div>
          <div className="h-40 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/70 dark:border-slate-700/60" />
          <div className="h-40 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/70 dark:border-slate-700/60" />
        </div>
      </div>
    </div>
  </div>
);

const ProfilePage = ({ userProfile: viewerProfile, courses = [] }) => {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  useDocumentTitle(
    username ? `@${username} | QuizBolt Profile` : "Scholar Profile | QuizBolt"
  );

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(location.state?.profile || null);
  const rank = location.state?.rank || location.state?.stats?.rank || null;
  const [isPremium, setIsPremium] = useState(
    location.state?.isPremium ?? location.state?.profile?.is_premium ?? false
  );
  const [attempts, setAttempts] = useState([]);
  const [activeCoursesList, setActiveCoursesList] = useState([]);
  const [courseTitle, setCourseTitle] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Load and sync active courses for this profile
  useEffect(() => {
    // If viewing own profile and availableCourses were provided by App
    if (profile?.id && viewerProfile?.id === profile.id && courses && courses.length > 0) {
      setActiveCoursesList(courses);
      return;
    }

    if (profile?.university) {
      fetchActiveCoursesForUser(profile).then((fetched) => {
        setActiveCoursesList(fetched || []);
      });
    }
  }, [profile, viewerProfile, courses]);

  const activeCourseCodes = useMemo(() => {
    return getActiveCourseCodeSet(activeCoursesList);
  }, [activeCoursesList]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch profile and stats
  const fetchProfileData = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);

    try {
      // 1. Try finding by user_name
      let { data: profileData, error: profileErr } = await withTimeout(
        supabase
          .from("profiles")
          .select(
            "id, full_name, user_name, year, college, is_premium, avatar_url, department, university, current_streak, best_streak, last_study_date, created_at"
          )
          .ilike("user_name", username)
          .maybeSingle(),
        12000,
        "Loading scholar profile timed out."
      );

      // If not found by username, check if username param is a user id
      if (!profileData && !profileErr) {
        const { data: byIdData } = await supabase
          .from("profiles")
          .select(
            "id, full_name, user_name, year, college, is_premium, avatar_url, department, university, current_streak, best_streak, last_study_date, created_at"
          )
          .eq("id", username)
          .maybeSingle();
        profileData = byIdData;
      }

      if (!profileData) {
        setNotFound(true);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setIsPremium(profileData.is_premium === true);

      // 2. Fetch attempts for stats overview
      const { data: attemptsData } = await withTimeout(
        supabase
          .from("exam_attempts")
          .select(
            "id, course_id, score, total_questions, time_taken, date_taken, is_retake, university, type"
          )
          .eq("user_id", profileData.id)
          .eq("is_retake", false),
        12000,
        "Loading attempts timed out."
      );

      setAttempts(attemptsData || []);
    } catch (err) {
      console.error("Error fetching profile page data:", err);
      if (!profile) {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [username, profile]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  // Derive stats from attempts
  const statsOverview = useMemo(() => {
    if (!attempts || attempts.length === 0) {
      // Fallback to location stats if available and active
      if (location.state?.stats) {
        const locBestCourse = location.state.stats.bestCourseId;
        const isLocCourseActive = isCourseInActiveList(
          locBestCourse,
          activeCourseCodes
        );
        return {
          bestScore: location.state.stats.bestScore,
          quizzesTaken: 1,
          totalQuestionsAnswered: location.state.stats.bestTotalQuestions,
          averageScore: location.state.stats.bestScore,
          bestTime: location.state.stats.bestTime,
          bestCourseId: isLocCourseActive ? locBestCourse : null,
          bestTotalQuestions: location.state.stats.bestTotalQuestions,
        };
      }
      return {
        bestScore: null,
        quizzesTaken: 0,
        totalQuestionsAnswered: null,
        averageScore: null,
        bestTime: null,
        bestCourseId: null,
        bestTotalQuestions: null,
      };
    }

    let totalScorePercent = 0;
    let totalQuestions = 0;
    let bestPercent = -1;
    let bestAttempt = null;

    // Track best attempt strictly among active courses
    let bestActivePercent = -1;
    let bestActiveAttempt = null;

    attempts.forEach((a) => {
      const qCount = Number(a.total_questions) || 0;
      const score = Number(a.score) || 0;
      totalQuestions += qCount;

      if (qCount > 0) {
        const percent = (score / qCount) * 100;
        totalScorePercent += percent;

        // Overall best attempt (for overall best score/time stats)
        if (percent > bestPercent) {
          bestPercent = percent;
          bestAttempt = a;
        } else if (percent === bestPercent && bestAttempt) {
          const timeA = Number(a.time_taken) || Infinity;
          const timeBest = Number(bestAttempt.time_taken) || Infinity;
          if (timeA < timeBest) {
            bestAttempt = a;
          }
        }

        // Active courses best attempt (strictly for Best Course)
        if (isCourseInActiveList(a.course_id, activeCourseCodes)) {
          if (percent > bestActivePercent) {
            bestActivePercent = percent;
            bestActiveAttempt = a;
          } else if (percent === bestActivePercent && bestActiveAttempt) {
            const timeA = Number(a.time_taken) || Infinity;
            const timeBest = Number(bestActiveAttempt.time_taken) || Infinity;
            if (timeA < timeBest) {
              bestActiveAttempt = a;
            }
          }
        }
      }
    });

    const quizzesTaken = attempts.length;
    const averageScore =
      quizzesTaken > 0 ? `${Math.round(totalScorePercent / quizzesTaken)}%` : null;
    const bestScoreStr =
      bestPercent >= 0 ? `${Math.round(bestPercent)}%` : null;

    return {
      bestScore: bestScoreStr,
      quizzesTaken,
      totalQuestionsAnswered: totalQuestions > 0 ? totalQuestions : null,
      averageScore,
      bestTime: bestAttempt?.time_taken ?? location.state?.stats?.bestTime,
      bestCourseId: bestActiveAttempt?.course_id ?? null,
      bestTotalQuestions:
        bestAttempt?.total_questions ?? location.state?.stats?.bestTotalQuestions,
    };
  }, [attempts, activeCourseCodes, location.state]);

  // Lookup best course title
  useEffect(() => {
    const courseId = statsOverview.bestCourseId;
    if (!courseId) {
      setCourseTitle(null);
      return;
    }

    const normId = normalizeCourseCode(courseId);

    // Try finding in activeCoursesList or passed courses first
    const pool = [...activeCoursesList, ...courses];
    const found = pool.find(
      (c) =>
        normalizeCourseCode(c.id) === normId ||
        normalizeCourseCode(c.course_code) === normId ||
        normalizeCourseCode(c.code) === normId ||
        normalizeCourseCode(c.name) === normId
    );
    if (found?.name || found?.title) {
      setCourseTitle(found.title || found.name);
      return;
    }

    supabase
      .from("courses_meta")
      .select("title")
      .ilike("course_code", courseId)
      .maybeSingle()
      .then(({ data }) => setCourseTitle(data?.title ?? null))
      .catch(() => setCourseTitle(null));
  }, [statsOverview.bestCourseId, activeCoursesList, courses]);

  if (loading && !profile) {
    return <ProfilePageSkeleton />;
  }

  if (notFound || !profile) {
    return (
      <div className="max-w-md mx-auto px-6 py-20 text-center">
        <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center mb-5">
          <FiHelpCircle size={36} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
          Scholar not found
        </h2>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
          We couldn't find a Quiz Bolt profile for{" "}
          <span className="font-bold text-slate-700 dark:text-slate-200">
            @{username}
          </span>
          . The user may have changed their username or the link is invalid.
        </p>
        <button
          type="button"
          onClick={() => navigate("/leaderboard")}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-sm dark:shadow-none transition-transform active:scale-95"
        >
          <FiArrowLeft size={16} />
          <span>Back to Leaderboard</span>
        </button>
      </div>
    );
  }

  const isOwnProfile =
    (viewerProfile?.id && viewerProfile.id === profile.id) ||
    (viewerProfile?.user_name &&
      viewerProfile.user_name.toLowerCase() === profile.user_name?.toLowerCase());

  const collegeLabel = ["TASUED", "BOUESTI"].includes(profile.university)
    ? "College"
    : "Faculty";

  const levelStr = profile.year
    ? String(profile.year).length === 1
      ? `${profile.year}00L`
      : `${profile.year}L`
    : "—";

  const currentStreak = isValidStreak(
    profile.last_study_date,
    profile.current_streak
  );
  const bestStreak = profile.best_streak || 0;
  const lastStudiedLabel = getRelativeStudyLabel(profile.last_study_date) || "—";

  // Academic info block helper
  const academicItems = [
    {
      label: "University",
      value: profile.university || "—",
      icon: FiHome,
    },
    {
      label: collegeLabel,
      value: profile.college || "—",
      icon: FiBookOpen,
    },
    {
      label: "Department",
      value: profile.department || "—",
      icon: FiLayers,
    },
    {
      label: "Level",
      value: levelStr,
      icon: FiUser,
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500 pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[120] bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
          <FiCheckCircle className="text-emerald-400 dark:text-emerald-600 size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* QuizBolt Site Standard Header with Back Button */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/leaderboard")
            }
            className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform shrink-0"
            aria-label="Go back"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="text-center min-w-0 px-2">
            <h1 className="text-lg font-black tracking-tight truncate">
              {profile.full_name || "Scholar"}
            </h1>
            <p className="text-[11px] font-bold tracking-[0.18em] text-slate-400 truncate">
              {profile.user_name ? `@${profile.user_name}` : "Scholar Profile"}
            </p>
          </div>
          <div className="size-11 shrink-0" />
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* ── DESKTOP TWO-COLUMN / MOBILE SINGLE COLUMN ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
          {/* ── LEFT COLUMN (Sticky on desktop) ───────────────────────────── */}
          <aside className="lg:sticky lg:top-24 space-y-5">
            {/* Identity Card */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 rounded-3xl p-5 sm:p-5.5 shadow-sm">
              <ProfileHeader
                userProfile={profile}
                rank={rank}
                isPremium={isPremium}
                isOwnProfile={isOwnProfile}
                onToast={showToast}
              />

              {/* Academic info (below divider in identity card) - 2x2 compact grid */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 mb-2.5 px-1">
                  Academic details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {academicItems.map((item) => (
                    <div
                      key={item.label}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 flex flex-col justify-center min-w-0"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1.5 truncate">
                        {React.createElement(item.icon, {
                          size: 11,
                          className: "shrink-0 text-slate-400",
                        })}
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span
                        className="font-bold text-xs text-slate-900 dark:text-white truncate mt-0.5"
                        title={item.value}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── RIGHT COLUMN (Sections stacked) ───────────────────────────── */}
          <main className="space-y-5">

            {/* 1. Study Activity — Hero Banner (most engaging, leads the page) */}
            <section aria-labelledby="study-activity-title">
              <h2
                id="study-activity-title"
                className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400 mb-3 px-1"
              >
                Study Activity
              </h2>
              <div className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-3xl overflow-hidden shadow-sm">
                {/* Streak hero row */}
                <div className="flex items-stretch divide-x divide-slate-100 dark:divide-slate-700/60">
                  {/* Current Streak — featured */}
                  <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-4 py-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/10">
                    <div className="flex items-center gap-1.5">
                      <FaFire className="text-orange-500 size-5" />
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600 dark:text-orange-400">
                        Current Streak
                      </span>
                    </div>
                    <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">
                      {currentStreak}
                    </span>
                    <span className="text-[11px] font-bold text-orange-500 dark:text-orange-400">
                      {currentStreak === 1 ? "day" : "days"}
                    </span>
                  </div>

                  {/* Best Streak */}
                  <div className="flex-1 flex flex-col items-center justify-center gap-1.5 px-4 py-6">
                    <div className="flex items-center gap-1.5">
                      <FiAward className="text-amber-500 size-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">
                        Best Streak
                      </span>
                    </div>
                    <span className="text-4xl font-black text-slate-900 dark:text-white leading-none">
                      {bestStreak}
                    </span>
                    <span className="text-[11px] font-bold text-amber-500 dark:text-amber-400">
                      {bestStreak === 1 ? "day" : "days"}
                    </span>
                  </div>
                </div>

                {/* Last studied footer */}
                <div className="flex items-center gap-2.5 px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60">
                  <FiClock className="text-slate-400 size-3.5 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                    Last studied
                  </span>
                  <span className="ml-auto text-sm font-black text-slate-700 dark:text-slate-200">
                    {lastStudiedLabel}
                  </span>
                </div>
              </div>
            </section>

            {/* 2. Performance — merged stats + best result */}
            <section aria-labelledby="performance-title">
              <h2
                id="performance-title"
                className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400 mb-3 px-1"
              >
                Performance
              </h2>
              <div className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-3xl overflow-hidden shadow-sm">

                {/* Key metrics row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 dark:divide-slate-700/60">
                  <div className="flex flex-col gap-1 px-5 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FiAward className="text-blue-500 size-3 shrink-0" />
                      Best Score
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {statsOverview.bestScore || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-5 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FiList className="text-purple-500 size-3 shrink-0" />
                      Quizzes
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {statsOverview.quizzesTaken ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-5 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FiClock className="text-teal-500 size-3 shrink-0" />
                      Avg Score
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {statsOverview.averageScore || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-5 py-4">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FiAlertCircle className="text-rose-400 size-3 shrink-0" />
                      Questions
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {statsOverview.totalQuestionsAnswered ?? "—"}
                    </span>
                  </div>
                </div>

                {/* Best attempt divider row */}
                {(statsOverview.bestScore || statsOverview.bestTime || statsOverview.bestTotalQuestions) && (
                  <>
                    <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                      <FiAward className="text-amber-500 size-3.5 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Best Attempt
                      </span>
                      {rank && (
                        <span className="ml-auto text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/40">
                          Leaderboard {rank}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700/60 px-5 py-4">
                      <div className="flex flex-col gap-0.5 pr-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{statsOverview.bestScore || "—"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 px-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white truncate">{formatBestTime(statsOverview.bestTime)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 pl-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Questions</span>
                        <span className="text-xl font-black text-slate-900 dark:text-white">{statsOverview.bestTotalQuestions || "—"}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Best course footer */}
                {statsOverview.bestCourseId && (
                  <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <FiBook size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Best Course
                      </p>
                      <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {statsOverview.bestCourseId?.replace(/([A-Za-z]+)(\d+)/, "$1 $2")}
                        {courseTitle && (
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            {" "}— {courseTitle}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
