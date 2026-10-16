import React, { useState, useEffect } from "react";

// URL to use when no picture is supplied by the user
export const DEFAULT_AVATAR_URL =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const sizeMap = {
  sm: { w: 50, h: 50 },
  md: { w: 100, h: 100 },
  lg: { w: 400, h: 400 },
};

const buildTransformedUrl = (url, sizeKey) => {
  if (!url) return null;
  const size = sizeMap[sizeKey] || sizeMap.sm;

  // If this is a Cloudinary URL, inject the transformation
  try {
    const uploadSegment = "/upload/";
    const idx = url.indexOf(uploadSegment);
    if (idx !== -1) {
      const prefix = url.substring(0, idx + uploadSegment.length);
      const suffix = url.substring(idx + uploadSegment.length);
      return `${prefix}w_${size.w},h_${size.h},c_fill/${suffix}`;
    }
  } catch {
    // fall through to original url
  }

  return url;
};

const Avatar = ({
  avatarUrl,
  size = "sm",
  alt = "User avatar",
  className = "",
  lazy = false, // only leaderboard should load lazily
  isOnline = false,
}) => {
  // ensure we always have a URL to display and update when prop changes
  const [imgSrc, setImgSrc] = useState(avatarUrl || DEFAULT_AVATAR_URL);

  useEffect(() => {
    setImgSrc(avatarUrl || DEFAULT_AVATAR_URL);
  }, [avatarUrl]);

  const transformedUrl = buildTransformedUrl(imgSrc, size) || imgSrc;

  const handleError = () => {
    if (imgSrc !== DEFAULT_AVATAR_URL) {
      setImgSrc(DEFAULT_AVATAR_URL);
    }
  };

  const dotSizeClass =
    size === "lg" ? "size-4 border-2" : size === "md" ? "size-3.5 border-2" : "size-2.5 border-[1.5px]";

  return (
    <div className={`relative inline-block shrink-0 ${className}`}>
      <div className={`rounded-full overflow-hidden ${className}`}>
        <img
          src={transformedUrl}
          alt={alt}
          loading={lazy ? "lazy" : "eager"}
          onError={handleError}
          className={`object-cover ${
            size === "lg"
              ? "w-24 h-24"
              : size === "md"
                ? "w-14 h-14"
                : "w-10 h-10"
          } ${className}`}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </div>
      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 border-white dark:border-slate-900 shadow-sm ${dotSizeClass}`}
          title="Online now"
          aria-label="Online"
        />
      )}
    </div>
  );
};

export default Avatar;
