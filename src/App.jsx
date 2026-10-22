import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SpeedInsights } from "@vercel/speed-insights/react";
import RouteChangeTracker from "./components/RouteChangeTracker";
import DesktopLayout from "./components/DesktopLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import Home from "./pages/Home.jsx";
import ExamScreen from "./pages/ExamScreen";
import ResultScreen from "./pages/ResultScreen";
import ChooseCourseScreen from "./pages/ChooseCourseScreen";
import OnboardingScreen from "./pages/OnboardingScreen";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AboutPage from "./pages/AboutPage";
import FAQPage from "./pages/FAQPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmailScreen from "./pages/ConfirmEmailScreen";
import HistoryScreen from "./pages/HistoryScreen.jsx";
import { supabase } from "./supabaseClient";
import { withTimeout } from "./utils/withTimeout";
import ReviewAnswers from "./pages/ReviewAnswers";
import BookMark from "./pages/BookMark";
import ProtectedRoute from "./components/ProtectedRoutes";
import GuestRoute from "./components/GuestRoute";
import { trackLogout } from "./utils/analytics";
import OnboardingRoute from "./components/OnboardingRoute";
import PremiumPage from "./pages/PremiumPage";
import LandingPage from "./pages/LandingPage";
import Profile from "./pages/Profile";
import SettingsScreen from "./pages/SettingsScreen";
import { AuthProvider } from "./context/AuthContext";
import "katex/dist/katex.min.css";
import LeaderboardScreen from "./pages/LeaderboardScreen";
import { API_BASE_URL } from "./apiConfig";
import UploadProfilePic from "./pages/UploadProfilePic";
import UpdatePassword from "./pages/UpdatePassword";
import { clearExamSession, loadExamSession } from "./utils/examSessionStorage";
import FlashcardsScreen from "./pages/FlashcardsScreen";
import MatchScreen from "./pages/MatchScreen";
import MatchResultScreen from "./pages/MatchResultScreen";
import TestModeScreen from "./pages/TestModeScreen";
import TestResultScreen from "./pages/TestResultScreen";
import TestLeaderboardScreen from "./pages/TestLeaderboardScreen";
import ReferralDashboard from "./pages/ReferralDashboard";
import RouteStateFallback from "./components/RouteStateFallback";
import LoadingScreen from "./components/LoadingScreen";
import NotFoundPage from "./pages/NotFoundPage";
import SubmitReview from "./pages/SubmitReview";
import AdStatsPage from "./pages/AdStatsPage";
import ProfilePage from "./pages/ProfilePage";
import ConversationList from "./pages/ConversationList";
import ChatView from "./pages/ChatView";
import { usePresence } from "./hooks/usePresence";
import { InAppNotificationProvider } from "./context/InAppNotificationContext";

function App() {
  // Global presence heartbeat across the entire application (exam, flashcards, home, etc.)
  usePresence();

  const REFERRAL_STORAGE_KEY = "quizbolt_referral_code";

  // Capture referral code from URL (e.g. https://quizbolt.site?ref=QB-T4LD)
  // so it survives the redirect to /landing.
  try {
    const params = new URLSearchParams(window.location.search);
    const refFromUrl = params.get("ref");
    if (refFromUrl) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, refFromUrl);
    }
  } catch {
    // Ignore storage / URL parsing issues.
  }

  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [hasRetaken, setHasRetaken] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const [answers, setAnswers] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });
  const [autoAdvance, setAutoAdvance] = useState(() => {
    try {
      const saved = localStorage.getItem("autoAdvancePreference");
      return saved !== null ? JSON.parse(saved) : false; // Default to false
    } catch {
      return true;
    }
  });

  const [shuffleOptions, setShuffleOptions] = useState(() => {
    try {
      const saved = localStorage.getItem("shuffleOptionsPreference");
      return saved !== null ? JSON.parse(saved) : true; // Default to true
    } catch {
      return true;
    }
  });

  const [unlimitedHints, setUnlimitedHints] = useState(() => {
    try {
      const saved = localStorage.getItem("unlimitedHintsPreference");
      return saved !== null ? JSON.parse(saved) : false; // Default: limits on
    } catch {
      return false;
    }
  });

  const [showPagination, setShowPagination] = useState(() => {
    try {
      const saved = localStorage.getItem("showPaginationPreference");
      return saved !== null ? JSON.parse(saved) : true; // Default to true
    } catch {
      return true;
    }
  });

  // FIX: Initialize results logic
  const [results, setResults] = useState({ correct: 0, wrong: 0, answered: 0 });
  const [lastTimeTaken, setLastTimeTaken] = useState(0);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionType, setQuestionTypeState] = useState("objective");
  const [questionsContext, setQuestionsContext] = useState(null);
  const sessionRestoredRef = useRef(false);

  const isPremium = userProfile?.isPremium === true;

  // isNew: true when the logged-in user has never taken an exam.
  // Source of truth = exam_attempts count fetched on login.
  // localStorage is only a cache so the UI doesn't flicker on re-render.
  const [isNew, setIsNew] = useState(() => {
    try {
      // "1" = new user (no exams), "0" = has exams. Default true until login resolves.
      return localStorage.getItem("quizbolt_is_new_user") !== "0";
    } catch {
      return true;
    }
  });
  const setQuestionType = useCallback(
    (nextQuestionType) => {
      setQuestionTypeState((previousQuestionType) => {
        const resolvedQuestionType =
          typeof nextQuestionType === "function"
            ? nextQuestionType(previousQuestionType)
            : nextQuestionType;

        return resolvedQuestionType === "theory" && !isPremium
          ? "objective"
          : resolvedQuestionType;
      });
    },
    [isPremium],
  );

  const handleExamSubmit = (correctCount, totalCount, timeTaken) => {
    const total = totalCount ?? questions.length;

    setResults({
      correct: parseFloat(correctCount.toFixed(2)),
      wrong: parseFloat((total - correctCount).toFixed(2)),
      answered: total,
    });
    setLastTimeTaken(timeTaken ?? 0);

    // Mark user as no longer new after their first exam
    if (isNew) {
      setIsNew(false);
      try {
        localStorage.setItem("quizbolt_is_new_user", "0");
      } catch {
        /* ignore */
      }
    }
  };

  // In App.js
  const handlePremiumActivation = () => {
    setUserProfile((prev) => ({ ...prev, isPremium: true }));
  };

  const loadProfileAndCourses = useCallback(
    async (user, { initial = false } = {}) => {
      if (!user) {
        setUserProfile(null);
        setAvailableCourses([]);
        if (initial) setLoading(false);
        return;
      }

      try {
        const { data: profileData, error } = await withTimeout(
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          15000,
          "Loading your profile took too long. Please try again.",
        );

        if (error) throw error;

        // Profiles table is now the single source of truth for user info (except name)
        const profile = {
          id: user.id,
          full_name:
            profileData?.full_name ||
            profileData?.name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            "Scholar",
          user_name: profileData?.user_name || null,
          university: profileData?.university?.trim() || null,
          college: profileData?.college || null,
          department: profileData?.department || "General Studies",
          year: profileData?.year?.toString() || "1",
          isPremium: profileData?.is_premium === true,
          avatar_url: profileData?.avatar_url || null,
          avatar_public_id: profileData?.avatar_public_id || null,
          last_study_date: profileData?.last_study_date || null,
        };

        setUserProfile(profile);

        // Load bookmarks from profile
        setBookmarks(
          Array.isArray(profileData?.bookmarks) ? profileData.bookmarks : [],
        );

        // Derive isNew: check if user has any exam attempts
        try {
          const { count } = await supabase
            .from("exam_attempts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);

          const newUser = (count ?? 0) === 0;
          setIsNew(newUser);
          localStorage.setItem("quizbolt_is_new_user", newUser ? "1" : "0");
        } catch {
          // If the count fetch fails, fall back to the cached value — no-op
        }
        setCoursesLoading(true);
        try {
          const params = new URLSearchParams();

          // Pass level if available
          if (profile.year) {
            params.append("level", `${profile.year}00`);
          }

          // Pass college if available
          if (profile.college) {
            params.append("college", profile.college.trim());
          }

          // Pass university if available
          if (profile.university) {
            params.append("university", profile.university.trim());
          }

          // Get the current session token from Supabase
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const headers = {};
          if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
          }

          const res = await fetch(
            `${API_BASE_URL}/courses?${params.toString()}`,
            { headers },
          );
          const data = await res.json();

          if (!res.ok) {
            console.error("Courses fetch failed:", data?.msg || res.status);
            setAvailableCourses([]);
          } else {
            setAvailableCourses(Array.isArray(data) ? data : []);
          }
        } catch (coursesErr) {
          console.error("Courses fetch error:", coursesErr);
          setAvailableCourses([]);
        } finally {
          setCoursesLoading(false);
        }
      } catch (err) {
        console.error("Profile fetch error:", err.message);
        // On initial load, fall back to logged-out state.
        // On later updates, keep the last known profile instead of wiping it.
        if (initial) {
          setUserProfile(null);
          setAvailableCourses([]);
        }
      } finally {
        if (initial) {
          setLoading(false);
        }
      }
    },
    [],
  );

  const refreshAppProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await loadProfileAndCourses(session?.user);
  }, [loadProfileAndCourses]);

  useEffect(() => {
    // Track whether the initial session load has finished, so the
    // visibility handler doesn't fire on the very first paint.
    const initialLoadDone = { current: false };

    // Initial load
    supabase.auth.getSession().then(({ data }) => {
      loadProfileAndCourses(data.session?.user, { initial: true }).finally(
        () => {
          initialLoadDone.current = true;
        },
      );
    });

    // Auth listener — fires on SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, etc.
    // This is the primary way the profile stays in sync after a session refresh.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadProfileAndCourses(session?.user);
      },
    );

    // When the tab becomes visible again after being hidden (idle / tab switch /
    // minimised), force a session refresh. Supabase will emit TOKEN_REFRESHED
    // via onAuthStateChange, which calls getProfile automatically above.
    // If the session truly expired the user is signed out gracefully.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible" || !initialLoadDone.current) {
        return;
      }
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn(
            "[App] Session refresh failed on tab focus:",
            error.message,
          );
          // onAuthStateChange SIGNED_OUT will clear the profile automatically
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.error("[App] Visibility refresh error:", err);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      listener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadProfileAndCourses]);

  useEffect(() => {
    if (sessionRestoredRef.current) return;
    setHasRetaken(false); // every time new questions are loaded
  }, [questions]);

  // Restore any in‑progress exam from localStorage on hard refresh
  useEffect(() => {
    try {
      const parsed = loadExamSession();
      if (!parsed) return;

      // Set the flag FIRST before any state updates so the fetch effect
      // sees it when it re-runs due to selectedCourse/questionType changing
      sessionRestoredRef.current = true;

      if (parsed?.questionType === "theory") {
        setQuestionTypeState("theory");
      }

      if (parsed?.questionType === "fib") {
        setQuestionTypeState("fib");
      }

      if (parsed?.selectedCourse) {
        setSelectedCourse(parsed.selectedCourse);
      }

      if (Array.isArray(parsed?.questions) && parsed.questions.length > 0) {
        setQuestions(parsed.questions);
        setQuestionsContext({
          courseId: parsed?.selectedCourse?.id ?? null,
          questionType: parsed?.questionType ?? "objective",
        });
      }

      if (Array.isArray(parsed?.answers)) {
        setAnswers(parsed.answers);
      }

      setHasRetaken(parsed?.hasRetaken === true || parsed?.is_retake === true);
    } catch (err) {
      console.error("Failed to restore exam session:", err);
    }
  }, [loadProfileAndCourses]);

  useEffect(() => {
    const isExistingTheoryExam =
      questionsContext?.questionType === "theory" &&
      questions.length > 0 &&
      ["/exam", "/results", "/review-answers"].includes(
        window.location.pathname,
      );

    if (!isPremium && questionType === "theory" && !isExistingTheoryExam) {
      clearExamSession();
      setQuestionTypeState("objective");
      setQuestions([]);
      setAnswers([]);
      setQuestionsContext(null);
      setSelectedQuestionCount(null);
    }
  }, [isPremium, questionType, questions.length, questionsContext]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "autoAdvancePreference",
        JSON.stringify(autoAdvance),
      );
    } catch (err) {
      console.error("Failed to save auto-advance preference:", err);
    }
  }, [autoAdvance]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "shuffleOptionsPreference",
        JSON.stringify(shuffleOptions),
      );
    } catch (err) {
      console.error("Failed to save shuffle options preference:", err);
    }
  }, [shuffleOptions]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "unlimitedHintsPreference",
        JSON.stringify(unlimitedHints),
      );
    } catch (err) {
      console.error("Failed to save unlimited hints preference:", err);
    }
  }, [unlimitedHints]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "showPaginationPreference",
        JSON.stringify(showPagination),
      );
    } catch (err) {
      console.error("Failed to save pagination preference:", err);
    }
  }, [showPagination]);

  useEffect(() => {
    const loadQuestionsForSelectedCourse = async () => {
      // Don't wipe a just-restored session — wait until the user picks a new exam
      if (!selectedCourse || !selectedQuestionCount) {
        if (!sessionRestoredRef.current) {
          setQuestions([]);
          setAnswers([]);
          setQuestionsContext(null);
        }
        return;
      }

      // Once the user actively picks a course/count, the restored session is no longer relevant
      sessionRestoredRef.current = false;

      setQuestions([]);
      setAnswers([]);
      setQuestionsLoading(true);
      setQuestionsContext(null);

      const requestCourseId = selectedCourse.id;
      const requestQuestionType = questionType;

      try {
        const endpoint =
          selectedCourse.questionsEndpoint ||
          `/courses/${requestCourseId}/${selectedCourse.university}/questions`;

        const url = new URL(`${API_BASE_URL}${endpoint}`);
        if (requestQuestionType === "theory") {
          url.searchParams.set("type", "theory");
        } else if (requestQuestionType === "fib") {
          url.searchParams.set("type", "fib");
        }

        const res = await fetch(url.toString());
        const data = await res.json();

        if (!res.ok) {
          console.error(
            "Failed to load questions for course:",
            data?.msg || res.status,
          );
          setQuestions([]);
          setQuestionsContext(null);
          return;
        }

        const allQuestions = Array.isArray(data) ? data : [];
        const count =
          selectedQuestionCount === "All"
            ? allQuestions.length
            : Math.min(selectedQuestionCount, allQuestions.length);

        const shuffled = [...allQuestions];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setQuestions(shuffled.slice(0, count));
        setAnswers([]);
        setQuestionsContext({
          courseId: requestCourseId,
          questionType: requestQuestionType,
        });
      } catch (err) {
        console.error("Error fetching course questions:", err);
        setQuestions([]);
        setQuestionsContext(null);
      } finally {
        setQuestionsLoading(false);
      }
    };

    loadQuestionsForSelectedCourse();
  }, [selectedCourse, selectedQuestionCount, questionType]);

  // Bookmarks are now loaded from Supabase via getProfile below

  const handleLogout = async () => {
    try {
      trackLogout();
      await supabase.auth.signOut();
      setUserProfile(null);
      setAvailableCourses([]);
      setQuestions([]);
      setAnswers([]);
      setResults({ correct: 0, wrong: 0, answered: 0 });
      setIsNew(true); // reset so next login re-derives from Supabase

      // Clear all localStorage data except bookmarked questions and visited status
      try {
        // Save certain items temporarily
        const visitedStatus = localStorage.getItem("visited");
        const notificationsEnabled = localStorage.getItem(
          "quizbolt_notifications_enabled",
        );

        // Clear all localStorage
        localStorage.clear();

        // Restore saved items
        if (visitedStatus) {
          localStorage.setItem("visited", visitedStatus);
        }
        if (notificationsEnabled) {
          localStorage.setItem(
            "quizbolt_notifications_enabled",
            notificationsEnabled,
          );
        }
      } catch (err) {
        console.error("Failed to clear localStorage on logout:", err);
      }

      window.location.href = "/login";
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  const handleUpdateProfile = async (updates) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await withTimeout(
        supabase.auth.getUser(),
        15000,
        "Session check took too long while updating your profile.",
      );
      if (userError) throw userError;

      const { full_name, user_name, department } = updates || {};

      // Determine next values, falling back to existing profile data
      const nextFullName = full_name ?? userProfile?.full_name ?? "";
      // Always store usernames in lowercase
      const nextUserName = (user_name ?? userProfile?.user_name ?? "").toLowerCase();
      const nextDepartment = department ?? userProfile?.department ?? "";

      // If the username is changing, verify it's not already taken by someone else
      if (
        nextUserName &&
        nextUserName.toLowerCase() !== (userProfile?.user_name ?? "").toLowerCase()
      ) {
        const { count: takenCount } = await withTimeout(
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .ilike("user_name", nextUserName)
            .neq("id", user.id),
          10000,
          "Username check timed out. Please try again.",
        );

        if ((takenCount ?? 0) > 0) {
          throw new Error(
            "That username is already taken. Please choose a different one.",
          );
        }
      }

      // Upsert profile fields in profiles table (include other known fields for safety)
      const { error: upsertError } = await withTimeout(
        supabase.from("profiles").upsert(
          {
            id: user.id,
            full_name: nextFullName || null,
            user_name: nextUserName || null,
            department: nextDepartment || null,
            college: userProfile?.college ?? null,
            year: userProfile?.year ? Number(userProfile.year) : null,
            is_premium: userProfile?.isPremium ?? null,
            // Ensure NOT NULL onboarding_complete is always set
            onboarding_complete: true,
            // Ensure NOT NULL updated_at is always set
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        ),
        15000,
        "Saving your profile took too long. Please try again.",
      );

      if (upsertError) throw upsertError;

      // Update local React state so UI reflects changes immediately
      setUserProfile((prev) => ({
        ...prev,
        full_name: nextFullName,
        user_name: nextUserName,
        department: nextDepartment,
      }));
    } catch (err) {
      console.error("Update profile failed:", err.message);
      throw err;
    }
  };

  const deleteImage = async (publicId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cloudinary/delete-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: publicId }),
      });

      const data = await res.json();
      console.log("Delete response:", data);

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete image");
      }

      return data;
    } catch (error) {
      console.error("Error deleting image:", error);
      throw error;
    }
  };

  const props = {
    answers,
    setAnswers,
    questions,
    setQuestions,
    // FIX: Pass the actual submit handler
    onSubmit: handleExamSubmit,
    results,
    timeTaken: lastTimeTaken,
    courses: availableCourses,
    selectedCourse,
    setSelectedCourse,
    bookmarks,
    setBookmarks,
    isDarkMode,
    toggleDarkMode: () => setIsDarkMode((prev) => !prev),
    autoAdvance,
    toggleAutoAdvance: () => setAutoAdvance((prev) => !prev),
    shuffleOptions,
    toggleShuffleOptions: () => setShuffleOptions((prev) => !prev),
    unlimitedHints,
    toggleUnlimitedHints: () => setUnlimitedHints((prev) => !prev),
    showPagination,
    toggleShowPagination: () => setShowPagination((prev) => !prev),
    selectedQuestionCount,
    setSelectedQuestionCount,
    userProfile,
    setUserProfile,
    loadingProfile: loading,
    coursesLoading,
    isPremium,
    handleLogout,
    hasRetaken,
    setHasRetaken,
    questionsLoading,
    deleteImage,
    questionType,
    setQuestionType,
    questionsContext,
    isNew,
  };

  const withDesktop = (element) => (
    <DesktopLayout
      isPremium={isPremium}
      userProfile={userProfile}
      isNew={isNew}
    >
      {element}
    </DesktopLayout>
  );

  const hasActiveExamState =
    Boolean(selectedCourse) &&
    (questionsLoading ||
      (questions.length > 0 &&
        questionsContext?.courseId === selectedCourse?.id &&
        questionsContext?.questionType === questionType));

  const hasResultState =
    Boolean(selectedCourse) && questions.length > 0 && results.answered > 0;

  return (
    <Router>
      <RouteChangeTracker />
      {loading ? (
        <LoadingScreen text="Authenticating" />
      ) : (
        <AuthProvider>
          <InAppNotificationProvider>
            <Routes>
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <GuestRoute>
                  <SignUp />
                </GuestRoute>
              }
            />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route
              path="/reset-password"
              element={
                <GuestRoute>
                  <ResetPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/update-password"
              element={
                <GuestRoute>
                  <UpdatePassword />
                </GuestRoute>
              }
            />
            <Route
              path="/confirm-email"
              element={
                <GuestRoute>
                  <ConfirmEmailScreen />
                </GuestRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <OnboardingRoute>
                  <OnboardingScreen onProfileReady={refreshAppProfile} />
                </OnboardingRoute>
              }
            />
            <Route
              path="/"
              element={
                localStorage.getItem("visited") === "true" ? (
                  <ProtectedRoute>
                    {withDesktop(<Home {...props} />)}
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/landing" replace />
                )
              }
            />
            <Route
              path="/choose-course"
              element={
                <ProtectedRoute>
                  {withDesktop(<ChooseCourseScreen {...props} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookmarks"
              element={
                <ProtectedRoute>
                  {withDesktop(<BookMark {...props} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  {withDesktop(<HistoryScreen {...props} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <LeaderboardScreen
                      courses={availableCourses}
                      isPremium={isPremium}
                      userProfile={userProfile}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/u/:username"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <ProfilePage
                      userProfile={userProfile}
                      courses={availableCourses}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  {withDesktop(<ConversationList />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:username"
              element={
                <ProtectedRoute>
                  {withDesktop(<ChatView />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <Profile
                      userProfile={userProfile}
                      isPremium={isPremium}
                      onUpdateProfile={handleUpdateProfile}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/referral-dashboard"
              element={
                <ProtectedRoute>
                  {withDesktop(<ReferralDashboard isPremium={isPremium} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/submit-review"
              element={
                <ProtectedRoute>
                  {withDesktop(<SubmitReview userProfile={userProfile} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <SettingsScreen
                      userProfile={userProfile}
                      isPremium={isPremium}
                      onLogout={handleLogout}
                      isDarkMode={isDarkMode}
                      toggleDarkMode={() => setIsDarkMode((prev) => !prev)}
                      autoAdvance={autoAdvance}
                      toggleAutoAdvance={() => setAutoAdvance((prev) => !prev)}
                      shuffleOptions={shuffleOptions}
                      toggleShuffleOptions={() =>
                        setShuffleOptions((prev) => !prev)
                      }
                      unlimitedHints={unlimitedHints}
                      toggleUnlimitedHints={() =>
                        setUnlimitedHints((prev) => !prev)
                      }
                      showPagination={showPagination}
                      toggleShowPagination={() =>
                        setShowPagination((prev) => !prev)
                      }
                      deleteImage={deleteImage}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/exam"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    hasActiveExamState ? (
                      <ExamScreen {...props} />
                    ) : (
                      <RouteStateFallback
                        title="No exam in progress"
                        message="Choose a course first so QuizBolt can prepare the right questions for you."
                      />
                    ),
                  )}
                </ProtectedRoute>
              }
            />

            <Route
              path="/results"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    hasResultState ? (
                      <ResultScreen {...props} />
                    ) : (
                      <RouteStateFallback
                        title="No result available"
                        message="Submit an exam first, then your score and review options will appear here."
                      />
                    ),
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/review-answers"
              element={
                <ProtectedRoute
                  stateCheck={answers.length > 0 && questions.length > 0}
                >
                  {withDesktop(<ReviewAnswers {...props} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/premium"
              element={
                <ProtectedRoute
                  stateCheck={answers.length > 0 && questions.length > 0}
                >
                  {withDesktop(
                    <PremiumPage
                      {...props}
                      onActivatePremium={handlePremiumActivation}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload-profile-pic"
              element={
                <ProtectedRoute>
                  {withDesktop(<UploadProfilePic {...props} />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/flashcards"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <FlashcardsScreen
                      courses={availableCourses}
                      coursesLoading={coursesLoading}
                      isPremium={isPremium}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/match"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <MatchScreen
                      courses={availableCourses}
                      coursesLoading={coursesLoading}
                      isPremium={isPremium}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/match-result"
              element={
                <ProtectedRoute>
                  {withDesktop(<MatchResultScreen />)}
                </ProtectedRoute>
              }
            />
            <Route
              path="/test"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <TestModeScreen
                      courses={availableCourses}
                      coursesLoading={coursesLoading}
                      isPremium={isPremium}
                      userProfile={userProfile}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-leaderboard"
              element={
                <ProtectedRoute>
                  {withDesktop(
                    <TestLeaderboardScreen
                      courses={availableCourses}
                      isPremium={isPremium}
                      userProfile={userProfile}
                    />,
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-result"
              element={
                <ProtectedRoute>
                  {withDesktop(<TestResultScreen />)}
                </ProtectedRoute>
              }
            />
            {/* Advertiser self-serve stats — no nav link, URL only */}
            <Route path="/ad-stats" element={<AdStatsPage />} />
            {/* Catch-all 404 route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </InAppNotificationProvider>
      </AuthProvider>
      )}
      <SpeedInsights />
    </Router>
  );
}

export default App;
