import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiBell,
  FiChevronRight,
  FiCheckSquare,
  FiFileText,
  FiGrid,
  FiHeadphones,
  FiHelpCircle,
  FiInfo,
  FiLoader,
  FiLogOut,
  FiLock,
  FiMessageCircle,
  FiMoon,
  FiSettings,
  FiShuffle,
  FiSmartphone,
  FiTrash2,
  FiZap,
} from "react-icons/fi";
import { FaCrown } from "react-icons/fa";

const IOS_TUTORIAL_URL =
  "https://youtube.com/shorts/ndcyOO3Xbog?si=Un0wo2qmTGSgxYf9";
import ConfirmOverlay from "../components/ConfirmOverlay";
import { API_BASE_URL } from "../apiConfig";
import { supabase } from "../supabaseClient";
import { clearExamSession } from "../utils/examSessionStorage";
import {
  subscribeToPush,
  isSubscribedToPush,
  unsubscribeFromPush,
  getCachedNotificationsEnabled,
} from "../lib/push";
import { useInAppNotifications } from "../context/InAppNotificationContext";

const Toggle = ({ checked, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative h-7 w-12 rounded-full p-1 transition-colors ${
      checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    aria-pressed={checked}
  >
    <span
      className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

const SettingRow = ({
  icon: Icon,
  title,
  description,
  tone = "default",
  children,
  onClick,
}) => {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20"
        : "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";

  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`size-10 shrink-0 rounded-2xl flex items-center justify-center ${toneClass}`}
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-sm font-black text-slate-900 dark:text-white">
            {title}
          </span>
          {description && (
            <span className="block truncate text-xs font-medium text-slate-400 dark:text-slate-500">
              {description}
            </span>
          )}
        </span>
      </div>
      <div className="shrink-0">{children}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      {content}
    </div>
  );
};

const SectionLabel = ({ title, description }) => (
  <div className="px-1 pt-6 pb-2">
    <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
      {title}
    </h2>
    {description && (
      <p className="text-xs font-semibold text-slate-400 mt-0.5">
        {description}
      </p>
    )}
  </div>
);

const SettingsScreen = ({
  isPremium,
  onLogout,
  isDarkMode,
  toggleDarkMode,
  autoAdvance,
  toggleAutoAdvance,
  shuffleOptions,
  toggleShuffleOptions,
  unlimitedHints,
  toggleUnlimitedHints,
  showPagination,
  toggleShowPagination,
}) => {
  useDocumentTitle("Settings | QuizBolt");
  const navigate = useNavigate();
  const location = useLocation();
  const [isDeleteOverlayOpen, setDeleteOverlayOpen] = useState(false);
  const [isPremiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] =
    useState(() => getCachedNotificationsEnabled());
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [highlightNotifications, setHighlightNotifications] = useState(false);
  const notificationsSectionRef = useRef(null);
  const { inAppPopupsEnabled, toggleInAppPopups } = useInAppNotifications();

  const [installPrompt, setInstallPrompt] = useState(null);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandaloneMode =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  useEffect(() => {
    // Get install prompt if available
    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
    }
    const handler = (e) => {
      e.preventDefault();
      window.__pwaInstallPrompt = e;
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      window.open(IOS_TUTORIAL_URL, "_blank", "noopener,noreferrer");
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        localStorage.setItem("pwaInstalled", "true");
      }
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);
    }
  };

  useEffect(() => {
    async function checkSubscription() {
      const subscribed = await isSubscribedToPush();
      setPushNotificationsEnabled(subscribed);
    }
    checkSubscription();
  }, []);

  // Handle highlight from query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("highlight") === "notifications") {
      // Scroll to the section
      if (notificationsSectionRef.current) {
        notificationsSectionRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      // Start highlight animation
      setHighlightNotifications(true);
      // Stop highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightNotifications(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [location.search]);

  const handlePushToggle = async () => {
    if (isUpdatingPush) return;

    try {
      setIsUpdatingPush(true);

      if (pushNotificationsEnabled) {
        await unsubscribeFromPush();
        setPushNotificationsEnabled(false);
      } else {
        await subscribeToPush();
        setPushNotificationsEnabled(true);
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
      window.alert(
        "Failed to update notification preferences. Please try again.",
      );
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    try {
      setIsDeleting(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No session found");
      }

      const res = await fetch(`${API_BASE_URL}/api/users/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Delete failed");
      }

      localStorage.removeItem("examHistory");
      clearExamSession();
      await supabase.auth.signOut();
      navigate("/login");
    } catch (err) {
      console.error("Delete account failed:", err.message);
      window.alert(
        err.message || "We couldn't delete your account. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors duration-500">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 lg:px-8">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/")
            }
            className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
            aria-label="Go back"
          >
            <FiArrowLeft size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-black tracking-tight">Settings</h1>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Preferences & account
            </p>
          </div>
          <div className="size-11" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-28 pt-2 lg:px-8">
        {/* ── Appearance ── */}
        <SectionLabel title="Appearance" />
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <SettingRow
              icon={FiMoon}
              title="Dark mode"
              description="Switch between light and dark themes."
            >
              <Toggle checked={isDarkMode} onClick={toggleDarkMode} />
            </SettingRow>

            <SettingRow
              icon={FiGrid}
              title="Show pagination"
              description="Display question bubbles during exams."
            >
              <Toggle checked={showPagination} onClick={toggleShowPagination} />
            </SettingRow>
          </div>
        </section>

        {/* ── Quiz Behaviour ── */}
        <SectionLabel title="Quiz behaviour" />
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <SettingRow
              icon={FiZap}
              title="Auto advance"
              description="Move to the next question after answering."
              tone={isPremium ? "default" : "warning"}
            >
              <div className="relative">
                <Toggle
                  checked={autoAdvance && isPremium}
                  onClick={
                    isPremium
                      ? toggleAutoAdvance
                      : () => setPremiumOverlayOpen(true)
                  }
                  disabled={!isPremium}
                />
                {!isPremium && (
                  <span className="absolute -right-1 -top-2 rounded-full border-2 border-white bg-amber-400 p-1 dark:border-slate-900">
                    <FaCrown className="text-[8px] text-white" />
                  </span>
                )}
              </div>
            </SettingRow>

            <SettingRow
              icon={FiShuffle}
              title="Shuffle options"
              description="Randomise answer order for each question."
              tone={isPremium ? "default" : "warning"}
            >
              <div className="relative">
                <Toggle
                  checked={shuffleOptions || !isPremium}
                  onClick={
                    isPremium
                      ? toggleShuffleOptions
                      : () => setPremiumOverlayOpen(true)
                  }
                  disabled={!isPremium}
                />
                {!isPremium && (
                  <span className="absolute -right-1 -top-2 rounded-full border-2 border-white bg-amber-400 p-1 dark:border-slate-900">
                    <FaCrown className="text-[8px] text-white" />
                  </span>
                )}
              </div>
            </SettingRow>

            <SettingRow
              icon={FiInfo}
              title="Unlimited hints"
              description="Remove the per-exam hint limit."
              tone={isPremium ? "default" : "warning"}
            >
              <div className="relative">
                <Toggle
                  checked={unlimitedHints && isPremium}
                  onClick={
                    isPremium
                      ? toggleUnlimitedHints
                      : () => setPremiumOverlayOpen(true)
                  }
                  disabled={!isPremium}
                />
                {!isPremium && (
                  <span className="absolute -right-1 -top-2 rounded-full border-2 border-white bg-amber-400 p-1 dark:border-slate-900">
                    <FaCrown className="text-[8px] text-white" />
                  </span>
                )}
              </div>
            </SettingRow>


          </div>
        </section>

        {/* ── Notifications ── */}
        <SectionLabel title="Notifications" />
        <section
          ref={notificationsSectionRef}
          className={`rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all duration-500 ${
            highlightNotifications
              ? "ring-4 ring-blue-400/50 dark:ring-blue-500/50 animate-pulse"
              : ""
          }`}
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <SettingRow
              icon={FiBell}
              title="Daily test reminders"
              description="Get notified when you haven't taken a test today."
            >
              <Toggle
                checked={pushNotificationsEnabled}
                onClick={handlePushToggle}
                disabled={isUpdatingPush}
              />
            </SettingRow>

            <SettingRow
              icon={FiMessageCircle}
              title="In-app message popups"
              description="Show pop-up banners for incoming messages and requests."
            >
              <Toggle
                checked={inAppPopupsEnabled}
                onClick={toggleInAppPopups}
              />
            </SettingRow>
          </div>
        </section>

        {/* ── App ── */}
        {!isInStandaloneMode && (
          <>
            <SectionLabel title="App" />
            <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <SettingRow
                  icon={FiSmartphone}
                  title="Install App"
                  description="Add to home screen for faster access"
                  onClick={handleInstall}
                >
                  <FiChevronRight className="text-slate-300" />
                </SettingRow>
              </div>
            </section>
          </>
        )}

        {/* ── Support ── */}
        <SectionLabel title="Support" />
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <SettingRow
              icon={FiHelpCircle}
              title="FAQ"
              description="Browse frequently asked questions."
              onClick={() => navigate("/faq")}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={FiInfo}
              title="About QuizBolt"
              description="Learn more about the platform."
              onClick={() => navigate("/about")}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={FiHeadphones}
              title="Contact Support"
              description="Chat with us on WhatsApp."
              onClick={() =>
                window.open(
                  "https://wa.me/2347015585397",
                  "_blank",
                )
              }
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={FiAlertTriangle}
              title="Report a Problem"
              description="Send a message to support."
              tone="warning"
              onClick={() =>
                window.open(
                  "https://wa.me/2347015585397?text=Hi%20Quiz%20Bolt%20Support,%20I%20found%20an%20issue...",
                  "_blank",
                )
              }
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={FiMessageCircle}
              title="Submit a Review"
              description="Share your feedback about QuizBolt."
              onClick={() => navigate("/submit-review")}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>
          </div>
        </section>

        {/* ── Account ── */}
        <SectionLabel title="Account" />
        <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <SettingRow
              icon={FiLock}
              title="Privacy Policy"
              description="How we collect and use your data."
              onClick={() => navigate("/privacy")}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={FiFileText}
              title="Terms of Service"
              description="The rules for using QuizBolt."
              onClick={() => navigate("/terms")}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={FiLogOut}
              title="Sign Out"
              description="Log out of this device."
              tone="danger"
              onClick={onLogout}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>

            <SettingRow
              icon={isDeleting ? FiLoader : FiTrash2}
              title="Delete Account"
              description="Permanently remove your account and data."
              tone="danger"
              onClick={() => setDeleteOverlayOpen(true)}
            >
              <FiChevronRight className="text-slate-300" />
            </SettingRow>
          </div>
        </section>
      </main>

      <ConfirmOverlay
        isOpen={isDeleteOverlayOpen}
        onClose={() => setDeleteOverlayOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        message="This will remove your profile and exam history from this device. This action cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Yes, delete my account"}
        cancelText="Cancel"
        danger={true}
      />

      <ConfirmOverlay
        isOpen={isPremiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => navigate("/premium")}
        title="Auto-Advance with Premium"
        message="Upgrade to Premium to control whether questions automatically advance after answering."
        confirmText="Upgrade to Premium"
        cancelText="Not now"
      />
    </div>
  );
};

export default SettingsScreen;

import useDocumentTitle from "../hooks/useDocumentTitle";