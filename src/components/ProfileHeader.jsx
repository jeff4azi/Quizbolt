import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaCrown } from "react-icons/fa";
import { FiMoreHorizontal, FiShield, FiSlash, FiEdit2 } from "react-icons/fi";
import Avatar from "./Avatar";
import MessageButton from "./MessageButton";
import ImageOverlayModal from "./ImageOverlayModal";

const getRankConfig = (rank) => {
  if (!rank) return null;
  const num = parseInt(String(rank).replace("#", ""), 10);
  if (num === 1) {
    return {
      gradient: "from-amber-500 via-amber-600 to-amber-700",
      hasCrown: true,
      text: `#${num}`,
    };
  }
  if (num === 2) {
    return {
      gradient: "from-slate-400 via-slate-500 to-slate-600",
      hasCrown: true,
      text: `#${num}`,
    };
  }
  if (num === 3) {
    return {
      gradient: "from-orange-500 via-orange-600 to-orange-700",
      hasCrown: true,
      text: `#${num}`,
    };
  }
  return {
    gradient: "from-blue-600 to-indigo-600",
    hasCrown: false,
    text: String(rank).startsWith("#") ? rank : `#${rank}`,
  };
};

const ProfileHeader = ({
  userProfile,
  rank,
  isPremium,
  isOwnProfile = false,
  onToast,
  layout = "full", // "full" | "compact"
}) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isImageOverlayOpen, setIsImageOverlayOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const rankConfig = getRankConfig(rank);
  const displayName = userProfile?.full_name || "Scholar";
  const username = userProfile?.user_name || userProfile?.id;

  const handleReport = () => {
    setMenuOpen(false);
    if (onToast) onToast("User reported. Thank you for keeping Quiz Bolt safe.");
  };

  const handleBlock = () => {
    setMenuOpen(false);
    if (onToast) onToast(`@${username} has been blocked.`);
  };

  return (
    <>
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Identity */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Clickable Profile Picture */}
            <button
              type="button"
              onClick={() => setIsImageOverlayOpen(true)}
              className="relative shrink-0 focus:outline-none transition-transform active:scale-95 cursor-pointer group"
              title="Click to view full photo"
              aria-label={`View full profile photo of ${displayName}`}
            >
              <Avatar
                avatarUrl={userProfile?.avatar_url}
                size={layout === "compact" ? "md" : "lg"}
                className="rounded-2xl ring-2 ring-slate-100 dark:ring-slate-800 shadow-sm group-hover:opacity-90 transition-opacity"
              />
              {isPremium && (
                <div
                  className="absolute -top-1.5 -right-1.5 bg-amber-400 p-1.5 rounded-xl border-2 border-white dark:border-slate-900"
                  title="Premium Scholar"
                >
                  <FaCrown className="text-white text-[10px]" />
                </div>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                  {displayName}
                </h1>
              </div>

              {username && (
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 truncate mt-0.5">
                  @{username}
                </p>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isPremium
                      ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/40"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50"
                  }`}
                >
                  {isPremium && <FaCrown size={9} />}
                  {isPremium ? "Premium PRO" : "Free tier"}
                </span>

                {rankConfig && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black text-white bg-gradient-to-r ${rankConfig.gradient} shadow-sm dark:shadow-none`}
                  >
                    {rankConfig.hasCrown && <FaCrown size={9} className="opacity-90" />}
                    <span>{rankConfig.text}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold shadow-sm dark:shadow-none transition-transform active:scale-[0.98]"
              >
                <FiEdit2 size={13} />
                <span>Edit profile</span>
              </button>
            ) : (
              <>
                <MessageButton
                  username={username}
                  userProfile={userProfile}
                />

                {/* ⋯ Menu */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    aria-label="More options"
                    aria-expanded={menuOpen}
                    className="size-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all shadow-sm dark:shadow-none active:scale-95"
                  >
                    <FiMoreHorizontal size={16} />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-900/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleReport}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors text-left"
                      >
                        <FiShield className="text-amber-500 size-4" />
                        <span>Report user</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleBlock}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left"
                      >
                        <FiSlash className="size-4" />
                        <span>Block user</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Full Profile Picture Image Modal */}
      <ImageOverlayModal
        isOpen={isImageOverlayOpen}
        onClose={() => setIsImageOverlayOpen(false)}
        avatarUrl={userProfile?.avatar_url}
        fullName={displayName}
      />
    </>
  );
};

export default ProfileHeader;
