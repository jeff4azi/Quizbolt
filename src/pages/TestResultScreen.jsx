import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from "react-icons/fi";
import { FaCrown, FaMedal, FaTrophy } from "react-icons/fa";
import Avatar from "../components/Avatar";
import testIcon from "../images/test.webp";
import useDocumentTitle from "../hooks/useDocumentTitle";

// ─── helpers ─────────────────────────────────────────────────────────────────
const rankBadge = (rank) => {
  if (rank === 1)
    return {
      bg: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
      icon: <FaCrown className="text-amber-400" />,
    };
  if (rank === 2)
    return {
      bg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
      icon: <FaMedal className="text-slate-400" />,
    };
  if (rank === 3)
    return {
      bg: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
      icon: <FaMedal className="text-orange-400" />,
    };
  return {
    bg: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
    icon: <span className="text-xs font-black">#{rank}</span>,
  };
};

const getWeekStartIso = () => {
  const now = new Date();
  const diff = now.getDay();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - diff,
    0,
    0,
    0,
    0,
  );
  return start.toISOString();
};

const cardColor = (pct) => {
  if (pct >= 70)
    return "bg-emerald-600 shadow-xl shadow-emerald-200 dark:shadow-none";
  if (pct >= 50)
    return "bg-amber-500 shadow-xl shadow-amber-200 dark:shadow-none";
  return "bg-red-500 shadow-xl shadow-red-200 dark:shadow-none";
};

const TestResultScreen = () => {
  useDocumentTitle("Weekly Test Results | QuizBolt");
  const navigate = useNavigate();
  const location = useLocation();
  const { score, totalQuestions, courseId, courseName } = location.state || {};

  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLB, setLoadingLB] = useState(true);
  const [myUserId, setMyUserId] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (!courseId) navigate("/test", { replace: true });
  }, [courseId, navigate]);

  useEffect(() => {
    if (!courseId) return;
    const load = async () => {
      setLoadingLB(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setMyUserId(user?.id ?? null);

        const weekStart = getWeekStartIso();

        const { data, error } = await supabase
          .from("test_attempts")
          .select(
            "user_id, score, total_questions, created_at, profiles(full_name, avatar_url, is_premium, user_name)",
          )
          .eq("course_id", courseId)
          .gte("created_at", weekStart)
          .order("score", { ascending: false })
          .limit(100);

        if (error) throw error;

        // Best attempt per user (highest score, then most questions)
        const bestByUser = new Map();
        (data || []).forEach((row) => {
          const existing = bestByUser.get(row.user_id);
          const pct = row.total_questions ? row.score / row.total_questions : 0;
          const existingPct = existing
            ? existing.score / existing.total_questions
            : -1;
          if (!existing || pct > existingPct) bestByUser.set(row.user_id, row);
        });

        const sorted = Array.from(bestByUser.values()).sort((a, b) => {
          const pa = a.total_questions ? a.score / a.total_questions : 0;
          const pb = b.total_questions ? b.score / b.total_questions : 0;
          return pb - pa;
        });

        setLeaderboard(sorted);
        const rank = sorted.findIndex((r) => r.user_id === user?.id);
        setMyRank(rank !== -1 ? rank + 1 : null);
      } catch (err) {
        console.error("Failed to load test leaderboard:", err);
      } finally {
        setLoadingLB(false);
      }
    };
    load();
  }, [courseId]);

  if (!courseId) return null;

  const pct = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;
  const correct = Math.round(score);
  const wrong = totalQuestions - correct;

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 flex flex-col transition-colors duration-500">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-md px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/test")}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm active:scale-90 transition-all shrink-0"
            >
              <FiChevronLeft className="size-5 text-slate-600 dark:text-slate-300" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-900 dark:text-white truncate">
                Test Results
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {courseName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/test-leaderboard")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-amber-300 dark:hover:border-amber-500/40 text-slate-700 dark:text-slate-200 text-xs font-bold active:scale-95 transition-all shrink-0"
            title="View Full Test Leaderboard"
          >
            <FaTrophy className="text-amber-500 size-3.5" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Leaderboard
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto space-y-5">
          {/* Score card */}
          <div className={`${cardColor(pct)} rounded-[2rem] p-6 text-white`}>
            <div className="flex items-center gap-3 mb-5">
              <div className="size-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <img
                  src={testIcon}
                  alt="Test"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">
                  Test Complete
                </p>
                <p className="text-white font-black text-lg">{courseName}</p>
              </div>
            </div>

            {/* Big score */}
            <div className="bg-white/15 rounded-2xl p-5 mb-3 text-center">
              <p className="text-6xl font-black tabular-nums">{pct}%</p>
              <p className="text-white/70 text-sm mt-1">
                {score.toFixed(1)} / {totalQuestions} correct
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/15 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                  Correct
                </p>
                <p className="text-2xl font-black tabular-nums">{correct}</p>
              </div>
              <div className="bg-white/15 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-1">
                  Wrong
                </p>
                <p className="text-2xl font-black tabular-nums">{wrong}</p>
              </div>
            </div>

            {myRank && (
              <button
                type="button"
                onClick={() => navigate("/test-leaderboard")}
                className="w-full mt-3 bg-white/15 hover:bg-white/20 active:scale-[0.98] transition-all rounded-2xl px-4 py-3 flex items-center justify-between text-left group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FaTrophy className="text-yellow-300 size-4 shrink-0" />
                  <p className="text-sm font-black">
                    You ranked <span className="text-yellow-300">#{myRank}</span>{" "}
                    this week
                  </p>
                </div>
                <span className="text-[11px] font-bold text-white/80 group-hover:text-white flex items-center gap-0.5 shrink-0">
                  Full board{" "}
                  <FiChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/test")}
              className="flex-1 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
            >
              <FiRefreshCw className="size-4" />
              Try Again
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex-1 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm active:scale-95 transition-all shadow-sm"
            >
              Home
            </button>
          </div>

          {/* Weekly Leaderboard */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <FaTrophy className="text-amber-400 size-4 shrink-0" />
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  This Week&apos;s Leaderboard
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate("/test-leaderboard")}
                className="group inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <span>Full Board</span>
                <FiChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {loadingLB ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 animate-pulse"
                  />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 text-center text-sm text-slate-400 space-y-3">
                <p>No attempts this week yet. You&apos;re first!</p>
                <button
                  type="button"
                  onClick={() => navigate("/test-leaderboard")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Check other courses on leaderboard</span>
                  <FiChevronRight className="size-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((row, i) => {
                  const isMe = row.user_id === myUserId;
                  const rank = i + 1;
                  const { bg, icon } = rankBadge(rank);
                  const name = row.profiles?.full_name || "Player";
                  const userName = row.profiles?.user_name;
                  const rowPremium = row.profiles?.is_premium === true;
                  const rowPct = row.total_questions
                    ? Math.round((row.score / row.total_questions) * 100)
                    : 0;

                  return (
                    <div
                      key={row.user_id}
                      className={`flex items-center gap-3 p-4 rounded-[1.8rem] border transition-all ${
                        isMe
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800"
                      }`}
                    >
                      <div
                        className={`size-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${bg}`}
                      >
                        {icon}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setPreviewUrl(row.profiles?.avatar_url || null)
                        }
                        className="shrink-0 rounded-full active:scale-90 transition-transform"
                      >
                        <Avatar
                          avatarUrl={row.profiles?.avatar_url}
                          size="sm"
                          lazy
                          className={
                            isMe
                              ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-blue-50 dark:ring-offset-slate-900"
                              : ""
                          }
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-black truncate flex items-center gap-1.5 ${isMe ? "text-blue-700 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}
                        >
                          {name}
                          {rowPremium && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide">
                              <FaCrown size={8} />
                              PRO
                            </span>
                          )}
                          {isMe && (
                            <span className="text-[10px] font-black text-blue-500">
                              (you)
                            </span>
                          )}
                        </p>
                        {userName && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                            @{userName}
                          </p>
                        )}
                      </div>

                      <span
                        className={`text-sm font-black tabular-nums shrink-0 ${isMe ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}`}
                      >
                        {rowPct}%
                      </span>
                    </div>
                  );
                })}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate("/test-leaderboard")}
                    className="w-full py-3.5 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-500/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.99] group"
                  >
                    <FaTrophy className="size-3.5 text-amber-500" />
                    <span>View Complete Test Leaderboard</span>
                    <FiChevronRight className="size-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avatar preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="size-64 rounded-full overflow-hidden shadow-2xl ring-4 ring-white/20 animate-in zoom-in-95 duration-200">
            <img
              src={previewUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TestResultScreen;
