import React, { useState, useEffect, useMemo } from "react";
import { FiX, FiVolume2, FiVolumeX, FiExternalLink } from "react-icons/fi";

// 1. Database with flexible "link" config per ad.
//    link.type === "whatsapp"  -> opens WhatsApp chat with a prefilled message
//    link.type === "website"   -> opens any external URL directly (no phone/message needed)
const AD_DATABASE = [
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1777905618/Advertise_Here_20260206_152922_0000_bns87b_jm43tr.png",
    duration: 5,
    link: {
      type: "whatsapp",
      phone: "2347015585397",
      message:
        "Hi, I'd like to advertise on Quiz Bolt. Can you share pricing and details?",
    },
  },
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1777905619/Advertise_Here_20260206_152335_0000_lg0smh_tlkppg.png",
    duration: 5,
    link: {
      type: "whatsapp",
      phone: "2347015585397",
      message:
        "Hi, I'd like to advertise on Quiz Bolt. Can you share pricing and details?",
    },
  },
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1782482362/3_wq6dmi.png",
    duration: 5,
    link: {
      type: "whatsapp",
      phone: "2347015585397",
      message:
        "Hello QuizBolt Team,\n\n" +
        "I would like to request access to a rerun/carryover course.\n\n" +
        "Your Username: _____\n" +
        "University: _____\n" +
        "Rerun Course(s): _____\n\n" +
        "Thank you.",
    },
  },
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1782200330/2_20260623_054442_0001_utwiar.png",
    duration: 5,
    link: {
      type: "whatsapp",
      phone: "2349118907839",
      message:
        "I'd like to stay informed with updates from Odunaike Olabode Mustapha (PKA Speed Bolt).",
    },
  },
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1777905622/flyer_fcbjfw_t7sksl.png",
    duration: 5,
    link: {
      type: "whatsapp",
      phone: "2347015585397",
      message:
        "Hi, I'm interested in getting a website built. Can you share your pricing and examples of your work?",
    },
  },
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1779707308/WhatsApp_Image_2026-05-24_at_00.04.45_x19cgf.jpg",
    duration: 5,
    link: {
      type: "whatsapp",
      phone: "2348120390409",
      message:
        "Hi, I saw your flyer online and wanted to connect. I'm interested in learning more about your solar panel and inverter setup services.",
    },
  },
  {
    type: "image",
    url: "https://res.cloudinary.com/dn5h1cghb/image/upload/v1788168218/PrepUnivFlyer_v03ndf.png",
    duration: 5,
    link: {
      type: "website",
      url: "https://prepuniv.com",
    },
  },
];

function resizeCloudinaryUrl(url) {
  if (!url.includes("cloudinary.com")) return url;
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

// 2. Resolves the correct href + target/rel for whatever link type the ad uses.
//    Falls back gracefully (and logs a warning) if an ad has a malformed link.
function resolveAdLink(link) {
  if (!link) {
    console.warn("BannerAd: ad has no `link` config, disabling click-through.");
    return { href: undefined, isExternalSite: false };
  }

  switch (link.type) {
    case "whatsapp": {
      if (!link.phone) {
        console.warn("BannerAd: whatsapp link missing `phone`.");
        return { href: undefined, isExternalSite: false };
      }
      const text = encodeURIComponent(link.message || "");
      return {
        href: `https://wa.me/${link.phone}${text ? `?text=${text}` : ""}`,
        isExternalSite: false,
      };
    }
    case "website": {
      if (!link.url) {
        console.warn("BannerAd: website link missing `url`.");
        return { href: undefined, isExternalSite: false };
      }
      return { href: link.url, isExternalSite: true };
    }
    default:
      console.warn(`BannerAd: unknown link.type "${link.type}".`);
      return { href: undefined, isExternalSite: false };
  }
}

const BannerAd = ({ onAdClose }) => {
  const currentAd = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * AD_DATABASE.length);
    return AD_DATABASE[randomIndex];
  }, []);

  const [timeLeft, setTimeLeft] = useState(currentAd?.duration || 5);
  const [isClosable, setIsClosable] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const { href, isExternalSite } = useMemo(
    () => resolveAdLink(currentAd?.link),
    [currentAd],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";

    // Only starts counting when the image/video is actually loaded
    if (isReady && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isReady && timeLeft === 0) {
      setIsClosable(true);
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [timeLeft, isReady]);

  const handleClose = () => {
    setIsVisible(false);
    document.body.style.overflow = "auto";
    if (onAdClose) onAdClose();
  };

  if (!isVisible || !currentAd) return null;

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (timeLeft / currentAd.duration) * circumference;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-500"
        onClick={isClosable ? handleClose : undefined}
      />

      {/* 3. Responsive Aspect Ratio: A4 on mobile, 16:9 on LG */}
      <div className="relative w-full max-w-md aspect-[1/1.414] bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 dark:border-slate-800 animate-in zoom-in-95 duration-500">
        {/* 4. Clickable Area — routes to WhatsApp or an external website depending on the ad's link type */}
        <a
          href={href}
          target={href ? "_blank" : undefined}
          rel={href ? "noopener noreferrer" : undefined}
          className={`block w-full h-full bg-slate-100 dark:bg-slate-950 relative overflow-hidden ${href ? "cursor-pointer" : "cursor-default"}`}
          onClick={(e) => {
            if (!href) e.preventDefault();
          }}
        >
          {/* Loading state spinner */}
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="size-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {currentAd.type === "video" ? (
            <video
              src={resizeCloudinaryUrl(currentAd.url)}
              autoPlay
              muted={isMuted}
              loop
              playsInline
              onCanPlayThrough={() => setIsReady(true)}
              // 5. Object-contain prevents cropping
              className={`w-full h-full object-contain transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
            />
          ) : (
            <img
              src={resizeCloudinaryUrl(currentAd.url)}
              alt="Sponsored Content"
              onLoad={() => setIsReady(true)}
              // 5. Object-contain prevents cropping
              className={`w-full h-full object-contain transition-opacity duration-500 ${isReady ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {/* Small badge so users know a website ad opens a link rather than a WhatsApp chat */}
          {isExternalSite && isReady && (
            <div className="absolute bottom-6 right-6 flex items-center gap-1 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/20 text-white text-[10px] font-bold uppercase tracking-wide">
              <FiExternalLink size={12} />
              Visit site
            </div>
          )}
        </a>

        {currentAd.type === "video" && (
          <button
            onClick={(e) => {
              e.preventDefault(); // Prevents opening the ad's link
              setIsMuted(!isMuted);
            }}
            className="absolute bottom-6 right-6 size-10 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-full border border-white/20 text-white z-10 active:scale-90 transition-all"
          >
            {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
          </button>
        )}

        <div className="absolute top-6 right-6 z-10 pointer-events-auto">
          {!isClosable ? (
            <div className="relative size-12 flex items-center justify-center bg-black/40 backdrop-blur-xl rounded-full border border-white/20 shadow-lg">
              <svg className="absolute inset-0 size-full -rotate-90">
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
                e.preventDefault(); // Prevents opening the ad's link
                handleClose();
              }}
              className="size-12 flex items-center justify-center bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-full shadow-2xl active:scale-90 hover:scale-105 transition-all border border-slate-200 dark:border-slate-700"
            >
              <FiX size={24} />
            </button>
          )}
        </div>

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
