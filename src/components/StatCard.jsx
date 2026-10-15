import React from "react";

const StatCard = ({ label, value, icon: Icon, subtext, className = "" }) => {
  return (
    <div
      className={`bg-white dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:border-slate-200 dark:hover:border-slate-600 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 truncate">
          {label}
        </span>
        {Icon && (
          <div className="size-7 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-300 shrink-0">
            <Icon size={14} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {value != null && value !== "" ? value : "—"}
        </span>
        {subtext && (
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
