import React, { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SidebarNavItem, isActivePath } from "./NavBar";
import {
  IoBookmark,
  IoBookmarkOutline,
  IoHome,
  IoHomeOutline,
  IoLibrary,
  IoLibraryOutline,
  IoTime,
  IoTimeOutline,
  IoTrophy,
  IoTrophyOutline,
  IoChatbubbles,
  IoChatbubblesOutline,
} from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import Logo from "../images/Logo";
import Avatar from "./Avatar";
import ConfirmOverlay from "./ConfirmOverlay";
import NewUserCourseHint, { isNewUserHintVisible } from "./NewUserCourseHint";
import { FeedBoltSidebarLink } from "./FeedBoltBanner";
import { useMessaging } from "../hooks/useMessaging";

/**
 * DesktopLayout wraps protected pages.
 *
 * On mobile (< lg): renders children directly — NavBar bottom bar is inside each page.
 * On desktop (lg+): renders a fixed left sidebar alongside the page content.
 *
 * Children are rendered ONCE. The sidebar is overlaid via CSS on large screens.
 * The `desktop-content-wrapper` class on the main area triggers CSS overrides
 * in index.css that expand pages beyond their mobile max-w-2xl.
 */
const DesktopLayout = ({ children, isPremium, userProfile, isNew }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname || "/";
  const [premiumOverlayOpen, setPremiumOverlayOpen] = useState(false);
  const { totalUnreadCount } = useMessaging();
  const desktopCoursesRef = useRef(null);

  const go = (path) => navigate(path);

  const handleSavedClick = () => {
    go("/bookmarks");
  };

  const isExamActive = pathname === "/exam";
  const [hintDismissed, setHintDismissed] = useState(false);
  const showCourseHint =
    isNewUserHintVisible(isNew) &&
    !hintDismissed &&
    !isExamActive &&
    pathname !== "/choose-course";

  const homeActive = isActivePath(pathname, "/");
  const coursesActive = isActivePath(pathname, "/choose-course");
  const historyActive = isActivePath(pathname, "/history");
  const savedActive = isActivePath(pathname, "/bookmarks");
  const leadersActive = isActivePath(pathname, "/leaderboard");
  const messagesActive = isActivePath(pathname, "/messages");
  const profileActive = isActivePath(pathname, "/profile");

  const navItems = [
    {
      label: "Home",
      active: homeActive,
      onClick: () => go("/"),
      icon: homeActive ? <IoHome size={20} /> : <IoHomeOutline size={20} />,
    },
    {
      label: "Courses",
      active: coursesActive,
      onClick: () => go("/choose-course"),
      icon: coursesActive ? (
        <IoLibrary size={20} />
      ) : (
        <IoLibraryOutline size={20} />
      ),
    },
    {
      label: "History",
      active: historyActive,
      onClick: () => go("/history"),
      icon: historyActive ? <IoTime size={20} /> : <IoTimeOutline size={20} />,
    },
    {
      label: "Saved",
      active: savedActive,
      onClick: handleSavedClick,
      icon: savedActive ? (
        <IoBookmark size={20} />
      ) : (
        <IoBookmarkOutline size={20} />
      ),
    },
    {
      label: "Leaderboard",
      active: leadersActive,
      onClick: () => go("/leaderboard"),
      icon: leadersActive ? (
        <IoTrophy size={20} />
      ) : (
        <IoTrophyOutline size={20} />
      ),
    },
    {
      label: "Messages",
      active: messagesActive,
      badge: totalUnreadCount,
      onClick: () => go("/messages"),
      icon: messagesActive ? (
        <IoChatbubbles size={20} />
      ) : (
        <IoChatbubblesOutline size={20} />
      ),
    },
  ];

  return (
    /*
      Outer wrapper:
      - On mobile: plain block, children render normally
      - On desktop: flex row with sidebar + content
    */
    <div className="min-h-[100dvh] bg-[#F8FAFC] dark:bg-[#0F172A] lg:flex">
      {/* ── Desktop sidebar (hidden on mobile) ──────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 z-40 shadow-sm">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-100 dark:border-slate-800 flex gap-2">
          <Logo className="h-8 w-auto" />
          <p className="text-sm font-bold tracking-[0.2em] uppercase mt-2 text-slate-400">
            Quiz Bolt
          </p>
        </div>

        {/* Nav items — pointer-events disabled during exam */}
        <nav
          className={`flex-1 px-3 py-4 space-y-1 overflow-x-hidden overflow-y-auto relative ${isExamActive ? "pointer-events-none select-none" : ""}`}
        >
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.label}
              {...item}
              itemRef={item.label === "Courses" ? desktopCoursesRef : undefined}
              active={isExamActive ? false : item.active}
              locked={isExamActive ? true : item.locked}

            />
          ))}
          {/* Frosted overlay shown during exam */}
          {isExamActive && (
            <div className="absolute inset-0 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center px-4">
                Navigation locked during exam
              </span>
            </div>
          )}
          {/* FeedBolt sidebar link */}
          {!isExamActive && (
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <FeedBoltSidebarLink />
            </div>
          )}
        </nav>

        {/* Compact Premium Upgrade Card for non-premium users */}
        {!isPremium && (
          <div className="px-3 py-3 dark:border-slate-800">
            <div className="p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700/70">
                  <FaCrown className="text-amber-600 dark:text-amber-300" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    Go pro
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Unlimited questions, no ads
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPremiumOverlayOpen(true)}
                className="w-full py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
              >
                Upgrade
              </button>
            </div>
          </div>
        )}

        {/* Profile shortcut — also locked during exam */}
        <div
          className={`px-3 py-4 border-t border-gray-100 dark:border-slate-800 ${isExamActive ? "pointer-events-none select-none opacity-40" : ""}`}
        >
          <SidebarNavItem
            label={
              userProfile?.user_name || userProfile?.full_name || "Profile"
            }
            active={isExamActive ? false : profileActive}
            onClick={() => go("/profile")}
            icon={
              <div className="relative shrink-0">
                <Avatar avatarUrl={userProfile?.avatar_url} size="sm" />
                {isPremium && (
                  <div className="absolute -top-2 -right-2 bg-amber-400 dark:bg-yellow-500 rounded-full p-1 border-2 border-white dark:border-slate-900 shadow-sm flex items-center justify-center">
                    <FaCrown className="text-[8px] text-white" />
                  </div>
                )}
              </div>
            }
          />
        </div>
      </aside>

      {/* Desktop floating guide (positioned right outside the sidebar pointing at Courses) */}
      {!isExamActive && showCourseHint && (
        <NewUserCourseHint
          variant="desktop"
          isNew={isNew}
          targetRef={desktopCoursesRef}
          onDismiss={() => setHintDismissed(true)}
        />
      )}

      {/* ── Content area ────────────────────────────────────────────────────── */}
      {/*
        On mobile: no margin, children render as normal.
        On desktop: offset by sidebar width, children expand to fill remaining space.
      */}
      <div className="lg:ml-64 lg:flex-1 desktop-content-wrapper">
        {children}
      </div>

      <ConfirmOverlay
        isOpen={premiumOverlayOpen}
        onClose={() => setPremiumOverlayOpen(false)}
        onConfirm={() => {
          setPremiumOverlayOpen(false);
          navigate("/premium");
        }}
        title="Unlock Premium Features"
        message="Get Premium to save questions for revision, bookmark during exams, and enjoy an ad-free experience."
        confirmText="Get Premium"
        cancelText="Maybe later"
      />
    </div>
  );
};

export default DesktopLayout;
