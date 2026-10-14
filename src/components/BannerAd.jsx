import { useState, useEffect, useMemo, useRef } from "react";
import { FiX, FiVolume2, FiVolumeX, FiExternalLink } from "react-icons/fi";
import { API_BASE_URL } from "../apiConfig";

// ─── Weighted random pick ────────────────────────────────────────────────────
// Builds a probability pool based on each ad's display_weight so heavier ads
// appear proportionally more often than a pure 1/N random roll.
function weightedPick(ads) {
  if (!ads || ads.length === 0) return null;
  const totalWeight = ads.reduce(
    (sum, ad) => sum + (ad.display_weight || 1),
    0,
  );
  let rand = Math.random() * totalWeight;
  for (const ad of ads) {
    rand -= ad.display_weight || 1;
    if (rand <= 0) return ad;
  }
  return ads[ads.length - 1];
}

// ─── Cloudinary responsive resize ───────────────────────────────────────────
function resizeCloudinaryUrl(url) {
  if (!url || !url.includes("cloudinary.com")) return url;
  if (url.includes("/upload/w_")) return url; // already transformed

  let w = 800,
    h = 1131;
  const width = window.innerWidth;
  if (width < 768) {
    w = 600;
    h = 849;
  } else if (width < 1024) {
    w = 700;
    h = 992;
  }

  return url.replace("/upload/", `/upload/w_${w},h_${h},c_fill,q_auto,f_auto/`);
}

// ─── Link resolver ───────────────────────────────────────────────────────────
function resolveAdLink(ad) {
  if (!ad) return { href: undefined, isExternalSite: false };

  switch (ad.link_type) {
    case "whatsapp": {
      if (!ad.whatsapp_phone) return { href: undefined, isExternalSite: false };
      const text = encodeURIComponent(ad.whatsapp_message || "");
      return {
        href: `https://wa.me/${ad.whatsapp_phone}${text ? `?text=${text}` : ""}`,
        isExternalSite: false,
      };
    }
    case "website": {
      if (!ad.link_url) return { href: undefined, isExternalSite: false };
      return { href: ad.link_url, isExternalSite: true };
    }
    default:
      return { href: undefined, isExternalSite: false };
  }
}

// ─── Fire-and-forget tracking ────────────────────────────────────────────────
function trackImpression(id) {
  fetch(`${API_BASE_URL}/api/ads/${id}/impression`, { method: "POST" }).catch(
    () => {},
  );
}

function trackClick(id) {
  fetch(`${API_BASE_URL}/api/ads/${id}/click`, { method: "POST" }).catch(
    () => {},
  );
}

// ─── Session-level ad cache ──────────────────────────────────────────────────
// Fetched once per session so every BannerAd mount reuses the same list
// without a network hit.
let _adsCache = null;
let _adsFetching = null;

async function getActiveAds() {
  if (_adsCache) return _adsCache;
  if (!_adsFetching) {
    _adsFetching = fetch(`${API_BASE_URL}/api/ads/active`)
      .then((r) => r.json())
      .then((data) => {
        _adsCache = Array.isArray(data) && data.length > 0 ? data : null;
        return _adsCache;
      })
      .catch(() => null);
  }
  return _adsFetching;
}

// Pre-warm the cache as soon as the module loads so the first ad show is instant
getActiveAds();

// ─── Component ───────────────────────────────────────────────────────────────
const BannerAd = ({ onAdClose }) => {
  const [currentAd, setCurrentAd] = useState(null);
  const [timeLeft, setTimeLeft] = useState(5);
  const [isClosable, setIsClosable] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const impressionFired = useRef(false);

  // Pick an ad from the weighted pool on mount
  useEffect(() => {
    getActiveAds().then((ads) => {
      const picked = weightedPick(ads);
      if (picked) {
        setCurrentAd(picked);
        setTimeLeft(picked.duration_secs || 5);
      }
    });
  }, []);

  const { href, isExternalSite } = useMemo(
    () => resolveAdLink(currentAd),
    [currentAd],
  );

  // Countdown — only starts once the media has loaded
  useEffect(() => {
    document.body.style.overflow = "hidden";

    if (isReady && timeLeft > 0) {
      // Fire impression once, when the ad becomes ready
      if (!impressionFired.current && currentAd?.id) {
        impressionFired.current = true;
        trackImpression(currentAd.id);
      }
      const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isReady && timeLeft === 0) {
      setIsClosable(true);
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [timeLeft, isReady, currentAd]);

  const handleClose = () => {
    setIsVisible(false);
    document.body.style.overflow = "auto";
    if (onAdClose) onAdClose();
  };

  const handleAdClick = () => {
    if (href && currentAd?.id) trackClick(currentAd.id);
  };

  if (!isVisible || !currentAd) return null;

  const duration = currentAd.duration_secs || 5;
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (timeLeft / duration) * circumference;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-500"
        onClick={isClosable ? handleClose : undefined}
      />

      {/* Responsive aspect ratio: A4 on mobile, square-ish on desktop */}
      <div className="relative w-full max-w-md aspect-[1/1.414] bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800 animate-in zoom-in-95 duration-500">
        {/* Clickable creative area */}
        <a
          href={href}
          target={href ? "_blank" : undefined}
          rel={href ? "noopener noreferrer" : undefined}
          className={`block w-full h-full bg-slate-100 dark:bg-slate-950 relative overflow-hidden ${href ? "cursor-pointer" : "cursor-default"}`}
          onClick={(e) => {
            if (!href) {
              e.preventDefault();
              return;
            }
            handleAdClick();
          }}
        >
          {/* Loading spinner */}
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {currentAd.media_type === "video" ? (
            <video
              src={resizeCloudinaryUrl(currentAd.media_url)}
              autoPlay
              muted={isMuted}
              loop
              playsInline
              onCanPlayThrough={() => setIsReady(true)}
              className={`w-full h-full object-contain transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <img
              src={resizeCloudinaryUrl(currentAd.media_url)}
              alt={`Sponsored by ${currentAd.advertiser_name}`}
              onLoad={() => setIsReady(true)}
              className={`w-full h-full object-contain transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {/* "Visit site" badge for website ads */}
          {isExternalSite && isReady && (
            <div className="absolute bottom-6 right-6 flex items-center gap-1 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/20 text-white text-[10px] font-bold uppercase tracking-wide">
              <FiExternalLink size={12} />
              Visit site
            </div>
          )}
        </a>

        {/* Video mute toggle */}
        {currentAd.media_type === "video" && (
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsMuted((m) => !m);
            }}
            className="absolute bottom-6 right-6 size-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full border border-white/20 text-white z-10 active:scale-90 transition-all"
            aria-label={isMuted ? "Unmute ad" : "Mute ad"}
          >
            {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
          </button>
        )}

        {/* Countdown / close button */}
        <div className="absolute top-6 right-6 z-10 pointer-events-auto">
          {!isClosable ? (
            <div className="relative size-12 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
              <svg
                className="absolute inset-0 size-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="24"
                  cy="24"
                  r={radius}
                  stroke="white"
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={circumference}
                  style={{
                    strokeDashoffset,
                    transition: "stroke-dashoffset 1s linear",
                  }}
                  className="opacity-90"
                />
              </svg>
              <span className="text-xs font-black text-white">{timeLeft}</span>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                handleClose();
              }}
              className="size-12 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-full shadow-2xl active:scale-90 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700"
              aria-label="Close ad"
            >
              <FiX size={24} />
            </button>
          )}
        </div>

        {/* Sponsored badge */}
        <div className="absolute bottom-6 left-6 pointer-events-none">
          <div className="px-3 py-1 bg-black/30 backdrop-blur-md rounded-full border border-white/10">
            <span className="text-[10px] font-black text-white/90 uppercase tracking-[0.2em]">
              Sponsored
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerAd;
