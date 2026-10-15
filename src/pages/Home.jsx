import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from "../images/Logo";
import BannerAd from "../components/BannerAd";
import ConfirmOverlay from "../components/ConfirmOverlay";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import Avatar from "../components/Avatar";
import NavBar from "../components/NavBar";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import flashCardIcon from "../images/flash-card.webp";
import testIcon from "../images/test.webp";
import matchIcon from "../images/match.webp";
import useDocumentTitle from "../hooks/useDocumentTitle";

import { useMessaging } from "../hooks/useMessaging";
import { IoChatbubblesOutline } from "react-icons/io5";

import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { FreeMode } from "swiper/modules";

import {
  FaCrown,
  FaFire,
  FaTrophy,
  FaUserFriends,
  FaBolt,
} from "react-icons/fa";
import {
  FiArrowRight,
  FiZap,
  FiPlay,
  FiX,
  FiBell,
  FiClock,
  FiChevronRight,
} from "react-icons/fi";
import { MdStar } from "react-icons/md";
import {
  loadFavouriteCourseIds,
  decodeFavouriteKey,
} from "../utils/favouriteCourses";

import {
  trackPWAInstallPrompt,
  trackPWAInstalled,
  trackPWADismissed,
  trackStudyModeClick,
} from "../utils/analytics";
import { loadExamSession, clearExamSession } from "../utils/examSessionStorage";
import {
  buildLeaderboardEntries,
  compareLeaderboardEntries,
} from "../utils/leaderboardRanking";
import { isSubscribedToPush, getCachedNotificationsEnabled } from "../lib/push";

const getCurrentDayStartIso = () => {
  const now = new Date();
  const dayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  return dayStart.toISOString();
};

const getCurrentWeekStartIso = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day;
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

const IOS_TUTORIAL_URL =
  "https://youtube.com/shorts/ndcyOO3Xbog?si=Un0wo2qmTGSgxYf9";
const HOME_DASHBOARD_CACHE_PREFIX = "quizboltHomeDashboard:";
const DEFAULT_HOME_STATS = {
  bestScore: "--",
  position: "--",
  streak: 0,
  hotCourse: null,
};

const getHomeDashboardCacheKey = (userId) =>
  `${HOME_DASHBOARD_CACHE_PREFIX}${userId}`;

const readHomeDashboardCache = (userId) => {
  try {
    if (!userId) return null;
    const raw = localStorage.getItem(getHomeDashboardCacheKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeHomeDashboardCache = (userId, patch) => {
  try {
    const key = getHomeDashboardCacheKey(userId);
    const current = JSON.parse(localStorage.getItem(key) || "{}");
    const next = { ...current, ...patch, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Cache failures should never block the fresh Supabase data.
  }
};

const getWeeklyStats = (attempts, userId, userUniversity) => {
  const normalizedUserUniversity = (userUniversity ?? "").trim().toLowerCase();
  const leaderboardAttempts = attempts.filter((attempt) => {
    if ((attempt.type ?? "OBJ") !== "OBJ") return false;
    if (!normalizedUserUniversity) return true;

    const attemptUniversity = (attempt.university ?? "").trim().toLowerCase();
    return attemptUniversity === normalizedUserUniversity;
  });

  const sorted = buildLeaderboardEntries(leaderboardAttempts).sort(
    compareLeaderboardEntries,
  );
  const currentUserEntry = sorted.find((entry) => entry.userId === userId);
  const idx = sorted.findIndex((entry) => entry.userId === userId);

  return {
    bestScore: currentUserEntry ? `${currentUserEntry.bestPercent}%` : "--",
    position: idx !== -1 ? `#${idx + 1}` : "--",
  };
};

const isValidStreak = (lastStudyDate, currentStreak) => {
  if (!lastStudyDate || currentStreak === 0) return 0;

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

const getHotCourse = (allAttempts, availableCourses) => {
  if (!Array.isArray(allAttempts) || !Array.isArray(availableCourses)) {
    return null;
  }

  const MIN_HOT_THRESHOLD = 5;

  // Count course frequency
  const courseCounts = new Map();
  for (const attempt of allAttempts) {
    if (attempt?.course_id) {
      const count = courseCounts.get(attempt.course_id) || 0;
      courseCounts.set(attempt.course_id, count + 1);
    }
  }

  // Find the most frequent available course that meets the threshold
  let maxCount = 0;
  let hotCourse = null;
  const availableCourseIds = new Set(
    availableCourses.map((c) => c?.id).filter(Boolean),
  );

  for (const [courseId, count] of courseCounts.entries()) {
    if (
      count > maxCount &&
      count >= MIN_HOT_THRESHOLD &&
      availableCourseIds.has(courseId)
    ) {
      maxCount = count;
      hotCourse = availableCourses.find((c) => c?.id === courseId);
    }
  }

  return hotCourse ? { ...hotCourse, attemptCount: maxCount } : null;
};

const getRelativeStudyLabel = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfDay = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24),
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

const Home = ({
  userProfile,
  loadingProfile,
  isPremium,
  courses,
  setQuestionType,
  setSelectedCourse,
  isNew,
}) => {
  useDocumentTitle("Home | QuizBolt");
  const navigate = useNavigate();
  const { totalUnreadCount } = useMessaging();
  const cachedDashboard = useMemo(
    () => readHomeDashboardCache(userProfile?.id),
    [userProfile?.id],
  );
  const [showAd, setShowAd] = useState(false);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState(
    () => cachedDashboard?.favouriteIds || [],
  );
  const [favouritesLoading, setFavouritesLoading] = useState(
    () => !cachedDashboard?.favouriteIds,
  );
  const [examSession, setExamSession] = useState(() => loadExamSession());
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallOverlay, setShowInstallOverlay] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  // Notification reminder card state
  const [showNotificationCard, setShowNotificationCard] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    getCachedNotificationsEnabled(),
  );

  useEffect(() => {
    if (isInStandaloneMode) return;
    if (localStorage.getItem("pwaInstalled")) return;

    // Don't re-show the prompt while the user has snoozed it
    const snoozedUntil = parseInt(
      localStorage.getItem("pwaPromptSnoozedUntil") || "0",
      10,
    );
    if (Date.now() < snoozedUntil) return;

    // Android: the event may have already fired before React mounted.
    // main.jsx captures it on window.__pwaInstallPrompt for exactly this case.
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
      setShowInstallOverlay(true);
      trackPWAInstallPrompt();
    }

    // Also keep a live listener in case the event fires after mount
    // (e.g. delayed by browser heuristics on first visit).
    const handler = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      // Don't show the overlay if still within the snooze period
      const snoozed = parseInt(
        localStorage.getItem("pwaPromptSnoozedUntil") || "0",
        10,
      );
      if (Date.now() >= snoozed) {
        setInstallPrompt(e);
        setShowInstallOverlay(true);
        trackPWAInstallPrompt();
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS doesn't support beforeinstallprompt — show manual guide instead.
    if (isIOS) {
      setShowInstallOverlay(true);
      trackPWAInstallPrompt();
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check notification subscription and dismissal status
  useEffect(() => {
    async function checkNotificationStatus() {
      const subscribed = await isSubscribedToPush();
      setNotificationsEnabled(subscribed);

      if (!subscribed) {
        const dismissedUntil = parseInt(
          localStorage.getItem("notificationCardDismissedUntil") || "0",
          10,
        );
        if (Date.now() >= dismissedUntil) {
          setShowNotificationCard(true);
        }
      }
    }
    checkNotificationStatus();
  }, []);

  useEffect(() => {
    setSelectedCourse(null);
  }, [setSelectedCourse]);

  const handleInstallConfirm = async () => {
    if (isIOS) {
      window.open(IOS_TUTORIAL_URL, "_blank", "noopener,noreferrer");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("pwaInstalled", "true");
        setShowInstallOverlay(false);
        trackPWAInstalled();
      }
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);
    }
  };

  const handleInstallDismiss = () => {
    // Snooze for 6 hours — store the time the user dismissed
    localStorage.setItem(
      "pwaPromptSnoozedUntil",
      String(Date.now() + 6 * 60 * 60 * 1000),
    );
    setShowInstallOverlay(false);
    trackPWADismissed();
  };

  const handleResumeExam = () => {
    if (examSession) {
      setSelectedCourse(examSession.selectedCourse);
      navigate("/exam");
    }
  };

  const handleQuitExam = () => {
    clearExamSession();
    setExamSession(null);
    setShowQuitConfirm(false);
  };

  // Notification card handlers
  const handleEnableNotifications = () => {
    navigate("/settings?highlight=notifications");
  };

  const handleDismissNotificationCard = () => {
    localStorage.setItem(
      "notificationCardDismissedUntil",
      String(Date.now() + 6 * 60 * 60 * 1000),
    );
    setShowNotificationCard(false);
  };

  const [stats, setStats] = useState(
    () => cachedDashboard?.stats || DEFAULT_HOME_STATS,
  );
  const [hotCourseLoading, setHotCourseLoading] = useState(
    () => !cachedDashboard?.stats?.hotCourse,
  );

  useEffect(() => {
    if (!cachedDashboard) return;
    setStats(cachedDashboard.stats || DEFAULT_HOME_STATS);
    setFavouriteIds(cachedDashboard.favouriteIds || []);
    setFavouritesLoading(false);
    setHotCourseLoading(false);
  }, [cachedDashboard, userProfile?.university]);

  useEffect(() => {
    if (isPremium) {
      setShowAd(false);
      return;
    }
    const timer = setTimeout(() => setShowAd(true), 750);
    return () => clearTimeout(timer);
  }, [isPremium]);

  const fetchHomeDashboard = useCallback(async () => {
    const hasCachedDashboard = Boolean(cachedDashboard);
    if (!hasCachedDashboard) {
      setFavouritesLoading(true);
      setHotCourseLoading(true);
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await withTimeout(
        supabase.auth.getUser(),
        15000,
        "Checking your session took too long.",
      );

      if (userError || !user) {
        setFavouritesLoading(false);
        setHotCourseLoading(false);
        return;
      }

      const dayStartIso = getCurrentDayStartIso();
      const weekStartIso = getCurrentWeekStartIso();
      const [
        weeklyResult,
        profileResult,
        allAttemptsResult,
        favouriteIdsResult,
      ] = await Promise.all([
        withTimeout(
          supabase
            .from("exam_attempts")
            .select(
              "user_id, score, total_questions, time_taken, date_taken, is_retake, university, type",
            )
            .eq("is_retake", false)
            .gte("date_taken", weekStartIso),
          15000,
          "Loading your stats took too long.",
        ),
        withTimeout(
          supabase
            .from("profiles")
            .select("current_streak, best_streak, last_study_date")
            .eq("id", user.id)
            .single(),
          15000,
          "Loading streak data took too long.",
        ),
        withTimeout(
          supabase
            .from("exam_attempts")
            .select("course_id, date_taken")
            .eq("is_retake", false)
            .gte("date_taken", dayStartIso),
          15000,
          "Loading hot courses took too long.",
        ),
        loadFavouriteCourseIds(user.id),
      ]);

      const hotCourse =
        allAttemptsResult.error || !allAttemptsResult.data
          ? null
          : getHotCourse(allAttemptsResult.data || [], courses);

      const streak =
        profileResult.error || !profileResult.data
          ? 0
          : isValidStreak(
              profileResult.data.last_study_date,
              profileResult.data.current_streak,
            );

      const nextStats = {
        ...DEFAULT_HOME_STATS,
        ...(weeklyResult.error || !weeklyResult.data
          ? {}
          : getWeeklyStats(
              weeklyResult.data || [],
              user.id,
              userProfile?.university,
            )),
        streak,
        lastStudyDate: profileResult.data?.last_study_date,
        bestStreak: profileResult.data?.best_streak,
        hotCourse,
      };
      const nextFavouriteIds = Array.isArray(favouriteIdsResult)
        ? favouriteIdsResult
        : [];

      setStats(nextStats);
      setFavouriteIds(nextFavouriteIds);
      writeHomeDashboardCache(user.id, {
        stats: nextStats,
        favouriteIds: nextFavouriteIds,
      });
    } catch (err) {
      console.error("Failed to load home dashboard:", err);
    } finally {
      setFavouritesLoading(false);
      setHotCourseLoading(false);
    }
  }, [cachedDashboard, userProfile?.university, courses]);

  useEffect(() => {
    fetchHomeDashboard();
  }, [fetchHomeDashboard]);

  useVisibilityRefresh(fetchHomeDashboard);

  const favouriteCourses = useMemo(() => {
    const list = Array.isArray(courses) ? courses : [];
    const map = new Map(list.map((c) => [c?.id, c]));
    return favouriteIds
      .map((key) => {
        const { courseId, questionType } = decodeFavouriteKey(key);
        const course = map.get(courseId);
        if (!course) return null;
        return { ...course, _favouriteKey: key, _questionType: questionType };
      })
      .filter(Boolean);
  }, [courses, favouriteIds]);

  const firstName = loadingProfile
    ? "Scholar"
    : userProfile?.full_name?.split(" ")[0] || "Scholar";

  return (
    <div className="max-w-2xl mx-auto lg:max-w-full relative min-h-[100dvh] flex flex-col bg-gray-50 dark:bg-slate-900 transition-colors duration-500 overflow-x-hidden">
      {/* Top Navigation Bar */}
      <div className="px-6 pt-4 pb-3 flex items-center justify-between z-50 lg:hidden">
        <div className="flex items-center gap-2">
          <Logo className="w-10 h-auto text-slate-800 dark:text-slate-100" />
          <p className="text-sm font-bold tracking-[0.2em] uppercase mt-2 text-slate-400">
            Quiz Bolt
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats.lastStudyDate && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 text-slate-400 dark:text-slate-500">
              <FiClock size={11} />
              <span className="text-[10px] font-semibold">
                {(() => {
                  const today = new Date().toLocaleDateString("en-CA");
                  const yesterday = new Date(
                    Date.now() - 86400000,
                  ).toLocaleDateString("en-CA");
                  const last = new Date(stats.lastStudyDate).toLocaleDateString(
                    "en-CA",
                  );
                  if (last === today) return "Today";
                  if (last === yesterday) return "Yesterday";
                  return new Date(stats.lastStudyDate).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                    },
                  );
                })()}
              </span>
            </div>
          )}

          {/* Mobile Messages Icon Button */}
          <button
            type="button"
            onClick={() => navigate("/messages")}
            className="relative p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700/60 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/60 active:scale-95 transition-all shadow-sm"
            aria-label="Messages"
            title="Messages"
          >
            <IoChatbubblesOutline size={18} className="text-slate-700 dark:text-slate-200" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-gray-50 dark:ring-slate-900 shadow-sm">
                {totalUnreadCount > 9 ? "9+" : totalUnreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl lg:scale-120"
          >
            <Avatar avatarUrl={userProfile?.avatar_url} size="sm" />
            {isPremium && (
              <div className="absolute -top-2 -right-2 bg-amber-400 dark:bg-yellow-500 rounded-full p-1 border-2 border-gray-50 dark:border-slate-900 shadow-sm flex items-center justify-center">
                <FaCrown className="text-[8px] text-white" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 lg:px-10 pb-32 pt-2 lg:pt-6 flex flex-col gap-6 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-700 desktop-content-col">
        {/* Greeting */}
        <div className="lg:flex lg:items-center lg:justify-between lg:gap-4">
          <div>
            <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Hello, {firstName}!{" "}
              <span role="img" aria-label="wave">
                👋
              </span>
            </h1>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Ready for your next challenge?
            </p>
          </div>

          {/* Last Study Date — desktop only */}
          {stats.lastStudyDate && (
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-sm w-fit">
              <FiClock
                size={16}
                className="text-slate-400 dark:text-slate-500"
              />
              <span className="text-sm font-medium tracking-wide">
                {(() => {
                  const today = new Date().toLocaleDateString("en-CA");
                  const yesterday = new Date(
                    Date.now() - 86400000,
                  ).toLocaleDateString("en-CA");
                  const last = new Date(stats.lastStudyDate).toLocaleDateString(
                    "en-CA",
                  );
                  if (last === today) return "Today";
                  if (last === yesterday) return "Yesterday";
                  return new Date(stats.lastStudyDate).toLocaleDateString(
                    "en-US",
                    {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    },
                  );
                })()}
              </span>
            </div>
          )}
        </div>

        {/* Notification Reminder Card */}
        {showNotificationCard && !notificationsEnabled && (
          <div className="relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-4 rounded-[1.75rem] shadow-sm flex items-center gap-4">
            <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <FiBell className="text-blue-600 dark:text-blue-400 text-lg" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Stay on your streak!
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Enable notifications to get daily reminders.
              </p>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors active:scale-95"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={handleDismissNotificationCard}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95"
              aria-label="Dismiss notification reminder"
            >
              <FiX size={18} className="text-slate-400" />
            </button>
          </div>
        )}

        {/* Resume Exam Section */}
        {examSession && (
          <div className="relative bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-5 lg:p-6 rounded-[1.75rem] shadow-md">
            {/* Close button - Top Right */}
            <button
              type="button"
              onClick={() => setShowQuitConfirm(true)}
              className="absolute top-4 right-4 lg:top-5 lg:right-5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors active:scale-95"
              title="Quit exam"
            >
              <FiX size={20} className="text-slate-400 dark:text-slate-500" />
            </button>

            <div className="space-y-4">
              {/* Header */}
              <div className="pr-8">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-6 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      ▶
                    </span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    In Progress
                  </p>
                </div>
                <h3 className="text-lg lg:text-xl font-black text-slate-900 dark:text-white">
                  {examSession.selectedCourse?.name ||
                    examSession.selectedCourse ||
                    "Your Exam"}
                </h3>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Current Question */}
                <div className="bg-gray-50 dark:bg-slate-700/40 p-3 lg:p-4 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Question
                  </p>
                  <p className="text-lg lg:text-xl font-black text-slate-900 dark:text-white">
                    {(examSession.currentIndex || 0) + 1}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    of{" "}
                    {(examSession.questions && examSession.questions.length) ||
                      "?"}
                  </p>
                </div>

                {/* Total Questions */}
                <div className="bg-gray-50 dark:bg-slate-700/40 p-3 lg:p-4 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Total
                  </p>
                  <p className="text-lg lg:text-xl font-black text-slate-900 dark:text-white">
                    {(examSession.questions && examSession.questions.length) ||
                      "?"}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    questions
                  </p>
                </div>

                {/* Time Remaining */}
                {(examSession.timeLeft != null ||
                  examSession.endsAtMs != null) && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 lg:p-4 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                      Time Left
                    </p>
                    <p className="text-lg lg:text-xl font-black text-blue-700 dark:text-blue-300">
                      {(() => {
                        let secondsRemaining = 0;
                        if (examSession.timeLeft != null) {
                          secondsRemaining = examSession.timeLeft;
                        } else if (examSession.endsAtMs != null) {
                          secondsRemaining = Math.max(
                            0,
                            Math.ceil(
                              (examSession.endsAtMs - Date.now()) / 1000,
                            ),
                          );
                        }
                        const minutes = Math.floor(secondsRemaining / 60);
                        const seconds = Math.floor(secondsRemaining % 60);
                        return `${minutes}m ${seconds}s`;
                      })()}
                    </p>
                  </div>
                )}

                {/* Question Type */}
                {examSession.questionType && (
                  <div className="bg-gray-50 dark:bg-slate-700/40 p-3 lg:p-4 rounded-xl">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Type
                    </p>
                    <p className="text-sm lg:text-base font-bold text-slate-900 dark:text-white">
                      {examSession.questionType === "theory"
                        ? "Theory"
                        : examSession.questionType === "fib"
                          ? "Fill in Blanks"
                          : "Objective"}
                    </p>
                  </div>
                )}
              </div>

              {/* Resume Button */}
              <button
                type="button"
                onClick={handleResumeExam}
                className="w-full py-3.5 lg:py-4 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/30 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <FiPlay size={18} />
                Resume Exam
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid — unified neutral surface, accent reserved for the value itself */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Best Score",
              value: stats.bestScore,
              icon: <MdStar />,
            },
            {
              label: "Position",
              value: stats.position || "--",
              icon: <FaTrophy />,
            },
            {
              label: "Streak",
              value: stats.streak || 0,
              icon: <FaFire />,
            },
          ].map((stat, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-800/50 p-3 rounded-[1.6rem] border border-gray-200 dark:border-slate-700 flex flex-col items-center text-center"
            >
              <div className="size-8 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300 rounded-xl flex items-center justify-center mb-2 text-sm">
                {stat.icon}
              </div>
              <span className="text-base font-semibold text-slate-700 dark:text-slate-300 leading-none">
                {stat.value}
              </span>
              <span className="text-[10px] font-medium text-slate-400 uppercase mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Premium CTA — the one place we spend a saturated color */}
        {!isPremium && (
          <div
            onClick={() => navigate("/premium")}
            className="lg:hidden flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent cursor-pointer active:scale-[0.99] transition-all group"
          >
            <div className="flex items-center gap-2">
              <FaCrown className="text-amber-600 dark:text-amber-300 text-sm shrink-0" />
              <span className="text-slate-900 dark:text-slate-100 font-semibold text-xs tracking-tight">
                Go pro for unlimited questions
              </span>
            </div>

            <FiChevronRight className="text-slate-400 dark:text-slate-600 text-sm group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}

        {/* Study Modes — neutral cards, color lives only in the small icon chip */}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 ml-1 -mb-3">
          Study Modes
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {[
            {
              title: "Flashcards",
              description: "Review and memorize",
              icon: flashCardIcon,
              onClick: () => {
                trackStudyModeClick("flashcards");
                navigate("/flashcards");
              },
            },
            {
              title: "Test",
              description: "Check your understanding",
              icon: testIcon,
              onClick: () => {
                trackStudyModeClick("test");
                navigate("/test");
              },
            },
            {
              title: "Match",
              description: "Click fast and score high",
              icon: matchIcon,
              onClick: () => {
                trackStudyModeClick("match");
                navigate("/match");
              },
            },
          ].map((mode) => (
            <button
              key={mode.title}
              type="button"
              onClick={mode.onClick}
              className="group flex items-center gap-3 bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 p-3.5 rounded-2xl text-left cursor-pointer transition-colors hover:border-blue-200 dark:hover:border-blue-800/50 active:scale-[0.98]"
            >
              {/* Icon */}
              <img
                src={mode.icon}
                alt={mode.title}
                className="size-8 lg:size-10 object-contain"
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {mode.title}
                </p>
                <p className="text-[13px] text-slate-600 dark:text-slate-400 line-clamp-1">
                  {mode.description}
                </p>
              </div>

              <FiArrowRight
                size={16}
                className="flex-shrink-0 text-slate-400 group-hover:translate-x-0.5 transition-transform"
              />
            </button>
          ))}
        </div>

        {/* Hot Course — neutral card, accent reduced to a thin rule + tag */}
        <div className="space-y-3">
          {hotCourseLoading ? (
            <>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">
                Hot today
              </h3>
              <div className="bg-white dark:bg-slate-800/70 p-5 rounded-[1.25rem] border border-gray-200 dark:border-slate-700 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="h-2.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    <div className="h-3.5 w-40 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                </div>
              </div>
            </>
          ) : stats.hotCourse ? (
            <>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">
                Hot today
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (setQuestionType) setQuestionType("objective");
                  navigate(`/choose-course?course=${stats.hotCourse.id}`);
                }}
                className="group w-full bg-white dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-[1.25rem] overflow-hidden text-left active:scale-[0.99] transition-all hover:-translate-y-0.5"
              >
                {/* Accent strip */}
                <div className="h-[3px] w-full bg-blue-600" />

                <div className="p-5">
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center">
                      <FaFire className="text-slate-500 dark:text-slate-300 text-lg" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 mb-1.5">
                        <FaBolt className="text-[9px] text-blue-600 dark:text-blue-400" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          Trending
                        </span>
                      </div>
                      <h4 className="text-[17px] font-medium text-slate-900 dark:text-slate-100 truncate">
                        {stats.hotCourse.name}
                      </h4>
                      {stats.hotCourse.title && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                          {stats.hotCourse.title}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                        <span className="text-slate-300 dark:text-slate-600">
                          ◆
                        </span>
                        {stats.hotCourse.questionCount || 0} questions
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {stats.hotCourse.attemptCount} attempts today
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium transition-transform group-hover:translate-x-0.5">
                      Start
                      <FiArrowRight size={14} />
                    </div>
                  </div>
                </div>
              </button>
            </>
          ) : null}
        </div>

        {/* Referral CTA — neutral card matching the rest of the page */}
        {!isPremium && (
          <button
            type="button"
            onClick={() => navigate("/referral-dashboard")}
            className="group relative overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/70"
          >
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="size-12 shrink-0 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center dark:bg-slate-700/60 dark:text-slate-300">
                  <FaUserFriends className="text-xl" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                    Free premium offer
                  </p>
                  <h4 className="mt-1 text-base font-black leading-tight text-slate-900 dark:text-white">
                    Refer 5 friends. Get 7 days free Premium.
                  </h4>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Track invites and share your referral link.
                  </p>
                </div>
              </div>
              <div className="size-10 shrink-0 rounded-2xl bg-slate-900 text-white flex items-center justify-center transition-transform group-hover:translate-x-1 dark:bg-white dark:text-slate-900">
                <FiArrowRight size={18} />
              </div>
            </div>
          </button>
        )}

        {/* Favourite courses */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 ml-1">
            Favourite courses
          </h3>

          {favouritesLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="min-w-[200px] sm:min-w-64 bg-white dark:bg-slate-800 p-3.5 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-200 dark:border-slate-700 animate-pulse"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    </div>
                    <div className="h-6 w-12 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : favouriteCourses.length === 0 ? (
            <div className="bg-gray-100 dark:bg-slate-800/50 p-5 rounded-[2rem] border border-gray-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 font-medium">
              You haven't favourited any courses yet. Tap the heart on the
              Courses screen.
            </div>
          ) : (
            <Swiper
              spaceBetween={12}
              slidesPerView={"auto"}
              freeMode={{
                enabled: true,
                momentum: true,
                momentumVelocityRatio: 0.8,
              }}
              modules={[FreeMode]}
              className="pb-2 pr-6"
            >
              {favouriteCourses.map((course) => (
                <SwiperSlide
                  key={course._favouriteKey}
                  className="!w-[175px] sm:!w-39 lg:!w-44 xl:!w-56"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (setQuestionType)
                        setQuestionType(course._questionType);
                      navigate(`/choose-course?course=${course.id}`);
                    }}
                    className="w-full text-left p-3.5 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] border bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:border-blue-100 shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base sm:text-xl font-black text-slate-900 dark:text-white truncate">
                          {course.name}
                        </p>
                        <p className="text-xs sm:text-sm mt-0.5 leading-snug text-slate-500 dark:text-slate-400 truncate">
                          {course.title}
                        </p>
                        <span className="mt-1.5 inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
                          {course._questionType === "theory"
                            ? "Theory"
                            : course._questionType === "fib"
                              ? "Fill Blanks"
                              : "Objective"}
                        </span>
                      </div>
                      <div className="shrink-0 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700/40 text-[10px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {(course._questionType === "theory"
                          ? course.theoryQuestionCount
                          : course._questionType === "fib"
                            ? course.fibQuestionCount
                            : course.questionCount) || 0}{" "}
                        Qs
                      </div>
                    </div>
                  </button>
                </SwiperSlide>
              ))}
            </Swiper>
          )}
        </div>
      </div>

      <NavBar
        isPremium={isPremium}
        onLockedClick={() => setPremiumOverlayOpen(true)}
        isNew={isNew}
      />

      {!isPremium && showAd && <BannerAd onAdClose={() => setShowAd(false)} />}

      <ConfirmOverlay
        isOpen={isPremiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Unlock Premium Features"
        message="Get Premium to save questions for revision, bookmark during exams, and enjoy an ad-free experience."
        confirmText="Get Premium"
        cancelText="Maybe later"
      />

      <ConfirmOverlay
        isOpen={showInstallOverlay}
        onClose={handleInstallDismiss}
        onConfirm={handleInstallConfirm}
        title="Install Quiz Bolt"
        message={
          isIOS
            ? "Add Quiz Bolt to your home screen for quick access. Tap 'See How' for a step-by-step guide."
            : "Add Quiz Bolt to your home screen for a faster, app-like experience — no app store needed."
        }
        confirmText={isIOS ? "See How" : "Install"}
        cancelText="Not now"
      />

      <ConfirmOverlay
        isOpen={showQuitConfirm}
        onClose={() => setShowQuitConfirm(false)}
        onConfirm={handleQuitExam}
        title="Quit Exam?"
        message="Are you sure you want to quit this exam? Your progress will be lost."
        confirmText="Quit"
        cancelText="Cancel"
      />
    </div>
  );
};

export default Home;
