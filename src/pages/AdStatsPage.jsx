import { useState } from "react";
import {
  FiBarChart2,
  FiEye,
  FiMousePointer,
  FiCalendar,
  FiCheckCircle,
  FiXCircle,
  FiSearch,
} from "react-icons/fi";
import { API_BASE_URL } from "../apiConfig";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ ad }) {
  const now = new Date();
  const hasStarted = !ad.starts_at || new Date(ad.starts_at) <= now;
  const notExpired = !ad.ends_at || new Date(ad.ends_at) > now;

  if (!ad.active) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full">
        <FiXCircle size={11} /> Inactive
      </span>
    );
  }
  if (!hasStarted) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
        <FiCalendar size={11} /> Scheduled
      </span>
    );
  }
  if (!notExpired) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full">
        <FiXCircle size={11} /> Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">
      <FiCheckCircle size={11} /> Live
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdStatsPage() {
  const [trackingId, setTrackingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [ad, setAd] = useState(null);
  const [error, setError] = useState(null);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setLoading(true);
    setError(null);
    setAd(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/ads/stats/${encodeURIComponent(trackingId.trim().toUpperCase())}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAd(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start px-4 pt-16 pb-24">
      {/* Header */}
      <div className="text-center mb-10 max-w-md">
        <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
          <FiBarChart2 size={26} className="text-white" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Ad Performance Portal
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          Enter your tracking ID to view your ad's impressions, clicks, and live
          status.
        </p>
      </div>

      {/* Lookup form */}
      <form
        onSubmit={handleLookup}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-6 space-y-4"
      >
        <div>
          <label
            htmlFor="tracking-id"
            className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide"
          >
            Tracking ID
          </label>
          <input
            id="tracking-id"
            type="text"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="e.g. QB-SOLAR-1"
            autoCapitalize="characters"
            className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        {error && (
          <p className="text-xs text-red-500 dark:text-red-400 font-semibold flex items-center gap-1.5">
            <FiXCircle size={13} /> {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !trackingId.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-black rounded-2xl transition active:scale-95"
        >
          {loading ? (
            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <FiSearch size={15} />
          )}
          {loading ? "Looking up…" : "View Stats"}
        </button>
      </form>

      {/* Stats card */}
      {ad && (
        <div className="w-full max-w-sm mt-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
          {/* Creative preview */}
          {ad.media_type === "image" && ad.media_url && (
            <div className="w-full aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <img
                src={ad.media_url}
                alt={`Ad creative for ${ad.advertiser_name}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 space-y-5">
            {/* Title & status */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black text-slate-900 dark:text-white text-base leading-snug">
                  {ad.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {ad.advertiser_name}
                </p>
              </div>
              <StatusBadge ad={ad} />
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 text-center">
                <FiEye size={16} className="mx-auto mb-1 text-indigo-500" />
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {fmt(ad.impressions)}
                </p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">
                  Views
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 text-center">
                <FiMousePointer
                  size={16}
                  className="mx-auto mb-1 text-emerald-500"
                />
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {fmt(ad.clicks)}
                </p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">
                  Clicks
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-3 text-center">
                <FiBarChart2
                  size={16}
                  className="mx-auto mb-1 text-amber-500"
                />
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {ad.ctr}%
                </p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">
                  CTR
                </p>
              </div>
            </div>

            {/* Schedule info */}
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Start date</span>
                <span>{fmtDate(ad.starts_at) || "Immediate"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">End date</span>
                <span>{fmtDate(ad.ends_at) || "No expiry"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Created</span>
                <span>{fmtDate(ad.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Tracking ID</span>
                <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {ad.tracking_id}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discreet footer note */}
      <p className="mt-8 text-center text-[11px] text-slate-400 max-w-xs">
        Stats refresh within a few minutes of each interaction. For questions
        about your campaign, contact us on WhatsApp.
      </p>
    </div>
  );
}
