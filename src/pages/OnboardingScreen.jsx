import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Logo from "../images/Logo";
import useDocumentTitle from "../hooks/useDocumentTitle";
import {
  FiUser,
  FiBookOpen,
  FiNavigation,
  FiCalendar,
  FiCheckCircle,
  FiLoader,
  FiGrid,
} from "react-icons/fi";
import { supabase } from "../supabaseClient"; // Import your supabase client
import { useAuth } from "../context/AuthContext";
import { useUniversities } from "../hooks/useUniversities";
import { useColleges } from "../hooks/useColleges";

const OnboardingScreen = ({ onProfileReady }) => {
  useDocumentTitle("Welcome to QuizBolt");
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const {
    user,
    loading: authLoading,
    profileValid,
    refreshProfile,
  } = useAuth();
  const { universities } = useUniversities();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    fullName: "",
    university: "",
    college: "",
    department: "",
    year: "",
    referralCode: "",
  });

  const colleges = useColleges(formData.university);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setChecking(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", user.id)
        .single();

      if (data?.onboarding_complete === true) {
        await refreshProfile();
        navigate("/", { replace: true });
        return; // don't setChecking — page is navigating away anyway
      }

      // Not onboarded yet — prefill name and show the form
      const nameFromGoogle =
        user.user_metadata?.full_name || user.user_metadata?.name || "";

      let referralFromStorage = "";
      try {
        referralFromStorage =
          localStorage.getItem("quizbolt_referral_code") || "";
      } catch {
        referralFromStorage = "";
      }

      setFormData((prev) => ({
        ...prev,
        fullName: nameFromGoogle,
        referralCode: referralFromStorage,
      }));
      setChecking(false);
    };

    init();
  }, [navigate, refreshProfile]);

  if (checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex gap-1.5">
          <div className="h-8 w-1.5 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-blue-600" />
          <div className="h-8 w-1.5 animate-[loading_1s_ease-in-out_0.1s_infinite] rounded-full bg-blue-500" />
          <div className="h-8 w-1.5 animate-[loading_1s_ease-in-out_0.2s_infinite] rounded-full bg-blue-400" />
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors duration-500 p-6">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
          <FiLoader className="animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold">
            Checking your profile...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileValid) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.college || formData.college === "OTHER") {
      setError("Please select a valid faculty/college.");
      setLoading(false);
      return;
    }

    try {
      // 1. Ensure user exists
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("No authenticated user found. Please sign in again.");
      }

      const fullName =
        formData.fullName ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Scholar";

      // get avatar url
      let avatarUrl =
        user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

      if (avatarUrl && avatarUrl.includes("googleusercontent.com")) {
        avatarUrl = avatarUrl.replace(/s\d+-c/, "s400-c"); // higher quality
      }

      // Create user_name base slug (lowercase, alphanumeric only)
      const baseSlug = fullName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .trim() || "scholar";

      // Generate a unique username: always append random digits and verify
      // against the database in a loop until we find one that is free.
      const generateUniqueUsername = async (base) => {
        let candidate;
        let attempts = 0;
        do {
          // Append 2–4 random digits so every new account gets a unique handle
          const digits = String(Math.floor(Math.random() * 9000) + 1000); // 1000–9999
          candidate = base + digits;
          attempts++;

          // Check whether this username is already taken (case-insensitive)
          const { count } = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .ilike("user_name", candidate);

          if ((count ?? 0) === 0) break; // username is free — use it
        } while (attempts < 20); // safety cap; extremely unlikely to need more
        return candidate;
      };

      const userName = await generateUniqueUsername(baseSlug);

      // 3. Save onboarding data + create user_name from full_name
      const referralCodeRaw = formData.referralCode?.trim() || "";
      // Only accept referral codes in format QB-XXXX (QB- followed by 4 uppercase alphanumeric characters)
      const referralCodeRegex = /^QB-[A-Z0-9]{4}$/;
      const referralCode = referralCodeRegex.test(referralCodeRaw) ? referralCodeRaw : null;

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        user_name: userName, // Store slugified name with unique suffix
        university: formData.university.toUpperCase(),
        college: formData.college,
        department: formData.department,
        year: parseInt(formData.year, 10) || null,
        referred_by: referralCode,
        onboarding_complete: true,
        is_premium: false,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      // Referral code was consumed during onboarding; remove to avoid stale reuse.
      try {
        localStorage.removeItem("quizbolt_referral_code");
      } catch {
        // ignore
      }

      // 3. Let auth listener catch up (small but important)
      await supabase.auth.getSession();

      // 4. Exit onboarding permanently
      await refreshProfile();
      await onProfileReady?.();
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors duration-500 p-6">
      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <Logo className="w-36 h-36" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-1">
            Almost there!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Help us personalize your learning path.
          </p>
        </div>

        {/* Error Message Display */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-600 dark:text-red-400 text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 mt-6">
          {/* Full Name Input */}
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4 mb-1 block">
            Your Name
          </span>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FiUser className="text-xl text-slate-400 group-focus-within:text-blue-600 transition-colors duration-300" />
            </div>
            <input
              type="text"
              name="fullName"
              placeholder="Akintola Emmanuel"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm"
              required
            />
          </div>

          {/* University */}
          <div className="group">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4 mb-1 block">
              University
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiNavigation className="text-xl text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              </div>
              <select
                value={formData.university}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    university: e.target.value.toUpperCase(),
                    college: "",
                  })
                }
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all shadow-sm appearance-none"
                required
              >
                <option value="" disabled>
                  Select your university
                </option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id.toUpperCase()}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* College */}
          <div className="group">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4 mb-1 block">
              {formData.university === "LASU" ? "Faculty" : "College"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiGrid className="text-xl text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              </div>
              <select
                value={formData.college}
                onChange={(e) => {
                  const value = e.target.value;

                  if (value === "OTHER") {
                    const message = `Hello, I can't find my faculty/college.

University: ${formData.university}
Faculty/College: 
Department: 

I understand I need to provide correct details.`;

                    const encodedMessage = encodeURIComponent(message);

                    window.open(
                      `https://wa.me/2347015585397?text=${encodedMessage}`,
                      "_blank",
                    );

                    setFormData((prev) => ({ ...prev, college: "" })); // 👈 add this

                    return;
                  }

                  setFormData((prev) => ({ ...prev, college: value }));
                }}
                disabled={!formData.university || colleges.length === 0}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all shadow-sm appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                required
              >
                <option value="" disabled>
                  {!formData.university
                    ? "Select university first"
                    : colleges.length === 0
                      ? `No ${formData.university === "LASU" ? "Faculty" : "College"} available yet`
                      : `Select your ${formData.university === "LASU" ? "Faculty" : "College"}`}
                </option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="OTHER">
                  Can't find your{" "}
                  {formData.university === "LASU" ? "Faculty" : "College"}?
                </option>
              </select>
            </div>
          </div>

          {/* Department / Course */}
          <div className="group">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4 mb-1 block">
              Department
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiBookOpen className="text-xl text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="e.g. Computer Science"
                value={formData.department}
                onChange={(e) =>
                  setFormData({ ...formData, department: e.target.value })
                }
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all shadow-sm"
                required
              />
            </div>
          </div>

          {/* Year of Study */}
          <div className="group">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4 mb-1 block">
              Year of Study
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiCalendar className="text-xl text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              </div>
              <select
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all shadow-sm appearance-none"
                required
              >
                <option value="" disabled>
                  Select Level
                </option>
                <option value="1">Year 1 (Fresher)</option>
                <option value="2">Year 2 (Sophomore)</option>
                <option value="3">Year 3 (Junior)</option>
                <option value="4">Year 4 (Senior)</option>
              </select>
            </div>
          </div>

          {/* Referral code */}
          <div className="group">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-4 mb-1 block">
              Referral code (leave blank if none)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. QB-T4LD"
                name="referralCode"
                value={formData.referralCode}
                onChange={handleChange}
                className="w-full pl-4 pr-4 py-4 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full mt-4 bg-blue-600 py-4 rounded-2xl font-bold text-white text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2 ${
              loading
                ? "opacity-70 cursor-not-allowed"
                : "hover:bg-blue-700 hover:-translate-y-1 active:scale-95"
            }`}
          >
            <span>{loading ? "Saving..." : "Complete Setup"}</span>
            {!loading && <FiCheckCircle className="text-xl" />}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2 ml-2 text-center">
          Can’t find yours? Select the last option — we’ll add it fast.
        </p>
      </div>
    </div>
  );
};

export default OnboardingScreen;
