import { useEffect, useState, useRef, useId } from "react";
import { useLocation } from "react-router-dom";
import { createPortal } from "react-dom";

const HINT_KEY = "quizbolt_new_user_hint_dismissed";

// TEMPORARY: Set to true during redesign so the hint is always visible for preview
const FORCE_VISIBLE_PREVIEW = false;

export const isNewUserHintVisible = (isNew) => {
  if (FORCE_VISIBLE_PREVIEW) return true;
  if (!isNew) return false;
  try {
    return localStorage.getItem(HINT_KEY) !== "1";
  } catch {
    return true;
  }
};

// ─── Spotlight Overlay ──────────────────────────────────────────────────────
// Uses an SVG mask to punch a transparent hole around the target element.
// Each instance gets a unique mask ID to avoid conflicts when both variants
// are mounted during the FORCE_VISIBLE_PREVIEW development phase.
const SpotlightOverlay = ({ targetRef, onDismiss, shape = "rounded", maskId }) => {
  const [hole, setHole] = useState(null);

  useEffect(() => {
    const calculate = () => {
      if (!targetRef?.current) return;
      const r = targetRef.current.getBoundingClientRect();
      const PAD = 8;
      setHole({
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
        rx: shape === "pill" ? (r.height + PAD * 2) / 2 : 12,
      });
    };

    calculate();
    const timer = setTimeout(calculate, 80);
    window.addEventListener("resize", calculate);
    window.addEventListener("scroll", calculate, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculate);
      window.removeEventListener("scroll", calculate, true);
    };
  }, [targetRef, shape]);

  return createPortal(
    <svg
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 49, pointerEvents: "all" }}
      onClick={onDismiss}
      onTouchEnd={(e) => { e.preventDefault(); onDismiss(); }}
    >
      <defs>
        <mask id={maskId}>
          {/* White = show dark overlay */}
          <rect width="100%" height="100%" fill="white" />
          {/* Black = punch transparent hole */}
          {hole && (
            <rect
              x={hole.left}
              y={hole.top}
              width={hole.width}
              height={hole.height}
              rx={hole.rx}
              ry={hole.rx}
              fill="black"
            />
          )}
        </mask>
      </defs>

      {/* Dark overlay — masked so the hole area is transparent */}
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.50)"
        mask={`url(#${maskId})`}
        style={{ pointerEvents: "all" }}
      />

      {/* Transparent rect over the hole so clicks fall through to nav item */}
      {hole && (
        <rect
          x={hole.left}
          y={hole.top}
          width={hole.width}
          height={hole.height}
          rx={hole.rx}
          ry={hole.rx}
          fill="transparent"
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>,
    document.body
  );
};

// ─── Popover Card ────────────────────────────────────────────────────────────
const Card = ({ cardRef, children, className = "" }) => (
  <div
    ref={cardRef}
    className={`relative bg-[#1b2c54] border border-white/10 rounded-2xl shadow-2xl p-5 ${className}`}
  >
    {children}
  </div>
);

// ─── Shared card content ─────────────────────────────────────────────────────
const CardContent = ({ isMobile, onDismiss }) => (
  <>
    <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">
      Quick tip
    </p>
    <h3 className="text-[15px] font-black text-white leading-snug">
      Select a course to get started
    </h3>
    <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
      {isMobile
        ? <>Tap <span className="text-white font-semibold">Courses</span> below to pick a subject and begin your first test.</>
        : <>Click <span className="text-white font-semibold">Courses</span> to choose a subject and unlock past questions, flashcards &amp; rankings.</>
      }
    </p>
    <button
      type="button"
      onClick={onDismiss}
      className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-sm font-bold tracking-wide transition-all"
    >
      Got it
    </button>
  </>
);

// ─── Main Component ──────────────────────────────────────────────────────────
const NewUserCourseHint = ({
  variant = "mobile",
  isNew,
  targetRef,
  onDismiss,
}) => {
  const location = useLocation();
  const popoverRef = useRef(null);
  const uid = useId().replace(/:/g, ""); // unique, safe for SVG id attribute

  // ── Responsive guard: only render the correct variant per screen size ──────
  // This prevents both mobile + desktop from showing simultaneously when
  // createPortal bypasses the parent lg:hidden wrapper.
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const [visible, setVisible] = useState(() => {
    if (FORCE_VISIBLE_PREVIEW) return true;
    if (!isNew) return false;
    try { return localStorage.getItem(HINT_KEY) !== "1"; } catch { return true; }
  });

  // Mobile: caret pixel offset so the arrow points at the target
  const [caretOffset, setCaretOffset] = useState(null);
  // Desktop: floating card position
  const [desktopPos, setDesktopPos] = useState(null);

  // Auto-dismiss on navigation to the target page
  useEffect(() => {
    if (FORCE_VISIBLE_PREVIEW) return;
    if (location.pathname === "/choose-course") dismiss();
  }, [location.pathname]);

  // Mobile caret alignment
  useEffect(() => {
    if (variant !== "mobile") return;
    const update = () => {
      if (!targetRef?.current || !popoverRef.current) return;
      const tRect = targetRef.current.getBoundingClientRect();
      const pRect = popoverRef.current.getBoundingClientRect();
      const centerX = tRect.left + tRect.width / 2;
      const rel = centerX - pRect.left;
      setCaretOffset(Math.max(24, Math.min(pRect.width - 24, rel)));
    };
    update();
    const t = setTimeout(update, 150);
    window.addEventListener("resize", update);
    return () => { clearTimeout(t); window.removeEventListener("resize", update); };
  }, [variant, targetRef, isDesktop]);

  // Desktop position — card floats right of the sidebar
  useEffect(() => {
    if (variant !== "desktop") return;
    const update = () => {
      if (!targetRef?.current) return;
      const r = targetRef.current.getBoundingClientRect();
      setDesktopPos({
        top: Math.max(16, r.top + r.height / 2 - 64),
        left: r.right + 18,
      });
    };
    update();
    const t = setTimeout(update, 150);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [variant, targetRef, isDesktop]);

  const dismiss = () => {
    // Always hide — FORCE_VISIBLE_PREVIEW only controls the initial state,
    // not whether the user can dismiss it during preview.
    setVisible(false);
    if (!FORCE_VISIBLE_PREVIEW) {
      try { localStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ }
    }
    onDismiss?.();
  };

  if (!visible) return null;
  if (!FORCE_VISIBLE_PREVIEW && !isNew) return null;

  // ── MOBILE — only render on small screens ──────────────────────────────────
  if (variant === "mobile") {
    if (isDesktop) return null; // ← prevents double-render

    return createPortal(
      <>
        <SpotlightOverlay
          targetRef={targetRef}
          onDismiss={dismiss}
          shape="rounded"
          maskId={`spotlight-${uid}-mobile`}
        />

        {/* Card floats above the bottom nav */}
        <div
          className="fixed inset-x-0 bottom-[92px] z-50 px-4 flex justify-center pointer-events-none"
          style={{ zIndex: 50 }}
        >
          <div className="pointer-events-auto w-full max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-300">
            <Card cardRef={popoverRef}>
              <CardContent isMobile onDismiss={dismiss} />

              {/* Downward caret — points at the Courses nav icon */}
              <div
                className="absolute -bottom-[7px] w-3.5 h-3.5 bg-[#1b2c54] border-r border-b border-white/10"
                style={{
                  left: caretOffset != null ? `${caretOffset}px` : "30%",
                  transform: "translateX(-50%) rotate(45deg)",
                }}
              />
            </Card>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── DESKTOP — only render on large screens ─────────────────────────────────
  if (!isDesktop) return null; // ← prevents double-render
  if (!desktopPos) return null;

  return createPortal(
    <>
      <SpotlightOverlay
        targetRef={targetRef}
        onDismiss={dismiss}
        shape="pill"
        maskId={`spotlight-${uid}-desktop`}
      />

      {/* Card floats to the right of the sidebar Courses button */}
      <div
        className="fixed pointer-events-none animate-in fade-in slide-in-from-left-3 duration-300"
        style={{ top: desktopPos.top, left: desktopPos.left, zIndex: 50 }}
      >
        <div className="pointer-events-auto">
          <Card className="w-72">
            <CardContent isMobile={false} onDismiss={dismiss} />

            {/* Leftward caret — points at the sidebar Courses button */}
            <div
              className="absolute -left-[7px] top-[28px] w-3.5 h-3.5 bg-[#1b2c54] border-l border-b border-white/10"
              style={{ transform: "rotate(45deg)" }}
            />
          </Card>
        </div>
      </div>
    </>,
    document.body
  );
};

export default NewUserCourseHint;
