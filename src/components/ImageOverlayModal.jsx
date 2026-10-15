import React, { useState, useEffect } from "react";
import { FiX } from "react-icons/fi";
import { DEFAULT_AVATAR_URL } from "./Avatar";

const ImageOverlayModal = ({ isOpen, onClose, avatarUrl, fullName }) => {
  const [imgSrc, setImgSrc] = useState(
    avatarUrl && avatarUrl !== "NULL" && avatarUrl !== "null"
      ? avatarUrl
      : DEFAULT_AVATAR_URL
  );

  useEffect(() => {
    if (avatarUrl && avatarUrl !== "NULL" && avatarUrl !== "null") {
      setImgSrc(avatarUrl);
    } else {
      setImgSrc(DEFAULT_AVATAR_URL);
    }
  }, [avatarUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleError = () => {
    if (imgSrc !== DEFAULT_AVATAR_URL) {
      setImgSrc(DEFAULT_AVATAR_URL);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Profile picture preview"
    >
      <div
        className="group relative w-[88vmin] sm:w-[500px] lg:w-[580px] max-w-[92vw] aspect-square max-h-[85vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200 select-none cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imgSrc}
          alt={`${fullName || "User"}'s profile picture`}
          className="w-full h-full object-cover select-none"
          loading="eager"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onError={handleError}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo preview"
          className="absolute top-4 right-4 z-20 size-10 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md text-white/90 hover:text-white flex items-center justify-center transition-all active:scale-90 border border-white/10 shadow-lg"
        >
          <FiX size={20} />
        </button>

        {/* Name overlay - hidden by default, visible only on hover */}
        {fullName && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 pt-14 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <p className="text-white font-black text-base sm:text-lg truncate drop-shadow-md">
              {fullName}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageOverlayModal;
