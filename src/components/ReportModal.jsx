import React, { useState } from "react";
import { FiAlertTriangle, FiX, FiCheck } from "react-icons/fi";

const REPORT_REASONS = [
  { id: "spam", label: "Spam or automated messages" },
  { id: "harassment", label: "Harassment, hate speech, or abuse" },
  { id: "impersonation", label: "Impersonation or fake account" },
  { id: "inappropriate_content", label: "Inappropriate or explicit content" },
  { id: "cheating", label: "Cheating, exam misconduct, or unfair play" },
  { id: "other", label: "Other issue" },
];

export const ReportModal = ({
  isOpen,
  onClose,
  username,
  displayName,
  onSubmitReport,
}) => {
  const [reason, setReason] = useState("spam");
  const [description, setDescription] = useState("");
  const [blockToo, setBlockToo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!reason) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      if (onSubmitReport) {
        await onSubmitReport({
          reason,
          description,
          blockToo,
        });
      }
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1600);
    } catch (err) {
      console.error("Report submit error:", err);
      setErrorMsg(err.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Close report modal"
          className="absolute top-5 right-5 size-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center transition-colors"
        >
          <FiX size={18} />
        </button>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="size-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <FiCheck size={28} />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Report Submitted
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Thank you for keeping QuizBolt safe. Our moderation team has been notified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <FiAlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h2
                  id="report-modal-title"
                  className="text-base font-black text-slate-900 dark:text-white truncate"
                >
                  Report @{username || "user"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {displayName || "Scholar"}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Why are you reporting this user?
              </label>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => {
                  const isSelected = reason === r.id;
                  return (
                    <label
                      key={r.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl border text-xs font-semibold cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={r.id}
                        checked={isSelected}
                        onChange={() => setReason(r.id)}
                        className="text-blue-600 focus:ring-blue-500 size-4"
                      />
                      <span className="flex-1">{r.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="report-description"
                className="block text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5"
              >
                Additional Details (Optional)
              </label>
              <textarea
                id="report-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide context or specify what happened..."
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none font-medium"
              />
            </div>

            {/* Block too checkbox */}
            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={blockToo}
                onChange={(e) => setBlockToo(e.target.checked)}
                className="size-4 rounded-md text-blue-600 focus:ring-blue-500 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Also block @{username} from messaging me
              </span>
            </label>

            <div className="flex items-center gap-2.5 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason}
                className="flex-1 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
