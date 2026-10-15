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
import StatCard from "../components/StatCard";

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
  <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-pulse space-y-6">
    <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <div className="bg-white dark:bg-slate-800/60 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-2xl" />
        <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
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
              className="h-24 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800"
            />
          ))}
        </div>
        <div className="h-36 bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-100 dark:border-slate-800" />
        <div className="h-36 bg-white dark:bg-slate-800/60 rounded-3xl border border-slate-100 dark:border-slate-800" />
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
  const [courseTitle, setCourseTitle] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

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
      // Fallback to location stats if available
      if (location.state?.stats) {
        return {
          bestScore: location.state.stats.bestScore,
          quizzesTaken: 1,
          totalQuestionsAnswered: location.state.stats.bestTotalQuestions,
          averageScore: location.state.stats.bestScore,
          bestTime: location.state.stats.bestTime,
          bestCourseId: location.state.stats.bestCourseId,
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

    attempts.forEach((a) => {
      const qCount = Number(a.total_questions) || 0;
      const score = Number(a.score) || 0;
      totalQuestions += qCount;

      if (qCount > 0) {
        const percent = (score / qCount) * 100;
        totalScorePercent += percent;

        if (percent > bestPercent) {
          bestPercent = percent;
          bestAttempt = a;
        } else if (percent === bestPercent && bestAttempt) {
          // tie breaker by time taken
          const timeA = Number(a.time_taken) || Infinity;
          const timeBest = Number(bestAttempt.time_taken) || Infinity;
          if (timeA < timeBest) {
            bestAttempt = a;
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
      bestCourseId:
        bestAttempt?.course_id ?? location.state?.stats?.bestCourseId,
      bestTotalQuestions:
        bestAttempt?.total_questions ?? location.state?.stats?.bestTotalQuestions,
    };
  }, [attempts, location.state]);

  // Lookup best course title
  useEffect(() => {
    const courseId = statsOverview.bestCourseId;
    if (!courseId) {
      setCourseTitle(null);
      return;
    }

    // Try finding in passed courses first
    const found = courses.find(
      (c) => (c.id ?? c.course_id ?? c.code) === courseId
    );
    if (found?.name || found?.title) {
      setCourseTitle(found.name || found.title);
      return;
    }

    supabase
      .from("courses_meta")
      .select("title")
      .eq("course_code", courseId)
      .maybeSingle()
      .then(({ data }) => setCourseTitle(data?.title ?? null))
      .catch(() => setCourseTitle(null));
  }, [statsOverview.bestCourseId, courses]);

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
    <div className="min-h-screen pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[120] bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
          <FiCheckCircle className="text-emerald-400 dark:text-emerald-600 size-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Navigation & Back Button */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <FiArrowLeft size={14} />
            <span>Back</span>
          </button>
        </div>

        {/* ── DESKTOP TWO-COLUMN / MOBILE SINGLE COLUMN ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          {/* ── LEFT COLUMN (Sticky on desktop) ───────────────────────────── */}
          <aside className="lg:sticky lg:top-6 space-y-5">
            {/* Identity Card */}
            <div className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-3xl p-6 shadow-sm">
              <ProfileHeader
                userProfile={profile}
                rank={rank}
                isPremium={isPremium}
                isOwnProfile={isOwnProfile}
                onToast={showToast}
                layout="full"
              />

              {/* Academic info (in left column on desktop) */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/60">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400 mb-3">
                  Academic details
                </p>
                <div className="space-y-3">
                  {academicItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2 text-slate-400 dark:text-slate-400 font-semibold">
                        {item.icon &&
                          React.createElement(item.icon, {
                            size: 13,
                            className: "shrink-0",
                          })}
                        {item.label}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white max-w-[55%] truncate text-right">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── RIGHT COLUMN (Sections stacked) ───────────────────────────── */}
          <main className="space-y-6">
            {/* 1. Stats Overview */}
            <section aria-labelledby="stats-overview-title">
              <h2
                id="stats-overview-title"
                className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400 mb-3 px-1"
              >
                Stats Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statsOverview.bestScore && (
                  <StatCard
                    label="Best Score"
                    value={statsOverview.bestScore}
                    icon={FiAward}
                  />
                )}
                {statsOverview.quizzesTaken != null && (
                  <StatCard
                    label="Quizzes Taken"
                    value={statsOverview.quizzesTaken}
                    icon={FiList}
                  />
                )}
                {statsOverview.totalQuestionsAnswered != null && (
                  <StatCard
                    label="Questions"
                    value={statsOverview.totalQuestionsAnswered}
                    icon={FiClock}
                  />
                )}
                {statsOverview.averageScore && (
                  <StatCard
                    label="Average Score"
                    value={statsOverview.averageScore}
                    icon={FiAward}
                  />
                )}
              </div>
            </section>

            {/* 2. Best Performance Card */}
            <section
              aria-labelledby="best-perf-title"
              className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-3xl overflow-hidden shadow-sm"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                <h2
                  id="best-perf-title"
                  className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400"
                >
                  Best Performance
                </h2>
                {rank && (
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-800/40">
                    Leaderboard {rank}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700/60 p-5">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Score
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {statsOverview.bestScore || "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 px-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Time
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                    {formatBestTime(statsOverview.bestTime)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Questions
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {statsOverview.bestTotalQuestions || "—"}
                  </span>
                </div>
              </div>

              {statsOverview.bestCourseId && (
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-3.5">
                  <div className="size-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FiBook size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                      Best Course
                    </p>
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {statsOverview.bestCourseId?.replace(
                        /([A-Za-z]+)(\d+)/,
                        "$1 $2"
                      )}
                      {courseTitle && (
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          {" "}
                          — {courseTitle}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Study Activity Card */}
            <section
              aria-labelledby="study-activity-title"
              className="bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-3xl overflow-hidden shadow-sm"
            >
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60">
                <h2
                  id="study-activity-title"
                  className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400"
                >
                  Study Activity
                </h2>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700/60 p-5">
                <div className="flex flex-col gap-1 pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1">
                    <FaFire className="text-orange-500 size-3" />
                    Current streak
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {currentStreak} {currentStreak === 1 ? "day" : "days"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 px-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1">
                    <FiAward className="text-amber-500 size-3" />
                    Best streak
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {bestStreak} {bestStreak === 1 ? "day" : "days"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 pl-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 flex items-center gap-1">
                    <FiClock className="text-slate-400 size-3" />
                    Last studied
                  </span>
                  <span className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                    {lastStudiedLabel}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
