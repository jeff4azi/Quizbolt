import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiArrowLeft,
  FiAward,
  FiBookOpen,
  FiCheck,
  FiEdit2,
  FiLoader,
  FiSettings,
  FiShield,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { FaCrown, FaTelegramPlane, FaWhatsapp, FaCamera } from "react-icons/fa";
import Avatar from "../components/Avatar";
import ConfirmOverlay from "../components/ConfirmOverlay";
import whatsappChannelIcon from "../images/whatsappchannelicon.webp";
import {
  getWhatsAppCommunityUrl,
  WHATSAPP_CHANNEL_URL,
} from "../components/WhatsAppCard";
import { supabase } from "../supabaseClient";

const formatLevel = (year) => {
  const value = String(year ?? "").trim();
  if (!value) return "100";
  return value.length === 1 ? `${value}00` : value;
};

const Profile = ({ userProfile, isPremium, onUpdateProfile }) => {
  useDocumentTitle("Your Profile | QuizBolt");
  const navigate = useNavigate();
  const location = useLocation();

  // Always reset scroll to the top when visiting the profile screen
  useEffect(() => {
    const prevScrollRestoration = window.history?.scrollRestoration;
    if (window.history?.scrollRestoration) {
      window.history.scrollRestoration = "manual";
    }

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const wrappers = document.querySelectorAll(
        ".desktop-content-wrapper, main"
      );
      wrappers.forEach((el) => {
        if (el) el.scrollTop = 0;
      });
    };

    resetScroll();
    const frameId = requestAnimationFrame(resetScroll);
    const timer = setTimeout(resetScroll, 50);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
      if (window.history?.scrollRestoration && prevScrollRestoration) {
        window.history.scrollRestoration = prevScrollRestoration;
      }
    };
  }, [location.pathname, location.key]);
  const telegramGroupUrl = "";
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [premiumAccess, setPremiumAccess] = useState(null);
  const [rerunCourses, setRerunCourses] = useState([]);
  const [rerunCoursesLoading, setRerunCoursesLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: userProfile?.full_name || "",
    user_name: userProfile?.user_name || "",
    department: userProfile?.department || "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorModal, setDeleteErrorModal] = useState({
    isOpen: false,
    message: "",
  });

  useEffect(() => {
    if (!userProfile || isEditing || isSaving) return;
    setFormData({
      full_name: userProfile.full_name || "",
      user_name: userProfile.user_name || "",
      department: userProfile.department || "",
    });
  }, [userProfile, isEditing, isSaving]);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setPremiumAccess(false);
          return;
        }

        const { data, error } = await supabase
          .from("premium_access")
          .select("expires_at, reason, granted_at, active")
          .eq("user_id", user.id)
          .order("expires_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          setPremiumAccess(false);
          return;
        }

        setPremiumAccess(data ?? false);
      } catch {
        setPremiumAccess(false);
      }
    })();
  }, []);

  // Fetch rerun courses for 200 level students
  const fetchRerunCourses = useCallback(async () => {
    const level = formatLevel(userProfile?.year);
    if (level !== "200") {
      setRerunCourses([]);
      return;
    }

    try {
      setRerunCoursesLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch course codes from course_enrollments_override
      const { data: overrideData, error: overrideError } = await supabase
        .from("course_enrollments_override")
        .select("course_code")
        .eq("user_id", user.id);

      if (overrideError || !overrideData || overrideData.length === 0) {
        setRerunCourses([]);
        return;
      }

      // Fetch course details from courses_meta
      const courseCodes = overrideData.map(item => item.course_code);
      const { data: coursesData, error: coursesError } = await supabase
        .from("courses_meta")
        .select("*")
        .in("course_code", courseCodes)
        .ilike("university", userProfile?.university || "");

      if (!coursesError && coursesData) {
        // Map course_group to group
        setRerunCourses(coursesData.map(course => ({
          ...course,
          group: course.course_group
        })));
      }
    } catch (err) {
      console.error("Failed to fetch rerun courses:", err);
    } finally {
      setRerunCoursesLoading(false);
    }
  }, [userProfile]);

  useEffect(() => {
    fetchRerunCourses();
  }, [fetchRerunCourses]);

  // Delete rerun course
  const handleDeleteCourse = async () => {
    if (!courseToDelete) return;

    try {
      setIsDeleting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Delete from course_enrollments_override
      const { error } = await supabase
        .from("course_enrollments_override")
        .delete()
        .eq("user_id", user.id)
        .eq("course_code", courseToDelete.course_code);

      if (error) {
        throw new Error(error.message);
      }

      // Refresh the list
      await fetchRerunCourses();
      setShowDeleteConfirm(false);
      setCourseToDelete(null);
    } catch (err) {
      console.error("Failed to delete course:", err);
      setDeleteErrorModal({
        isOpen: true,
        message: "Failed to remove course. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const premiumStatus = useMemo(() => {
    if (premiumAccess === null) {
      return {
        tone: "loading",
        label: "Checking access",
        value: "Loading status",
      };
    }

    const now = new Date();
    const hasAccessRecord = premiumAccess !== false;
    const isAccessActive =
      hasAccessRecord &&
      premiumAccess.active &&
      new Date(premiumAccess.expires_at) > now;
    const isAccessExpired =
      hasAccessRecord &&
      (!premiumAccess.active || new Date(premiumAccess.expires_at) <= now);

    if (isAccessActive) {
      return {
        tone: "premium",
        label: "Premium Active",
        value: `Expires ${new Date(premiumAccess.expires_at).toLocaleDateString(
          undefined,
          { day: "numeric", month: "short", year: "numeric" },
        )}`,
        note: premiumAccess.reason,
      };
    }

    if (isAccessExpired) {
      return {
        tone: "expired",
        label: "Premium Expired",
        value: `Expired ${new Date(
          premiumAccess.expires_at,
        ).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`,
        note: premiumAccess.reason,
      };
    }

    if (isPremium) {
      return {
        tone: "premium",
        label: "Premium Active",
        value: "Full semester access",
      };
    }

    return {
      tone: "free",
      label: "Free Plan",
      value: "Upgrade anytime",
    };
  }, [isPremium, premiumAccess]);

  const handleSave = async () => {
    if (!onUpdateProfile) {
      setIsEditing(false);
      return;
    }

    try {
      setSaveError(null);
      setIsSaving(true);
      await onUpdateProfile(formData);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err.message);
      setSaveError(err.message || "Failed to save. Please try again.");
      // Keep isEditing=true so the user can correct the field
    } finally {
      setIsSaving(false);
    }
  };

  const fieldRows = [
    {
      key: "full_name",
      label: "Full Name",
      icon: FiUser,
      editable: true,
      placeholder: "Enter your full name",
      value: formData.full_name || "Scholar",
    },
    {
      key: "user_name",
      label: "Username",
      icon: FiAward,
      editable: true,
      placeholder: "Enter your username",
      value: formData.user_name || "username",
    },
    {
      key: "department",
      label: "Department",
      icon: FiBookOpen,
      editable: true,
      placeholder: "Enter your department",
      value: formData.department || "General Studies",
    },
    {
      key: ["TASUED", "BOUESTI"].includes(userProfile?.university)
        ? "College"
        : "Faculty",
      label: ["TASUED", "BOUESTI"].includes(userProfile?.university)
        ? "College"
        : "Faculty",
      icon: FiShield,
      editable: false,
      value: userProfile?.college || "TASUED",
    },
    {
      key: "level",
      label: "Level",
      icon: FiAward,
      editable: false,
      value: `${formatLevel(userProfile?.year)} Level`,
    },
  ];

  const communityRows = [
    {
      key: "whatsapp-group",
      label: "WhatsApp Group",
      description: `${userProfile?.university || "QuizBolt"} community`,
      icon: FaWhatsapp,
      href: getWhatsAppCommunityUrl(userProfile?.university),
      tone: "green",
    },
    {
      key: "whatsapp-channel",
      label: "WhatsApp Channel",
      description: "QuizBolt updates",
      image: whatsappChannelIcon,
      href: WHATSAPP_CHANNEL_URL,
      tone: "green",
    },
    {
      key: "telegram-group",
      label: "Telegram Group",
      description: "Coming soon",
      icon: FaTelegramPlane,
      href: telegramGroupUrl,
      tone: "sky",
    },
  ];

  const toneClasses = {
    green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300",
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/")
            }
            className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-black tracking-tight">Profile</h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Identity & access
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
            aria-label="Open settings"
            title="Settings"
          >
            <FiSettings size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-28 pt-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
          <aside className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => navigate("/upload-profile-pic")}
                className="group relative rounded-[2rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Avatar
                  avatarUrl={userProfile?.avatar_url}
                  size="lg"
                  className="shadow-xl shadow-blue-100 dark:shadow-none"
                />
                {isPremium && (
                  <span className="absolute -right-2 -top-2 rounded-2xl border-4 border-white dark:border-slate-900 bg-amber-400 p-2 shadow-lg">
                    <FaCrown className="text-sm text-white" />
                  </span>
                )}
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold text-white transition-opacity border border-transparent group-hover:border-white/70">
                  <FaCamera size={12} className="inline-block mr-1" /> Change
                  photo
                </span>
              </button>

              <h2 className="mt-8 max-w-full truncate text-2xl font-black tracking-tight">
                {formData.full_name || "Scholar"}
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-400">
                @{formData.user_name || "username"}
              </p>

              <div
                className={`mt-5 w-full rounded-2xl border px-4 py-3 text-left ${
                  premiumStatus.tone === "premium"
                    ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300"
                    : premiumStatus.tone === "expired"
                      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300"
                      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="size-9 shrink-0 rounded-xl bg-white/70 dark:bg-slate-950/30 flex items-center justify-center">
                    {premiumStatus.tone === "premium" ? (
                      <FaCrown />
                    ) : (
                      <FiAward />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                      {premiumStatus.label}
                    </p>
                    <p className="truncate text-sm font-black">
                      {premiumStatus.value}
                    </p>
                    {premiumStatus.note && (
                      <p className="truncate text-[11px] opacity-70">
                        {premiumStatus.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {!isPremium && (
                <button
                  type="button"
                  onClick={() => navigate("/premium")}
                  className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition-all active:scale-[0.98] dark:shadow-none"
                >
                  Upgrade to Premium
                </button>
              )}

              {!isPremium && (
                <button
                  type="button"
                  onClick={() => navigate("/referral-dashboard")}
                  className="mt-3 w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 px-4 py-3 text-sm font-black text-slate-900 dark:text-white shadow-sm transition-all active:scale-[0.98]"
                >
                  Referral Dashboard
                </button>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                <div>
                  <h3 className="font-black">Profile details</h3>
                  <p className="text-xs font-semibold text-slate-400">
                    Keep your public exam identity accurate.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={
                    isEditing
                      ? handleSave
                      : () => {
                          setSaveError(null);
                          setIsEditing(true);
                        }
                  }
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white transition-all active:scale-95 ${
                    isSaving
                      ? "bg-green-600/80"
                      : isEditing
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isSaving ? (
                    <FiLoader className="animate-spin" />
                  ) : isEditing ? (
                    <FiCheck />
                  ) : (
                    <FiEdit2 />
                  )}
                  {isSaving ? "Saving" : isEditing ? "Save" : "Edit"}
                </button>
              </div>

              {/* Inline save error banner */}
              {saveError && (
                <div className="mx-5 mt-3 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="mt-0.5 size-4 shrink-0"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-4.75a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-1.5 0v4.5Zm.75-7.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>{saveError}</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {fieldRows.map(
                  ({
                    key,
                    label,
                    icon: Icon,
                    editable,
                    value,
                    placeholder,
                  }) => (
                    <div
                      key={key}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[180px_1fr] sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                        <span className="size-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300">
                          <Icon />
                        </span>
                        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                          {label}
                        </span>
                      </div>

                      {isEditing && editable ? (
                        <input
                          type="text"
                          value={formData[key]}
                          onChange={(e) => {
                            setSaveError(null);
                            setFormData({ ...formData, [key]: e.target.value });
                          }}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          placeholder={placeholder}
                        />
                      ) : (
                        <p className="min-w-0 truncate text-base font-bold text-slate-800 dark:text-slate-100">
                          {value}
                        </p>
                      )}
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                <h3 className="font-black">Communities</h3>
                <p className="text-xs font-semibold text-slate-400">
                  Join QuizBolt student spaces.
                </p>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-3">
                {communityRows.map(
                  ({
                    key,
                    label,
                    description,
                    icon: Icon,
                    image,
                    href,
                    tone,
                  }) => {
                    const content = (
                      <>
                        <span
                          className={`size-10 rounded-2xl flex items-center justify-center ${toneClasses[tone]}`}
                        >
                          {image ? (
                            <img
                              src={image}
                              alt=""
                              className="size-4.5 object-contain"
                            />
                          ) : (
                            <Icon size={19} />
                          )}
                        </span>
                        <span className="min-w-0 text-left">
                          <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
                            {label}
                          </span>
                          <span className="block truncate text-xs font-semibold text-slate-400">
                            {description}
                          </span>
                        </span>
                      </>
                    );

                    if (!href) {
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled
                          className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 opacity-70 dark:border-slate-800 dark:bg-slate-800/50"
                        >
                          {content}
                        </button>
                      );
                    }

                    return (
                      <a
                        key={key}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-blue-200 hover:bg-white active:scale-[0.98] dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                      >
                        {content}
                      </a>
                    );
                  },
                )}
              </div>
            </section>

            {/* Rerun Courses Section - Only for 200 level students */}
            {formatLevel(userProfile?.year) === "200" && (
              <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                  <h3 className="font-black">Rerun Courses</h3>
                  <p className="text-xs font-semibold text-slate-400">
                    Courses you need to retake.
                  </p>
                </div>

                <div className="p-5">
                  {rerunCoursesLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : rerunCourses.length > 0 ? (
                    <div className="space-y-3">
                      {rerunCourses.map((course) => (
                        <div
                          key={course.course_code}
                          className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-black text-slate-900 dark:text-white truncate">
                              {course.name}
                            </p>
                            <p className="text-xs font-semibold text-slate-400 truncate">
                              {course.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
                              {course.course_code}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCourseToDelete(course);
                                setShowDeleteConfirm(true);
                              }}
                              className="size-9 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-[0.95]"
                              aria-label={`Remove ${course.name}`}
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm font-semibold text-slate-400 mb-4">
                        You don't have any rerun courses yet.
                      </p>
                      <a
                        href={`https://wa.me/2347015585397?text=Hello%2C%20I%20would%20like%20to%20request%20a%20rerun%20course%20on%20QuizBolt.%0A%0AUser%20Name%3A%20${encodeURIComponent(userProfile?.user_name || "")}%0AUniversity%3A%20${encodeURIComponent(userProfile?.university || "")}%0ACourse%20Request%3A%20_____%0A%0AThank%20you.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#25D366] text-white font-black text-sm shadow-lg shadow-green-200 dark:shadow-none active:scale-[0.98] transition-all"
                      >
                        <FaWhatsapp size={18} />
                        Request Rerun Course
                      </a>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </section>
      </main>

      <ConfirmOverlay
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setCourseToDelete(null);
        }}
        onConfirm={handleDeleteCourse}
        title="Remove Rerun Course?"
        message={`Are you sure you want to remove ${courseToDelete?.name} from your rerun courses?`}
        confirmText={isDeleting ? "Removing..." : "Yes, remove it"}
        cancelText="Cancel"
        danger={true}
      />

      <ConfirmOverlay
        isOpen={deleteErrorModal.isOpen}
        onClose={() => setDeleteErrorModal({ isOpen: false, message: "" })}
        onConfirm={() => setDeleteErrorModal({ isOpen: false, message: "" })}
        title="Failed to Remove"
        message={deleteErrorModal.message}
        confirmText="Got it"
        cancelText=""
        danger={true}
      />
    </div>
  );
};

export default Profile;

import useDocumentTitle from "../hooks/useDocumentTitle";