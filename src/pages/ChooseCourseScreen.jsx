import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  trackCourseSelected,
  /* trackCourseSearch, */
  trackQuestionTypeSwitch,
  trackFavouriteToggle,
  trackExamStart,
  trackPremiumGateHit,
} from "../utils/analytics";
import { FiBookOpen, FiLayers, FiX, FiSearch } from "react-icons/fi";
import { FaCrown, FaWhatsapp } from "react-icons/fa";
import { IoHeart, IoHeartOutline } from "react-icons/io5";
import ConfirmOverlay from "../components/ConfirmOverlay";
import NavBar from "../components/NavBar";
import {
  loadFavouriteCourseIds,
  toggleFavouriteCourseId,
  encodeFavouriteKey,
} from "../utils/favouriteCourses";
import { clearExamSession } from "../utils/examSessionStorage";
import SectionLoader from "../components/SectionLoader";

// Read favourite IDs from the same cache Home screen writes to — instant on mount
const HOME_DASHBOARD_CACHE_PREFIX = "quizboltHomeDashboard:";
const readCachedFavouriteIds = (userId) => {
  try {
    if (!userId) return null;
    const raw = localStorage.getItem(`${HOME_DASHBOARD_CACHE_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.favouriteIds) ? parsed.favouriteIds : null;
  } catch {
    return null;
  }
};

const ChooseCourseScreen = ({
  selectedQuestionCount,
  setSelectedQuestionCount,
  courses,
  selectedCourse,
  setSelectedCourse,
  setAnswers,
  userProfile,
  loadingProfile,
  isPremium,
  coursesLoading,
  questionType,
  setQuestionType,
}) => {
  useDocumentTitle("Choose a Course | QuizBolt");
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [theoryOverlayOpen, setTheoryOverlayOpen] = useState(false);
  const [requestCourseOverlay, setRequestCourseOverlay] = useState(false);
  // Initialise immediately from the Home screen's localStorage cache so hearts
  // render red on first paint — no waiting for the async Supabase fetch.
  const [favouriteIds, setFavouriteIds] = useState(
    () => readCachedFavouriteIds(userProfile?.id) ?? [],
  );
  const [pendingFavourites, setPendingFavourites] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Sync favourites: if cache was available the UI is already correct; after
  // the fresh fetch resolves we silently update in the background.
  useEffect(() => {
    // If we already have ids from cache, skip the loading flash entirely;
    // still fetch in the background so we're always in sync.
    loadFavouriteCourseIds().then((fresh) => {
      setFavouriteIds(fresh);
    });
  }, []);

  // If userProfile arrives after first render (e.g. slow auth), seed from
  // cache now so hearts are correct before the async fetch finishes.
  useEffect(() => {
    if (!userProfile?.id) return;
    const cached = readCachedFavouriteIds(userProfile.id);
    if (cached) setFavouriteIds(cached);
  }, [userProfile?.id]);

  const userCollege = userProfile?.college;

  useEffect(() => {
    // On desktop (lg+) the scroll container is .desktop-content-wrapper.
    // On mobile it's window. Use the breakpoint to decide — the element exists
    // in the DOM on both, so checking existence alone isn't enough.
    const getContainer = () =>
      window.innerWidth >= 1024
        ? document.querySelector(".desktop-content-wrapper") || window
        : window;
    const getScroll = () => {
      const el = getContainer();
      return el === window ? window.scrollY : el.scrollTop;
    };
    const handler = () => setIsScrolled(getScroll() > 20);

    // Attach to both in case of resize; duplicate events are harmless.
    const wrapper = document.querySelector(".desktop-content-wrapper");
    if (wrapper) wrapper.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      if (wrapper) wrapper.removeEventListener("scroll", handler);
      window.removeEventListener("scroll", handler);
    };
  }, []);

  /* ----------------------------- FILTER COURSES ----------------------------- */
  const filteredCourses = useMemo(() => {
    if (!Array.isArray(courses)) return [];
    return courses.filter((course) => {
      if (!course) return false;
      if (!Array.isArray(course.colleges)) return false;
      const collegeMatch =
        course.colleges.includes("ALL") ||
        (userCollege && course.colleges.includes(userCollege));
      if (!collegeMatch) return false;
      if (questionType === "theory")
        return (course.theoryQuestionCount || 0) > 0;
      if (questionType === "fib") return (course.fibQuestionCount || 0) > 0;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          course.name?.toLowerCase().includes(q) ||
          course.title?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [courses, userCollege, questionType, searchQuery]);

  // If Home deep-links to a course, preselect it
  useEffect(() => {
    try {
      const params = new URLSearchParams(location?.search || "");
      const courseId = params.get("course");
      if (!courseId) return;
      const match = filteredCourses.find((c) => c?.id === courseId);
      if (match) {
        setSelectedCourse(match);
        setSelectedQuestionCount(null);
      }
    } catch {
      // ignore
    }
  }, [
    filteredCourses,
    location?.search,
    setSelectedCourse,
    setSelectedQuestionCount,
  ]);

  // If a share/challenge link deep-links to an exam type, preselect it too.
  // Objective ("obj") is the implicit default when no type is provided.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location?.search || "");
      const rawType = (params.get("type") || "").toLowerCase();
      if (!rawType) return; // keep the app default (objective)
      const nextType =
        rawType === "theory" || rawType === "thy"
          ? "theory"
          : rawType === "fib"
            ? "fib"
            : "objective";
      // setQuestionType also guards non-premium users out of theory.
      setQuestionType(nextType);
    } catch {
      // ignore
    }
  }, [location?.search, setQuestionType]);

  /* ----------------------------- GROUP COURSES ------------------------------ */
  const groupedCourses = useMemo(() => {
    return filteredCourses.reduce((acc, course) => {
      if (!course) return acc;
      if (!acc[course.group]) acc[course.group] = [];
      acc[course.group].push(course);
      return acc;
    }, {});
  }, [filteredCourses]);

  const groupTitles = {
    general: "General Courses",
    departmental: "Departmental Courses",
    vocational: "Vocational Courses",
  };

  const groupOrder = ["general", "departmental", "vocational"];

  /* ----------------------------- HELPERS ------------------------------------ */
  const getAvailableQuestionOptions = (course) => {
    if (questionType === "theory") {
      const theoryOptions = [3, 5, 7, 10];
      const count = course?.theoryQuestionCount || 0;
      const filtered = theoryOptions.filter((opt) => count >= opt);
      return count > 0 ? [...filtered, "All"] : filtered;
    }
    if (questionType === "fib") {
      const fibOptions = [10, 15, 20, 30];
      const count = course?.fibQuestionCount || 0;
      const filtered = fibOptions.filter((opt) => count >= opt);
      return count > 0 ? [...filtered, "All"] : filtered;
    }
    const options = [30, 50, 70, 100];
    const count = course?.questionCount || 0;
    const filtered = options.filter((opt) => count >= opt);
    return count > 0 ? [...filtered, "All"] : filtered;
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setSelectedQuestionCount(null);
    trackCourseSelected(course.id, course.name, questionType);
  };

  const handleStartExam = () => {
    if (!selectedCourse || !selectedQuestionCount) return;
    clearExamSession();
    setAnswers([]);
    trackExamStart(selectedCourse.id, selectedQuestionCount, questionType);
    navigate("/exam");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-500 pb-32">
      {/* HEADER */}
      <header
        className={`sticky top-0 z-50 px-6 transition-all duration-300 ${
          isScrolled
            ? "bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm border-b border-gray-100 dark:border-slate-800 py-3"
            : "bg-transparent py-4"
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Select Course
            </h1>
            {userCollege && (
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                {userCollege} Faculty
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRequestCourseOverlay(true)}
            className="ml-auto px-4 py-2 text-xs font-black rounded-xl bg-green-500 text-white shadow-md active:scale-95 flex items-center gap-1 transition-all"
          >
            <FaWhatsapp className="inline-block size-4 mr-1" />
            Request Course
          </button>
        </div>
        <div className="max-w-2xl mx-auto lg:flex lg:justify-center">
          {/* TABS */}
          <div className="max-w-2xl mx-auto mt-3">
            <div className="inline-flex bg-gray-100 dark:bg-slate-800 rounded-2xl p-1 gap-1">
              {[
                { key: "objective", label: "Objective" },
                { key: "fib", label: "Fill in Blank" },
                { key: "theory", label: "Theory" },
              ].map(({ key, label }) => {
                const isLocked = key === "theory" && !isPremium;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setTheoryOverlayOpen(true);
                        trackPremiumGateHit("theory_mode");
                        return;
                      }
                      setQuestionType(key);
                      trackQuestionTypeSwitch(key);
                      setSelectedCourse(null);
                      setSelectedQuestionCount(null);
                    }}
                    className={`relative px-5 py-2 rounded-xl text-xs font-black transition-all ${
                      questionType === key
                        ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                  >
                    {label}
                    {isLocked && (
                      <div className="absolute -top-2 -right-2 bg-amber-400 dark:bg-yellow-500 rounded-full p-1 border-2 border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center">
                        <FaCrown className="text-[7px] text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {/* SEARCH */}
        <div className="max-w-2xl mx-auto mt-3 relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 size-4 pointer-events-none" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors shadow-sm"
          />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="px-6 lg:px-10 mt-4 space-y-10 flex-1 flex flex-col overflow-y-auto desktop-content-col">
        {loadingProfile || coursesLoading ? (
          <SectionLoader text="Fetching courses..." />
        ) : filteredCourses.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in-95 duration-700">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full" />
              <div className="relative size-24 bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl flex items-center justify-center border border-gray-100 dark:border-slate-700">
                <FiLayers className="size-10 text-blue-500" />
                <FiX className="absolute -top-1 -right-1 size-6 text-red-500 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Nothing here yet
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed font-medium">
              We don't have courses for your faculty at the moment. We're
              actively adding more courses stay tuned.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-8 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-lg"
            >
              Go Back Home
            </button>
          </div>
        ) : (
          /* COURSE LIST */
          groupOrder.map((group) =>
            groupedCourses[group]?.length > 0 ? (
              <section
                key={group}
                className="animate-in fade-in slide-in-from-bottom-4 duration-700"
              >
                <div className="flex items-center gap-3 mb-3 px-1">
                  <FiLayers className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500">
                    {groupTitles[group]}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-4">
                  {groupedCourses[group].map((course) => {
                    const isSelected = selectedCourse?.id === course.id;
                    const favKey = encodeFavouriteKey(course.id, questionType);
                    const isFavourite = favouriteIds.includes(favKey);
                    const isPending = pendingFavourites.has(favKey);
                    return (
                      <div
                        key={course.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectCourse(course)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectCourse(course);
                          }
                        }}
                        className={`group w-full flex flex-col justify-between min-h-[100px] sm:min-h-[120px] md:min-h-[130px] p-3.5 sm:p-5 rounded-2xl sm:rounded-[2rem] border-2 transition-all active:scale-[0.98] cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 shadow-xl shadow-blue-200"
                            : "bg-white dark:bg-slate-800 border-white dark:border-slate-800 hover:border-blue-100 shadow-sm"
                        }`}
                      >
                        {/* TOP ROW: title + heart, always aligned at the top */}
                        <div className="flex justify-between items-start">
                          <div className="max-w-[80%]">
                            <h2
                              className={`text-base sm:text-xl font-black leading-tight ${isSelected ? "text-white" : "text-slate-900 dark:text-white"}`}
                            >
                              {course.name}
                            </h2>
                            <p
                              className={`text-xs sm:text-sm mt-0.5 leading-snug ${isSelected ? "text-blue-100" : "text-slate-500 dark:text-slate-400"}`}
                            >
                              {course.title}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              const wasF = isFavourite;
                              setFavouriteIds((prev) =>
                                wasF
                                  ? prev.filter((id) => id !== favKey)
                                  : [...prev, favKey],
                              );
                              setPendingFavourites((prev) => {
                                const next = new Set(prev);
                                next.add(favKey);
                                return next;
                              });
                              toggleFavouriteCourseId(
                                course.id,
                                wasF
                                  ? favouriteIds
                                  : favouriteIds.filter((id) => id !== favKey),
                                questionType,
                              )
                                .then((updated) => {
                                  setFavouriteIds(updated);
                                  trackFavouriteToggle(course.id, !wasF);
                                })
                                .finally(() => {
                                  setPendingFavourites((prev) => {
                                    const next = new Set(prev);
                                    next.delete(favKey);
                                    return next;
                                  });
                                });
                            }}
                            className={`size-8 sm:size-10 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all active:scale-90 ${
                              isPending ? "opacity-50 cursor-not-allowed" : ""
                            } ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-gray-50 dark:bg-slate-700 text-slate-400 dark:text-slate-300"
                            }`}
                            title={
                              isFavourite
                                ? "Remove from favourites"
                                : "Add to favourites"
                            }
                            aria-pressed={isFavourite}
                            aria-busy={isPending}
                          >
                            {isPending ? (
                              <svg
                                className={`size-4 animate-spin ${isSelected ? "text-white" : "text-rose-400"}`}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                            ) : isFavourite ? (
                              <IoHeart
                                className={
                                  isSelected ? "text-white" : "text-rose-500"
                                }
                                size={18}
                              />
                            ) : (
                              <IoHeartOutline size={18} />
                            )}
                          </button>
                        </div>

                        {/* BOTTOM BLOCK: badge */}
                        <div className="mt-2 sm:mt-3">
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] font-bold ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-blue-50 dark:bg-blue-900/30 text-blue-600"
                            }`}
                          >
                            <FiBookOpen />
                            {(questionType === "theory"
                              ? course.theoryQuestionCount
                              : questionType === "fib"
                                ? course.fibQuestionCount
                                : course.questionCount) || 0}{" "}
                            Questions
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null,
          )
        )}
      </main>

      {/* QUESTION COUNT MODAL */}
      {selectedCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => setSelectedCourse(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xs sm:max-w-sm p-5 sm:p-8 animate-in zoom-in-95">
            <button
              onClick={() => setSelectedCourse(null)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full text-gray-400 hover:bg-gray-100"
            >
              <FiX />
            </button>

            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {selectedCourse.name}
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium italic">
                {selectedCourse.title}
              </p>

              {/* Divider so the count grid reads as the primary action */}
              <div className="mt-4 sm:mt-6 mb-4 sm:mb-5 h-px bg-gray-100 dark:bg-slate-700" />

              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-2 sm:mb-3">
                Number of Questions
              </p>

              {/* QUESTION COUNT — primary, larger, hero treatment */}
              {getAvailableQuestionOptions(selectedCourse).length === 0 ? (
                <div className="py-4 sm:py-6 text-center">
                  <p className="text-xs sm:text-sm font-semibold text-slate-400 dark:text-slate-500">
                    No questions available
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {getAvailableQuestionOptions(selectedCourse).map((num) => {
                    const isLocked =
                      !isPremium &&
                      (questionType === "fib"
                        ? num !== 10
                        : questionType === "theory"
                          ? num !== 3
                          : num !== 30);
                    const isSelected = selectedQuestionCount === num;

                    return (
                      <button
                        key={num}
                        onClick={() => {
                          if (isLocked) {
                            setPremiumOverlayOpen(true);
                            return;
                          }
                          setSelectedQuestionCount(num);
                        }}
                        className={`relative py-4 sm:py-5 rounded-2xl transition-all duration-200 active:scale-[0.97] ${
                          isSelected
                            ? "bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-300/40 dark:shadow-blue-900/30 scale-[1.02]"
                            : "bg-gray-50 dark:bg-slate-700/60 hover:bg-gray-100 dark:hover:bg-slate-700"
                        } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        <span
                          className={`block text-xl sm:text-2xl font-black leading-none ${
                            isSelected
                              ? "text-white"
                              : "text-slate-800 dark:text-slate-100"
                          }`}
                        >
                          {num === "All" ? "All" : num}
                        </span>
                        <span
                          className={`block text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-0.5 sm:mt-1 ${
                            isSelected
                              ? "text-blue-100"
                              : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          Questions
                        </span>

                        {isLocked && (
                          <div className="absolute -top-2 -right-2 bg-amber-400 dark:bg-yellow-500 rounded-full p-1 border-2 border-gray-50 dark:border-slate-900 shadow-sm flex items-center justify-center">
                            <FaCrown className="text-[7px] sm:text-[8px] text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p
                className={`${!selectedQuestionCount ? "hidden" : ""} mt-3 text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed px-1`}
              >
                Practice questions based on course materials. Not guaranteed to
                appear in your examination.
              </p>

              <button
                onClick={handleStartExam}
                disabled={!selectedQuestionCount}
                className="w-full mt-4 sm:mt-6 py-3 sm:py-4 rounded-2xl font-bold sm:font-black text-sm sm:text-base bg-blue-600 text-white disabled:bg-gray-300 shadow-xl shadow-blue-100 dark:shadow-none transition-all active:scale-[0.98]"
              >
                Start Exam
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmOverlay
        isOpen={isPremiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Unlock Full Exam Access"
        message="Upgrade to Premium to unlock longer exams and full-question modes for all your courses."
        confirmText="Get Premium"
        cancelText="Maybe later"
      />

      <ConfirmOverlay
        isOpen={theoryOverlayOpen}
        onClose={() => setTheoryOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Theory Mode is Premium"
        message="Upgrade to Premium to access theory questions and test your written knowledge across all courses."
        confirmText="Get Premium"
        cancelText="Maybe later"
      />

      <ConfirmOverlay
        isOpen={requestCourseOverlay}
        onClose={() => setRequestCourseOverlay(false)}
        onConfirm={() => {
          window.open(
            "https://wa.me/2348134497640?text=Hello%20I%20want%20to%20request%20a%20course.%0A%0ASchool:%20%0ACourse%20Name:%20%0ADo%20you%20have%20materials%3F%20(Yes%2FNo)%0A%0AI%20understand%20I%20need%20to%20send%20PDFs%20or%20notes.",
            "_blank",
          );
          setRequestCourseOverlay(false);
        }}
        title="Request a New Course"
        message={
          <span>
            You&apos;ll be redirected to WhatsApp to submit your course request.
            If you contribute useful PDFs, notes, or past questions for the
            course, you&apos;ll receive{" "}
            <span className="font-black text-amber-400 text-base">
              FREE 7-Day Premium Access
            </span>{" "}
            after verification.
          </span>
        }
        confirmText={
          <span className="flex items-center justify-center gap-2">
            <FaWhatsapp size={18} />
            Continue to WhatsApp
          </span>
        }
        confirmButtonClassName="w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 bg-[#25D366] hover:bg-[#1ebe5d] shadow-green-200 dark:shadow-none"
        icon={<FaWhatsapp size={32} className="text-[#25D366]" />}
        cancelText="Cancel"
      />

      <NavBar
        isPremium={isPremium}
        onLockedClick={() => setPremiumOverlayOpen(true)}
      />
    </div>
  );
};

export default ChooseCourseScreen;

import useDocumentTitle from "../hooks/useDocumentTitle";