import React, { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
} from "react-icons/io5";
import NewUserCourseHint, { isNewUserHintVisible } from "./NewUserCourseHint";

const isActivePath = (pathname, target) => {
  if (!pathname) return false;
  if (target === "/") return pathname === "/";
  return pathname === target || pathname.startsWith(`${target}/`);
};

// ── Mobile bottom-bar item ──────────────────────────────────────────────────
const MobileNavItem = ({ label, icon, active, onClick, itemRef }) => (
  <button
    ref={itemRef}
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center flex-1 text-xs font-semibold transition-colors ${
      active
        ? "text-blue-600 dark:text-blue-400"
        : "text-slate-500 dark:text-slate-300"
    }`}
    aria-current={active ? "page" : undefined}
  >
    <div
      className={`relative size-9 rounded-2xl flex items-center justify-center transition-all ${
        active ? "bg-blue-50 dark:bg-blue-900/20" : "bg-transparent"
      }`}
    >
      {icon}
    </div>
    <span>{label}</span>
  </button>
);

// ── Desktop sidebar item ────────────────────────────────────────────────────
const SidebarNavItem = ({ label, icon, active, onClick, badge, itemRef }) => (
  <button
    ref={itemRef}
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
      active
        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
        : "text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200"
    }`}
    aria-current={active ? "page" : undefined}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative shrink-0 size-9 flex items-center justify-center w-[40px]">
        {icon}
      </div>
      <span className="truncate">{label}</span>
    </div>
    {badge != null && badge > 0 && (
      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black shrink-0 shadow-sm animate-pulse">
        {badge}
      </span>
    )}
  </button>
);

const NavBar = ({ isPremium, onLockedClick, isNew }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname || "/";
  const coursesRef = useRef(null);

  const [hintDismissed, setHintDismissed] = useState(false);
  const showCourseHint =
    isNewUserHintVisible(isNew) &&
    !hintDismissed &&
    pathname !== "/choose-course";

  const go = (path) => navigate(path);

  const handleSavedClick = () => {
    go("/bookmarks");
  };

  const homeActive = isActivePath(pathname, "/");
  const coursesActive = isActivePath(pathname, "/choose-course");
  const historyActive = isActivePath(pathname, "/history");
  const savedActive = isActivePath(pathname, "/bookmarks");
  const leadersActive = isActivePath(pathname, "/leaderboard");

  const navItems = [
    {
      label: "Home",
      active: homeActive,
      onClick: () => go("/"),
      icon: homeActive ? <IoHome size={22} /> : <IoHomeOutline size={22} />,
    },
    {
      label: "Courses",
      active: coursesActive,
      onClick: () => go("/choose-course"),
      icon: coursesActive ? (
        <IoLibrary size={22} />
      ) : (
        <IoLibraryOutline size={22} />
      ),
    },
    {
      label: "History",
      active: historyActive,
      onClick: () => go("/history"),
      icon: historyActive ? <IoTime size={22} /> : <IoTimeOutline size={22} />,
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
      label: "Leaders",
      active: leadersActive,
      onClick: () => go("/leaderboard"),
      icon: leadersActive ? (
        <IoTrophy size={18} />
      ) : (
        <IoTrophyOutline size={18} />
      ),
    },
  ];

  return (
    <>
      {/* ── Mobile bottom bar (hidden on lg+) ─────────────────────────────── */}
      <div className="lg:hidden mx-auto max-w-2xl fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent dark:from-slate-900 dark:via-slate-900/90">
        {showCourseHint && (
          <NewUserCourseHint
            variant="mobile"
            isNew={isNew}
            targetRef={coursesRef}
            onDismiss={() => setHintDismissed(true)}
          />
        )}
        <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-gray-300 dark:border-slate-700 px-4 pt-3 pb-4 flex items-center justify-between mx-4 mb-4 rounded-2xl">
          {navItems.map((item) => (
            <MobileNavItem
              key={item.label}
              {...item}
              itemRef={item.label === "Courses" ? coursesRef : undefined}
            />
          ))}
        </div>
      </div>

      {/* ── Desktop sidebar (hidden below lg, rendered via DesktopLayout) ─── */}
      {/* This empty fragment keeps the component self-contained;
          the actual sidebar is rendered by DesktopLayout in App.jsx */}
    </>
  );
};

export { NavBar as default, SidebarNavItem, isActivePath };
