import { useState, useRef } from "react";
import {
  FiTrendingUp,
  FiEye,
  FiMousePointer,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiArrowRight,
  FiCalendar,
  FiHash,
} from "react-icons/fi";
import { API_BASE_URL } from "../apiConfig";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatus(ad) {
  const now = new Date();
  if (!ad.active) return { label: "Inactive", type: "inactive" };
  if (ad.starts_at && new Date(ad.starts_at) > now)
    return { label: "Scheduled", type: "scheduled" };
  if (ad.ends_at && new Date(ad.ends_at) <= now)
    return { label: "Expired", type: "expired" };
  return { label: "Live", type: "live" };
}

const STATUS_CONFIG = {
  live: {
    dot: "bg-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/20",
  },
  scheduled: {
    dot: "bg-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/20",
  },
  expired: {
    dot: "bg-red-400",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-200 dark:border-red-500/20",
  },
  inactive: {
    dot: "bg-slate-400",
    text: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-200 dark:border-slate-700",
  },
};

function StatusPill({ ad }) {
  const status = getStatus(ad);
  const cfg = STATUS_CONFIG[status.type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span
        className={`size-1.5 rounded-full ${cfg.dot} ${status.type === "live" ? "animate-pulse" : ""}`}
      />
      {status.label}
    </span>
  );
}

// ─── Lookup form ──────────────────────────────────────────────────────────────
function LookupForm({ onResult }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const id = value.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/ads/stats/${encodeURIComponent(id)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No ad found with that ID.");
      onResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-3">
      <div className="relative">
        <FiHash
          size={15}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          id="tracking-id"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your tracking ID"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-500 text-slate-900 dark:text-white text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-0 transition"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
          <FiXCircle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black rounded-2xl transition-all duration-150"
      >
        {loading ? (
          <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            View my stats <FiArrowRight size={14} />
          </>
        )}
      </button>
    </form>
  );
}

// ─── Stats dashboard ──────────────────────────────────────────────────────────
function StatsDashboard({ ad, onReset }) {
  const status = getStatus(ad);
  const cfg = STATUS_CONFIG[status.type];

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Campaign header card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* Creative thumbnail */}
        {ad.media_url && (
          <div className="relative w-full h-44 bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <img
              src={ad.media_url}
              alt="Ad creative"
              className="w-full h-full object-cover"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4">
              <StatusPill ad={ad} />
            </div>
          </div>
        )}

        <div className="p-5">
          {!ad.media_url && (
            <div className="mb-3">
              <StatusPill ad={ad} />
            </div>
          )}
          <h2 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
            {ad.title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {ad.advertiser_name}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Impressions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col items-center text-center shadow-sm">
          <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-2">
            <FiEye size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
            {fmt(ad.impressions)}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Views
          </p>
        </div>

        {/* Clicks */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col items-center text-center shadow-sm">
          <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-2">
            <FiMousePointer
              size={16}
              className="text-emerald-600 dark:text-emerald-400"
            />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
            {fmt(ad.clicks)}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            Clicks
          </p>
        </div>

        {/* CTR */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 flex flex-col items-center text-center shadow-sm">
          <div className="size-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mb-2">
            <FiTrendingUp
              size={16}
              className="text-amber-600 dark:text-amber-400"
            />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
            {ad.ctr}%
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
            CTR
          </p>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
          Campaign Details
        </h3>

        {[
          {
            icon: <FiCalendar size={13} />,
            label: "Start date",
            value: fmtDate(ad.starts_at) || "Immediate",
          },
          {
            icon: <FiCalendar size={13} />,
            label: "End date",
            value: fmtDate(ad.ends_at) || "No expiry",
          },
          {
            icon: <FiClock size={13} />,
            label: "Created",
            value: fmtDate(ad.created_at),
          },
          {
            icon: <FiHash size={13} />,
            label: "Tracking ID",
            value: ad.tracking_id,
            mono: true,
          },
        ].map(({ icon, label, value, mono }) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold shrink-0">
              {icon} {label}
            </span>
            <span
              className={`text-xs font-bold text-slate-700 dark:text-slate-200 text-right ${
                mono ? "font-mono text-indigo-600 dark:text-indigo-400" : ""
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Look up another */}
      <button
        onClick={onReset}
        className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
      >
        Look up a different ID
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdStatsPage() {
  const [ad, setAd] = useState(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0f] flex flex-col items-center justify-start px-5 pt-14 pb-24">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-[1.2rem] bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-500/30 mb-5">
            <FiTrendingUp size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Campaign Stats
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter the tracking ID we sent you to see how your ad is performing.
          </p>
        </div>

        {/* Form or results */}
        {!ad ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <LookupForm onResult={setAd} />
          </div>
        ) : (
          <StatsDashboard ad={ad} onReset={() => setAd(null)} />
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-slate-400 leading-relaxed">
          Stats update within minutes of each interaction.
          <br />
          Questions? Contact us on WhatsApp.
        </p>
      </div>
    </div>
  );
}
