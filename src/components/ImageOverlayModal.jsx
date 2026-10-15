import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";

const DEFAULT_AVATAR =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";

const ImageOverlayModal = ({ isOpen, onClose, avatarUrl, fullName }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validUrl =
    avatarUrl && avatarUrl !== "NULL" && avatarUrl !== "null"
      ? avatarUrl
      : DEFAULT_AVATAR;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Profile picture preview"
    >
      <div
        className="relative w-[85vmin] max-w-md h-[85vmin] max-h-[440px] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={validUrl}
          alt={`${fullName || "User"}'s profile picture`}
          className="w-full h-full object-cover select-none"
          onError={(e) => {
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="absolute top-4 right-4 size-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-transform active:scale-90"
        >
          <FiX size={20} />
        </button>

        {fullName && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
            <p className="text-white font-bold text-sm truncate">{fullName}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageOverlayModal;
