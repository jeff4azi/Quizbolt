import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiShield,
  FiCheckCircle,
  FiCopy,
  FiCheck,
} from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import Logo from "../images/Logo";
import { supabase } from "../supabaseClient";
import { withTimeout } from "../utils/withTimeout";
import { API_BASE_URL } from "../apiConfig";

const PremiumPage = ({ userProfile, onActivatePremium, isPremium }) => {
  useDocumentTitle("Go Premium | QuizBolt");
  const navigate = useNavigate();
  const [premiumCode, setPremiumCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [copied, setCopied] = useState(false);

  const isTASUEDStudent =
    userProfile?.university?.trim()?.toUpperCase() === "TASUED";

  // Dynamic Plans Selection based on university
  // codeTier tells the backend / admin code generator which table a purchased
  // plan's codes should live in (3 separate tables per architectural rule).
  const plans = isTASUEDStudent
    ? [
        {
          id: "3-days",
          title: "3-Day Access",
          price: 500,
          description: "Budget 3-day full premium pass.",
          duration: "3 days",
          popular: false,
          codeTier: "budget_3d",
        },
        {
          id: "14-days",
          title: "14-Day Access",
          price: 1000,
          description: "Full premium access for 14 days.",
          duration: "14 days",
          popular: false,
          codeTier: "temp",
        },
        {
          id: "full-semester",
          title: "Full Semester Access",
          price: 2000,
          description: "Unlimited premium access for the full semester.",
          duration: "Full semester",
          popular: true,
          codeTier: "full",
        },
      ]
    : [
        {
          id: "3-days",
          title: "3-Day Access",
          price: 200,
          description: "Budget 3-day full premium pass.",
          duration: "3 days",
          popular: false,
          codeTier: "budget_3d",
        },
        {
          id: "14-days",
          title: "14-Day Access",
          price: 300,
          description: "Full premium access for 14 days.",
          duration: "14 days",
          popular: false,
          codeTier: "temp",
        },
        {
          id: "full-semester",
          title: "Full Semester Access",
          price: 500,
          description: "Unlimited premium access for the full semester.",
          duration: "Full semester",
          popular: true,
          codeTier: "full",
        },
      ];

  const [selectedPlan, setSelectedPlan] = useState(
    plans.find((p) => p.popular) || plans[plans.length - 1],
  );
  const price = selectedPlan.price;

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!premiumCode) return;

    setLoading(true);
    setStatus({ type: "", message: "" });

    try {
      let {
        data: { session },
        error: sessionError,
      } = await withTimeout(
        supabase.auth.getSession(),
        15000,
        "Session check took too long. Please try again.",
      );

      if (sessionError) throw sessionError;

      if (!session) {
        console.warn("Session missing. Attempting refresh...");
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
        session = refreshData.session;
      }

      const user = session?.user;
      if (!user) throw new Error("Please log in again.");
      const token = session.access_token;

      const response = await fetch(`${API_BASE_URL}/api/premium/redeem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: premiumCode.trim(),
        }),
      });

      const result = await response.json();
      const message =
        result.message ||
        result.error ||
        "Something went wrong. Please try again.";

      if (result.success) {
        setStatus({ type: "success", message });
        onActivatePremium?.();
      } else {
        setStatus({ type: "error", message });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message || "Unexpected error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGetCode = () => {
    const phoneNumber = "2347015585397";
    const message = encodeURIComponent(
      `Hello, I just paid ₦${price} for QuizBolt Premium.\n\nUser Name: ${userProfile?.user_name || "Scholar"}\nUniversity: ${userProfile?.university || "Non-TASUED"}\nPlan: ${selectedPlan.title}\n\nHere is my receipt:`,
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- PREMIUM ACTIVE UI ---
  if (isPremium) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-500 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-[2.5rem] p-10 border border-gray-100 dark:border-slate-700 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 size-32 bg-amber-400/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="size-20 bg-amber-400 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-none mb-6 rotate-3">
              <FaCrown className="text-white text-4xl" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              Premium Active
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
              You've unlocked full access to all features and removed all ads.
            </p>
            <button
              onClick={() => navigate("/")}
              className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 py-4 rounded-2xl font-black text-white transition-all hover:opacity-90 active:scale-95"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- REDEMPTION & UPGRADE UI ---
  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 transition-colors duration-500 flex flex-col">
      {/* Top Navbar */}
      <header className="h-[150px] lg:h-[200px] w-full max-w-7xl mx-auto px-6 flex items-center justify-between relative z-50">
        <button
          onClick={() =>
            window.history.length > 1 ? navigate(-1) : navigate("/")
          }
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 active:scale-95 transition-all shadow-sm hover:bg-gray-100 dark:hover:bg-slate-700 place-self-start mt-6"
        >
          <FiArrowLeft size={20} />
        </button>
        <Logo className="w-[100px] md:w-[120px]" />
        <div className="w-11" /> {/* Spacer to center logo on mobile */}
      </header>

      {/* Main Container Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Payment Details & Code Activation */}
        <section className="lg:col-span-7 space-y-6 w-full max-w-2xl mx-auto lg:max-w-none lg:sticky lg:top-24">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              Go Premium — Unlock Full Access
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm md:text-base">
              Get access to premium features tailored for{" "}
              {isTASUEDStudent ? "TASUED" : "your university"} courses and
              performance tools.
            </p>
          </div>

          {/* Interactive Plan Picker */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
              Select Your Plan
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`relative rounded-2xl border p-5 text-left transition-all group flex flex-col justify-between h-36 ${
                    selectedPlan.id === plan.id
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-blue-600/20"
                      : "border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-800/50 hover:border-gray-300 dark:hover:border-slate-700"
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-blue-600 text-white text-[9px] uppercase font-black px-2.5 py-0.5 tracking-wide shadow-md">
                      Popular
                    </span>
                  )}
                  <div>
                    <p className="text-slate-900 dark:text-white font-black text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {plan.title}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 line-clamp-2">
                      {plan.description}
                    </p>
                  </div>
                  <div className="flex justify-between items-baseline mt-2 w-full">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                      ₦{plan.price.toLocaleString()}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      {plan.duration}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bank Transfer Card Detail */}
          <div className="bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-700/60 pb-4 mb-4">
              <div>
                <p className="text-sm font-black text-slate-800 dark:text-white">
                  Direct Bank Transfer Payment
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                  Pay exactly{" "}
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ₦{price.toLocaleString()}
                  </span>{" "}
                  for the selected plan.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Instant Confirmation
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
              <div className="bg-gray-50 dark:bg-slate-900/40 p-3 rounded-xl border border-gray-100/50 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  Bank Name
                </p>
                <p className="font-bold text-slate-800 dark:text-white mt-0.5">
                  Palmpay
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900/40 p-3 rounded-xl border border-gray-100/50 dark:border-slate-800 relative group">
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  Account Number
                </p>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="font-bold text-slate-800 dark:text-white tracking-wide">
                    8911504030
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy("8911504030")}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="Copy Account Number"
                  >
                    {copied ? (
                      <FiCheck className="text-green-500" />
                    ) : (
                      <FiCopy size={14} />
                    )}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-900/40 p-3 rounded-xl border border-gray-100/50 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  Account Name
                </p>
                <p className="font-bold text-slate-800 dark:text-white mt-0.5 truncate">
                  Jeffrey Austin
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGetCode}
              className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-6 rounded-xl text-center text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              I’ve Made Payment — Send Receipt on WhatsApp
            </button>
          </div>

          {/* Activation Code Form Input */}
          <form onSubmit={handleActivate} className="space-y-3">
            <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
              Have your activation code?
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiShield className="text-lg text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="ENTER PREMIUM CODE"
                  value={premiumCode}
                  onChange={(e) => setPremiumCode(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-800 dark:text-white font-black placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all tracking-widest uppercase text-sm"
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className={`sm:w-48 bg-blue-600 dark:bg-blue-700 py-4 px-6 rounded-xl font-black text-white text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                  loading
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95"
                }`}
              >
                {loading ? "Verifying..." : "Activate Code"}
              </button>
            </div>
            {status.message && (
              <p
                className={`text-sm font-bold mt-2 ${status.type === "error" ? "text-red-500" : "text-green-500"} animate-in fade-in duration-300`}
              >
                {status.message}
              </p>
            )}
          </form>
        </section>

        {/* RIGHT COLUMN: Feature List Benefit Panel */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800/80 rounded-[2rem] p-6 lg:p-8 shadow-sm w-full max-w-2xl mx-auto lg:max-w-none">
          <div className="border-b border-gray-100 dark:border-slate-800 pb-5 mb-6">
            <p className="text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest mb-1">
              Premium Benefits
            </p>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              What You Unlocks
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
              Engineered seamlessly for top-performing students preparing for
              examinations.
            </p>
          </div>

          <div className="space-y-4">
            {[
              "Unlimited Questions in Every Exam",
              "Full Flashcard Decks + Shuffle Integration",
              "Advanced Theory Exam Mode",
              "100% Ad-Free Experience",
              "Bookmark Challenging Questions",
              "Unlimited Instant Exam Retakes",
              "Review Answers & Deep-Dive Mistakes",
              "Expanded Question Selection (30, 50, 100+)",
              "Smart Auto-Advance Flow Manager",
            ].map((benefit, index) => (
              <div key={index} className="flex items-start gap-3.5 group">
                <div className="size-6 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  <FiCheckCircle size={14} className="stroke-[3]" />
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-sm font-semibold leading-relaxed">
                  {benefit}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PremiumPage;

import useDocumentTitle from "../hooks/useDocumentTitle";