import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useProfile } from "../hooks/useProfile";
import {
  FaHistory,
  FaChevronRight,
  FaTrashAlt,
  FaTrophy,
  FaChartLine,
  FaLayerGroup,
  FaRedoAlt,
  FaFire,
} from "react-icons/fa";
import {
  FiTrash2,
  FiClock,
  FiRefreshCw,
  FiTarget,
  FiAlertCircle,
  FiPieChart,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  fetchActiveCoursesForUser,
  getActiveCourseCodeSet,
  isCourseInActiveList,
} from "../utils/activeCourses";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import ConfirmOverlay from "../components/ConfirmOverlay";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import NavBar from "../components/NavBar";
import { useVisibilityRefresh } from "../hooks/useVisibilityRefresh";
import SectionLoader from "../components/SectionLoader";

const formatTime = (seconds) => {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

/* -------------------------------------------------------------------------- */
/*  CHART TAB OPTIONS                                                           */
/* -------------------------------------------------------------------------- */
const CHART_TABS = [
  { key: "score", label: "Score %" },
  { key: "time", label: "Time taken" },
  { key: "questions", label: "Questions" },
];

/* -------------------------------------------------------------------------- */
/*  MAIN SCREEN                                                                 */
/* -------------------------------------------------------------------------- */
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

const HistoryScreen = ({
  isPremium,
  setQuestionType,
  courses = [],
  userProfile,
}) => {
  useDocumentTitle("Study History | QuizBolt");
  const { profile, loading: profileLoading } = useProfile();
  const [historyData, setHistoryData] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [activeCoursesList, setActiveCoursesList] = useState(courses || []);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOverlayOpen, setOverlayOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [chartTab, setChartTab] = useState("score");

  const navigate = useNavigate();

  // Load and sync active courses
  useEffect(() => {
    if (courses && courses.length > 0) {
      setActiveCoursesList(courses);
      return;
    }
    const currentProfile = userProfile || profile;
    if (currentProfile?.university) {
      fetchActiveCoursesForUser(currentProfile).then((fetched) => {
        if (fetched && fetched.length > 0) {
          setActiveCoursesList(fetched);
        }
      });
    }
  }, [courses, userProfile, profile]);

  const activeCourseCodes = useMemo(() => {
    return getActiveCourseCodeSet(activeCoursesList);
  }, [activeCoursesList]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
      error: userError,
    } = await withTimeout(
      supabase.auth.getUser(),
      15000,
      "Session check took too long while loading history.",
    );

    if (userError || !user) {
      setHistoryData([]);
      setLoading(false);
      return;
    }

    // Fetch all three attempt types in parallel
    const [examResult, testResult, matchResult] = await Promise.all([
      withTimeout(
        supabase
          .from("exam_attempts")
          .select(
            `id, course_id, score, total_questions, date_taken, time_taken, is_retake, type`,
          )
          .eq("user_id", user.id)
          .order("date_taken", { ascending: false }),
        15000,
        "Loading your exam history took too long. Please try again.",
      ),
      withTimeout(
        supabase
          .from("test_attempts")
          .select(`id, course_id, created_at`)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        15000,
        "Loading your test history took too long. Please try again.",
      ),
      withTimeout(
        supabase
          .from("match_attempts")
          .select(`id, course_id, created_at`)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        15000,
        "Loading your match history took too long. Please try again.",
      ),
    ]);

    // Set historyData to just exam_attempts as before (for other parts of UI)
    if (examResult.error) {
      console.error("Failed to fetch exam history:", examResult.error.message);
      setHistoryData([]);
    } else {
      setHistoryData(examResult.data || []);
    }

    // Store all attempts for weekly activity calculation
    const allAttempts = [
      ...(examResult.data || []).map(a => ({ ...a, type: 'exam' })),
      ...(testResult.data || []).map(a => ({ ...a, type: 'test' })),
      ...(matchResult.data || []).map(a => ({ ...a, type: 'match' })),
    ];

    setAllAttempts(allAttempts);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);
  useVisibilityRefresh(fetchHistory);

  useEffect(() => {
    const getContainer = () =>
      window.innerWidth >= 1024
        ? document.querySelector(".desktop-content-wrapper") || window
        : window;
    const getScroll = () => {
      const el = getContainer();
      return el === window ? window.scrollY : el.scrollTop;
    };
    const handler = () => setIsScrolled(getScroll() > 10);

    const wrapper = document.querySelector(".desktop-content-wrapper");
    if (wrapper) wrapper.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      if (wrapper) wrapper.removeEventListener("scroll", handler);
      window.removeEventListener("scroll", handler);
    };
  }, []);

  /* -------------------------------- STATS ---------------------------------- */
  const totalExams = historyData.length;

  const bestScore =
    totalExams > 0
      ? Math.max(
          ...historyData.map(
            (h) => (Number(h.score) / Number(h.total_questions)) * 100,
          ),
        )
      : 0;

  const avgScore =
    totalExams > 0
      ? Math.round(
          historyData.reduce(
            (acc, h) =>
              acc + (Number(h.score) / Number(h.total_questions)) * 100,
            0,
          ) / totalExams,
        )
      : 0;

  const avgTime =
    totalExams > 0
      ? Math.round(
          historyData.reduce((acc, h) => acc + (Number(h.time_taken) || 0), 0) /
            totalExams,
        )
      : 0;

  const retakeCount = historyData.filter((h) => h.is_retake).length;
  const retakeRate =
    totalExams > 0 ? Math.round((retakeCount / totalExams) * 100) : 0;

  /* ----------------------------- STREAK ------------------------------------ */
  const streak = useMemo(() => {
    if (!profile) return 0;
    return isValidStreak(profile.last_study_date, profile.current_streak);
  }, [profile]);

  const bestStreak = profile?.best_streak || 0;

  /* ----------------------- INSIGHTS: top + worst course ------------------- */
  const courseInsights = useMemo(() => {
    // Best and worst course insights are restricted strictly to active courses
    // (from active semester in user's university & current year/level, plus overrides)
    if (!activeCourseCodes || activeCourseCodes.size === 0) {
      return { top: null, worst: null };
    }

    const filtered = historyData.filter(
      (h) => !h.is_retake && isCourseInActiveList(h.course_id, activeCourseCodes)
    );
    const map = {};
    filtered.forEach((h) => {
      if (!h.course_id || !h.total_questions) return;
      const pct = (Number(h.score) / Number(h.total_questions)) * 100;
      if (!map[h.course_id]) map[h.course_id] = { total: 0, count: 0 };
      map[h.course_id].total += pct;
      map[h.course_id].count += 1;
    });
    const entries = Object.entries(map).map(([id, v]) => ({
      id,
      avg: Math.round(v.total / v.count),
      count: v.count,
    }));
    entries.sort((a, b) => b.avg - a.avg);
    return {
      top: entries[0] || null,
      worst: entries[entries.length - 1] || null,
    };
  }, [historyData, activeCourseCodes]);

  /* ----------------------- MODE SPLIT ------------------------------------- */
  const modeSplit = useMemo(() => {
    const filtered = historyData.filter((h) => !h.is_retake);
    const counts = { OBJ: 0, FIB: 0, THY: 0 };
    filtered.forEach((h) => {
      if (h.type && counts[h.type] !== undefined) counts[h.type]++;
    });
    const total = filtered.length || 1;
    return {
      obj: Math.round((counts.OBJ / total) * 100),
      fib: Math.round((counts.FIB / total) * 100),
      thy: Math.round((counts.THY / total) * 100),
    };
  }, [historyData]);

  /* ----------------------- CHART DATA (last 15) ---------------------------- */
  const chartData = useMemo(() => {
    return [...historyData]
      .filter((h) => !h.is_retake)
      .slice(0, 15)
      .reverse()
      .map((h, i) => ({
        idx: i + 1,
        score: Math.round(
          (Number(h.score) / Number(h.total_questions || 1)) * 100,
        ),
        time: Number(h.time_taken) || 0,
        questions: Number(h.total_questions) || 0,
      }));
  }, [historyData]);

  /* ----------------------- WEEKLY ACTIVITY (last 7 days) ------------------ */
  const weeklyActivity = useMemo(() => {
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const key = d.toLocaleDateString("en-CA");
      const active = allAttempts.some((h) => {
        const dateStr = h.date_taken ? new Date(h.date_taken) : new Date(h.created_at);
        return dateStr.toLocaleDateString("en-CA") === key;
      });
      return { day: days[d.getDay()], active };
    });
  }, [allAttempts]);

  /* ----------------------- DELETE ----------------------------------------- */
  const deleteExam = async (id) => {
    const { error } = await withTimeout(
      supabase.from("exam_attempts").delete().eq("id", id),
      15000,
      "Deleting this attempt took too long.",
    );
    if (!error) setHistoryData((prev) => prev.filter((e) => e.id !== id));
  };

  const clearAllHistory = async () => {
    const {
      data: { user },
    } = await withTimeout(
      supabase.auth.getUser(),
      15000,
      "Session check failed.",
    );
    if (!user) return;
    const { error } = await withTimeout(
      supabase.from("exam_attempts").delete().eq("user_id", user.id),
      15000,
      "Clearing history took too long.",
    );
    if (!error) {
      setHistoryData([]);
      setOverlayOpen(false);
    }
  };

  /* ======================= RENDER ========================================= */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header
        className={`sticky top-0 z-50 px-6 py-4 transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm border-b border-slate-100 dark:border-slate-800"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tight">Activity Log</h1>
          {totalExams > 0 && (
            <button
              onClick={() => setOverlayOpen(true)}
              className="p-2.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
            >
              <FiTrash2 size={18} />
            </button>
          )}
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 pt-2 pb-32 flex-1 flex flex-col overflow-y-auto desktop-content-col">
        {loading ? (
          <SectionLoader text="Loading history..." />
        ) : totalExams === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <FaHistory size={28} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-black">No history yet</h3>
            <p className="text-slate-400 text-sm mt-2 max-w-[220px] leading-relaxed">
              Complete an exam to start tracking your performance here.
            </p>
          </div>
        ) : (
          <>
            {/* ---- STAT CARDS ---- */}
            <section className="mt-4 mb-6">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between mb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Overview
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    Your performance at a glance
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Track exam totals, score averages, time efficiency and retake
                  habits in one place.
                </p>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <StatCard
                  label="Exams done"
                  value={totalExams}
                  icon={<FaLayerGroup />}
                  color="blue"
                />
                <StatCard
                  label="Best score"
                  value={`${Math.round(bestScore)}%`}
                  icon={<FaTrophy />}
                  color="amber"
                />
                <StatCard
                  label="Avg. score"
                  value={`${avgScore}%`}
                  icon={<FaChartLine />}
                  color="green"
                />
                <StatCard
                  label="Avg. time"
                  value={formatTime(avgTime) || "—"}
                  icon={<FiClock />}
                  color="purple"
                />
                <StatCard
                  label="Retake rate"
                  value={totalExams > 0 ? `${retakeRate}%` : "—"}
                  sub={retakeCount > 0 ? `${retakeCount} retakes` : null}
                  icon={<FiRefreshCw />}
                  color="red"
                  wide
                />
              </div>
            </section>

            {/* ---- PERFORMANCE TREND CHART ---- */}
            {chartData.length > 1 && (
              <section className="mb-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Performance trend
                    </p>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                      Recent progress in one chart
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    Switch between score, time and questions to compare your
                    latest attempts.
                  </p>
                </div>

                {/* Tab switcher */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {CHART_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setChartTab(t.key)}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                        chartTab === t.key
                          ? "bg-slate-900 text-white shadow-lg"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/80 dark:border-slate-700/80 p-4 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.15)] overflow-hidden">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {CHART_TABS.find((tab) => tab.key === chartTab)?.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Last {chartData.length} attempts
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex h-2 w-2 rounded-full bg-slate-900 dark:bg-white" />
                      Latest data
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    {chartTab === "score" ? (
                      <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 15, left: -25, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(0,0,0,0.06)"
                        />
                        <XAxis
                          dataKey="idx"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "14px",
                            border: "none",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
                            fontSize: 12,
                          }}
                          formatter={(v) => [`${v}%`, "Score"]}
                          labelFormatter={(l) => `Attempt ${l}`}
                        />
                        <ReferenceLine
                          y={50}
                          stroke="#1D9E75"
                          strokeDasharray="5 4"
                          strokeWidth={1.5}
                          label={{
                            value: "Pass",
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: "#1D9E75",
                            fontWeight: 700,
                          }}
                        />
                        <ReferenceLine
                          y={Math.round(avgScore)}
                          stroke="#8B5CF6"
                          strokeDasharray="4 6"
                          strokeWidth={1}
                          label={{
                            value: `Avg ${Math.round(avgScore)}%`,
                            position: "insideTopRight",
                            fontSize: 10,
                            fill: "#8B5CF6",
                            fontWeight: 700,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#2563EB"
                          strokeWidth={3}
                          dot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
                          activeDot={{
                            r: 6,
                            fill: "#fff",
                            stroke: "#2563EB",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    ) : chartTab === "time" ? (
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(0,0,0,0.06)"
                        />
                        <XAxis
                          dataKey="idx"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${Math.floor(v / 60)}m`}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                            fontSize: 12,
                          }}
                          formatter={(v) => [formatTime(v), "Time"]}
                          labelFormatter={(l) => `Attempt ${l}`}
                        />
                        <Bar
                          dataKey="time"
                          fill="#7F77DD"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    ) : (
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(0,0,0,0.06)"
                        />
                        <XAxis
                          dataKey="idx"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
                            fontSize: 12,
                          }}
                          formatter={(v) => [v, "Questions"]}
                          labelFormatter={(l) => `Attempt ${l}`}
                        />
                        <Bar
                          dataKey="questions"
                          fill="#1D9E75"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                  <p className="text-center text-[10px] text-slate-400 mt-2">
                    Last {chartData.length} attempts
                  </p>
                </div>
              </section>
            )}

            {/* ---- INSIGHTS ---- */}
            <section className="mb-6">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 ml-1 mb-3">
                Insights
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {/* Streak */}
            <div className="col-span-2 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="size-11 rounded-3xl bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-300 grid place-items-center">
                    <FaFire size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] font-black text-slate-400 dark:text-slate-500 mb-1">
                      Daily streak
                    </p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      {streak} {streak === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] font-black text-slate-400 dark:text-slate-500 mb-1">
                    Best streak
                  </p>
                  <div className="flex items-center gap-1">
                    <FaTrophy size={14} className="text-amber-500" />
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {bestStreak} {bestStreak === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {weeklyActivity.map((d, i) => (
                  <div
                    key={i}
                    className={`aspect-square rounded-2xl flex items-center justify-center text-sm font-black transition-all ${
                      d.active
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {d.day}
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {streak > 0
                  ? `Keep it up! You've studied ${streak} day${streak > 1 ? "s" : ""} in a row.`
                  : "Start a streak — take an exam today!"}
              </p>
            </div>

                {/* Best course */}
                {courseInsights.top && (
                  <InsightCard
                    icon={<FiTarget size={13} />}
                    label="Best course"
                    value={
                      courseInsights.top.id?.replace(/([A-Za-z]+)(\d+)/, "$1 $2") ||
                      courseInsights.top.id
                    }
                    sub={`Avg. ${courseInsights.top.avg}% · ${courseInsights.top.count} exam${courseInsights.top.count > 1 ? "s" : ""}`}
                    colorClass="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                  />
                )}

                {/* Needs work */}
                {courseInsights.worst &&
                  courseInsights.worst.id !== courseInsights.top?.id && (
                    <InsightCard
                      icon={<FiAlertCircle size={13} />}
                      label="Needs work"
                      value={
                        courseInsights.worst.id?.replace(/([A-Za-z]+)(\d+)/, "$1 $2") ||
                        courseInsights.worst.id
                      }
                      sub={`Avg. ${courseInsights.worst.avg}% — try retaking`}
                      colorClass="text-red-500 bg-red-50 dark:bg-red-900/20"
                    />
                  )}

                {/* Mode split */}
                <div className="col-span-2 bg-slate-100/80 dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <FiPieChart
                      size={14}
                      className="text-slate-700 dark:text-slate-200"
                    />
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      Mode split
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: "Objective",
                        pct: modeSplit.obj,
                        color: "bg-blue-500",
                      },
                      {
                        label: "Fill in blank",
                        pct: modeSplit.fib,
                        color: "bg-emerald-500",
                      },
                      {
                        label: "Theory",
                        pct: modeSplit.thy,
                        color: "bg-amber-500",
                      },
                    ]
                      .filter((m) => m.pct > 0)
                      .map((m) => (
                        <div key={m.label} className="flex-1">
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden mb-1.5">
                            <div
                              className={`h-full rounded-full ${m.color}`}
                              style={{ width: `${m.pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500">
                            {m.label}
                          </p>
                          <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                            {m.pct}%
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ---- HISTORY LIST ---- */}
            <section>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between mb-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Recent attempts
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                    Latest exam results
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Tap an attempt to retake the same course and keep improving.
                </p>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
                {historyData.map((exam) => (
                  <HistoryItem
                    key={exam.id}
                    exam={{
                      ...exam,
                      course: exam.course_id,
                      total: exam.total_questions,
                      date: new Date(exam.date_taken).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      ),
                    }}
                    onDelete={() => deleteExam(exam.id)}
                    setQuestionType={setQuestionType}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <ConfirmOverlay
        isOpen={isOverlayOpen}
        onClose={() => setOverlayOpen(false)}
        onConfirm={clearAllHistory}
        title="Clear History"
        message="This action cannot be undone. All your progress data will be reset."
        danger={true}
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
        isPremium={isPremium}
        onLockedClick={() => setPremiumOverlayOpen(true)}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  STAT CARD                                                                   */
/* -------------------------------------------------------------------------- */
const StatCard = ({ label, value, sub, icon, color, wide = false }) => {
  const iconColors = {
    blue: "text-blue-600 bg-blue-100 dark:bg-blue-900/20",
    amber: "text-amber-600 bg-amber-100 dark:bg-amber-900/20",
    green: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20",
    purple: "text-purple-600 bg-purple-100 dark:bg-purple-900/20",
    red: "text-red-500 bg-red-100 dark:bg-red-900/20",
  };
  return (
    <div
      className={`bg-white dark:bg-slate-900 p-4 rounded-[1.75rem] border border-slate-200 dark:border-slate-700 shadow-sm ${wide ? "col-span-2" : ""}`}
    >
      <div
        className={`size-10 rounded-2xl flex items-center justify-center mb-3 ${iconColors[color]}`}
      >
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-none">
        {value}
      </p>
      {sub && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
      )}
      <p className="text-[10px] uppercase font-bold tracking-[0.18em] text-slate-400 dark:text-slate-500 mt-4">
        {label}
      </p>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*  INSIGHT CARD                                                                */
/* -------------------------------------------------------------------------- */
const InsightCard = ({ icon, label, value, sub, colorClass }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-[1.75rem] border border-slate-200 dark:border-slate-700 shadow-sm">
    <div
      className={`size-8 rounded-2xl flex items-center justify-center mb-3 ${colorClass}`}
    >
      {icon}
    </div>
    <p className="text-[10px] uppercase font-bold tracking-[0.18em] text-slate-400 mb-1">
      {label}
    </p>
    <p className="text-xl font-black text-slate-900 dark:text-white truncate">
      {value}
    </p>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-tight">
      {sub}
    </p>
  </div>
);

/* -------------------------------------------------------------------------- */
/*  HISTORY ITEM                                                                */
/* -------------------------------------------------------------------------- */
const HistoryItem = ({ exam, onDelete, setQuestionType }) => {
  const navigate = useNavigate();
  const score = parseFloat((Number(exam.score) || 0).toFixed(2));
  const total = Number(exam.total) || 1;
  const percent = Math.round((score / total) * 100);
  const isPassed = percent >= 50;
  const formattedTime = formatTime(exam.time_taken);

  const progressColor =
    percent >= 70 ? "#1D9E75" : percent >= 50 ? "#378ADD" : "#E24B4A";

  const handleRetake = () => {
    const typeMap = { THY: "theory", FIB: "fib", OBJ: "objective" };
    const qType = typeMap[exam.type] ?? "objective";
    if (setQuestionType) setQuestionType(qType);
    navigate(`/choose-course?course=${exam.course_id}`);
  };

  return (
    <div
      onClick={handleRetake}
      className={`group relative p-4 sm:p-5 rounded-[1.5rem] border flex items-center justify-between gap-4 transition-all duration-200 active:scale-[0.98] cursor-pointer ${
        exam.is_retake
          ? "border-purple-200 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-900/10"
          : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
      }`}
    >
      <div className="flex flex-col gap-2 min-w-0 mr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-none text-base sm:text-lg">
            {exam.course?.toLowerCase() || "Course"}
          </span>
          {exam.type && (
            <span
              className={`text-[10px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-2xl shrink-0 ${
                exam.type === "THY"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : exam.type === "FIB"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              }`}
            >
              {exam.type === "THY"
                ? "Theory"
                : exam.type === "FIB"
                  ? "Fill in Blanks"
                  : "Obj"}
            </span>
          )}
          {exam.is_retake && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 rounded-full px-2 py-1">
              <FaRedoAlt size={10} /> Retake
            </span>
          )}
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap gap-2 items-center">
          <span>{exam.date}</span>
          <span className="hidden sm:inline">·</span>
          <span>{total} Qs</span>
          {formattedTime && (
            <>
              <span className="hidden sm:inline">·</span>
              <FiClock size={12} className="opacity-70" />
              <span>{formattedTime}</span>
            </>
          )}
        </span>
        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mt-2">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, backgroundColor: progressColor }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="text-right">
          <p className="text-2xl font-black leading-none text-slate-900 dark:text-white">
            {score}
            <span className="text-sm text-slate-400 dark:text-slate-500 font-medium ml-1">
              /{total}
            </span>
          </p>
          <p
            className={`text-xs font-black mt-1 ${isPassed ? "text-emerald-500" : "text-red-500"}`}
          >
            {percent}% {isPassed ? "PASS" : "FAIL"}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-flex"
        >
          <FaTrashAlt size={14} />
        </button>
        <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 grid place-items-center">
          <FaChevronRight size={12} />
        </div>
      </div>
    </div>
  );
};

export default HistoryScreen;

import useDocumentTitle from "../hooks/useDocumentTitle";