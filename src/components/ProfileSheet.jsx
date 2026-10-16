import React, { useState, useEffect } from "react";
import { FaCrown, FaFire } from "react-icons/fa";
import {
  FiX,
  FiBook,
  FiAward,
  FiClock,
  FiHash,
  FiBookOpen,
  FiHome,
  FiLayers,
  FiUser,
  FiList,
} from "react-icons/fi";
import Avatar from "./Avatar";
import { supabase } from "../supabaseClient";
import { usePresence } from "../hooks/usePresence";

const getRelativeStudyLabel = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

const ProfileSheet = ({ isOpen, onClose, userProfile, isPremium, stats }) => {
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const { isOnline } = usePresence(userProfile?.id ? [userProfile.id] : []);
  const userIsOnline = userProfile?.id ? isOnline(userProfile.id) : false;
  const [courseTitle, setCourseTitle] = useState(null);

  useEffect(() => {
    if (!isOpen || !stats?.bestCourseId) {
      setCourseTitle(null);
      return;
    }
    setCourseTitle(null);

    supabase
      .from("courses_meta")
      .select("title")
      .eq("course_code", stats.bestCourseId)
      .maybeSingle()
      .then(({ data }) => setCourseTitle(data?.title ?? null));
  }, [isOpen, stats?.bestCourseId]);

  if (!isOpen) return null;

  const formatBestTime = (t) => {
    if (!t || !Number.isFinite(t) || t === Infinity) return "—";
    const mins = Math.floor(t / 60);
    const secs = t % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const rankNum = stats?.rank
    ? parseInt(stats.rank.replace("#", ""), 10)
    : null;
  const isTop1 = rankNum === 1;
  const isTop2 = rankNum === 2;
  const isTop3 = rankNum === 3;

  const collegeLabel = ["TASUED", "BOUESTI"].includes(userProfile?.university)
    ? "College"
    : "Faculty";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-auto bg-gray-50 dark:bg-slate-900 rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom-full duration-500 overflow-hidden lg:translate-x-30">
        {/* Grabber */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 bg-gray-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Profile
          </h2>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400"
          >
            <FiX size={14} />
          </button>
        </div>

        {/* Hero */}
        <div className="flex items-center gap-4 px-5 pt-1 pb-5">
          <button
            onClick={() => setIsImageOverlayOpen(true)}
            className="relative shrink-0 focus:outline-none"
          >
            <Avatar
              avatarUrl={userProfile?.avatar_url}
              size="lg"
              isOnline={userIsOnline}
              className="rounded-full ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm"
            />
            {isPremium && (
              <div className="absolute -top-1.5 -right-1.5 bg-amber-400 p-1.5 rounded-lg border-2 border-gray-50 dark:border-slate-900 z-20">
                <FaCrown className="text-white text-[12px]" />
              </div>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-slate-900 dark:text-white truncate leading-tight">
              {userProfile?.full_name || "Scholar"}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {userProfile?.user_name && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  @{userProfile.user_name}
                </p>
              )}
              {userIsOnline && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              )}
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isPremium
                  ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              {isPremium && <FaCrown size={8} />}
              {isPremium ? "Premium" : "Free tier"}
            </span>
          </div>

          {stats?.rank &&
            (() => {
              // Config map to cleanly separate styles without nested ternary hell
              const rankConfigs = {
                top1: {
                  gradient: "from-amber-500 via-amber-600 to-amber-800",
                  shadow:
                    "shadow-[0_0_20px_rgba(245,158,11,0.45),_0_4px_12px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.3)]",
                  crownColor: "text-amber-100",
                },
                top2: {
                  gradient: "from-slate-400 via-slate-500 to-slate-600",
                  shadow:
                    "shadow-[0_0_20px_rgba(148,163,184,0.35),_0_4px_12px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.25)]",
                  crownColor: "text-slate-100",
                },
                top3: {
                  gradient: "from-orange-400 via-orange-500 to-orange-700",
                  shadow:
                    "shadow-[0_0_20px_rgba(251,146,60,0.4),_0_4px_12px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.25)]",
                  crownColor: "text-orange-100",
                },
                default: {
                  gradient: "from-blue-500 via-blue-600 to-blue-700",
                  shadow:
                    "shadow-[0_0_20px_rgba(59,130,246,0.35),_0_4px_12px_rgba(0,0,0,0.25),_inset_0_1px_0_rgba(255,255,255,0.25)]",
                  crownColor: "",
                },
              };

              const currentKey = isTop1
                ? "top1"
                : isTop2
                  ? "top2"
                  : isTop3
                    ? "top3"
                    : "default";
              const config = rankConfigs[currentKey];
              const hasCrown = isTop1 || isTop2 || isTop3;

              return (
                <div className="shrink-0 flex items-center justify-center">
                  <div
                    className={`relative flex flex-col items-center justify-center size-20 rounded-2xl bg-gradient-to-br ${config.gradient} ${config.shadow} overflow-hidden transition-all duration-300`}
                  >
                    {/* Modern Glassy Shine Arc */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />

                    {/* Vertical Align Centered Flex Wrapper */}
                    <div className="flex flex-col items-center justify-center relative z-10 select-none">
                      {hasCrown && (
                        <FaCrown
                          size={13}
                          className={`${config.crownColor} filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)] mb-0.5`}
                        />
                      )}

                      <span
                        className={`font-black text-white leading-none tracking-tight text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${
                          stats.rank.length > 3 ? "text-lg" : "text-2xl"
                        }`}
                      >
                        {stats.rank}
                      </span>

                      <span className="text-[8px] font-black tracking-[0.18em] text-white/70 mt-1 uppercase">
                        Rank
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>

        <div className="px-4 pb-10 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Best Performance section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 px-4 pt-3 pb-2">
              Best performance
            </p>

            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
              {[
                {
                  label: "Score",
                  value: stats?.bestScore || "—",
                  icon: FiAward,
                },
                {
                  label: "Time",
                  value: formatBestTime(stats?.bestTime),
                  icon: FiClock,
                },
                {
                  label: "Questions",
                  value: stats?.bestTotalQuestions ?? "—",
                  icon: FiList,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 px-4 pb-4 pt-1"
                >
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                    {label}
                  </span>
                  <span className="text-[17px] font-black text-slate-900 dark:text-white">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {stats?.bestCourseId && (
              <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <div className="size-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <FiBook
                    size={14}
                    className="text-amber-600 dark:text-amber-400"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Best Course
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {stats.bestCourseId?.replace(/([A-Za-z]+)(\d+)/, "$1 $2")}
                    {courseTitle && (
                      <span className="font-normal text-slate-400 dark:text-slate-500">
                        {" "}
                        — {courseTitle}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Study activity section */}
          {(userProfile?.current_streak != null || userProfile?.last_study_date) && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 px-4 pt-3 pb-2">
                Study activity
              </p>

              <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-700">
                {[
                  {
                    label: "Current streak",
                    value: isValidStreak(
                      userProfile?.last_study_date,
                      userProfile?.current_streak,
                    ),
                    icon: FaFire,
                  },
                  {
                    label: "Best streak",
                    value: userProfile?.best_streak || 0,
                    icon: FiAward,
                  },
                  {
                    label: "Last studied",
                    value: getRelativeStudyLabel(userProfile?.last_study_date) || "—",
                    icon: FiClock,
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 px-4 pb-4 pt-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      {label}
                    </span>
                    <span className="text-[17px] font-black text-slate-900 dark:text-white truncate">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Academic info section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 px-4 pt-3 pb-2">
              Academic info
            </p>

            {[
              {
                label: "University",
                value: userProfile?.university,
                icon: FiHome,
              },
              {
                label: collegeLabel,
                value: userProfile?.college,
                icon: FiBookOpen,
              },
              {
                label: "Department",
                value: userProfile?.department,
                icon: FiLayers,
              },
              {
                label: "Level",
                value: userProfile?.year ? `${userProfile.year}00` : null,
                icon: FiUser,
              },
            ].map(({ label, value, icon: Icon }, i, arr) => (
              <div
                key={label}
                className={`flex items-center justify-between px-4 py-3 ${
                  i < arr.length - 1
                    ? "border-b border-slate-100 dark:border-slate-700"
                    : ""
                }`}
              >
                <span className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Icon
                    size={14}
                    className="text-slate-400 dark:text-slate-500 shrink-0"
                  />
                  {label}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white max-w-[55%] truncate text-right">
                  {value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isImageOverlayOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsImageOverlayOpen(false)}
        >
          <div className="relative w-[80vmin] h-[80vmin]">
            <img
              src={
                userProfile?.avatar_url && userProfile.avatar_url !== "NULL"
                  ? userProfile.avatar_url
                  : "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png"
              }
              alt={`${userProfile?.full_name || "User"}'s profile picture`}
              className="w-full h-full object-cover rounded-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.target.src =
                  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
              }}
            />
            <button
              onClick={() => setIsImageOverlayOpen(false)}
              className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSheet;
