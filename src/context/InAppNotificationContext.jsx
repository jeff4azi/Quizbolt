import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useMessaging } from "../hooks/useMessaging";
import InAppMessageToast from "../components/InAppMessageToast";

const InAppNotificationContext = createContext();

const STORAGE_KEY = "quizbolt_in_app_message_popups";

// Routes where study, exam, or intense gameplay occurs — popup notifications are suppressed
const STUDY_ROUTES = [
  "/exam",
  "/test",
  "/flashcards",
  "/match",
  "/match-result",
  "/test-result",
  "/results",
  "/review-answers",
];

export const InAppNotificationProvider = ({ children }) => {
  const location = useLocation();
  const pathname = location?.pathname || "/";

  // Check if current page is any study-related screen
  const isStudyRoute = STUDY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Detect if user is currently inside a specific chat conversation
  const chatMatch = pathname.match(/^\/messages\/([^/?#]+)/);
  const activeChatPartner = chatMatch
    ? decodeURIComponent(chatMatch[1]).toLowerCase()
    : null;

  // Setting: in-app message popups enabled/disabled
  const [inAppPopupsEnabled, setInAppPopupsEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleInAppPopups = useCallback(() => {
    setInAppPopupsEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const { conversations, currentUserId } = useMessaging();
  const [currentToast, setCurrentToast] = useState(null);
  const [deferredQueue, setDeferredQueue] = useState([]);

  // Ref to track seen message IDs and connection IDs to avoid duplicate toasts
  const seenIdsRef = useRef(new Set());
  const initialLoadHandledRef = useRef(false);
  const wasInStudyRef = useRef(isStudyRoute);

  // 1. Process incoming messages from conversations
  useEffect(() => {
    if (!conversations || conversations.length === 0 || !currentUserId) return;

    // Filter unread conversations or connection requests received
    const unreadConvs = conversations.filter((c) => {
      if (c.isRequester) return false;
      return (
        c.unread === true ||
        c.unreadCount > 0 ||
        c.connectionState === "request_received"
      );
    });

    if (unreadConvs.length === 0) {
      initialLoadHandledRef.current = true;
      return;
    }

    // A. Handle Initial Load: surface the latest unread message on login if not in study mode
    if (!initialLoadHandledRef.current) {
      initialLoadHandledRef.current = true;

      // Seed all existing unread messages into seenIds so we don't spam for every old message
      unreadConvs.forEach((c) => {
        (c.messages || []).forEach((m) => seenIdsRef.current.add(m.id));
        if (c.connectionId) {
          seenIdsRef.current.add(`req_${c.connectionId}`);
        }
      });

      // Show the most recent one if popups enabled and not on study screen
      if (inAppPopupsEnabled && !isStudyRoute) {
        const topUnread = unreadConvs[0];
        const isRequest = topUnread.connectionState === "request_received";
        const topMsgs = topUnread.messages || [];
        const lastMsg = topMsgs[topMsgs.length - 1];

        // Don't show if user is currently inside this chat
        if (topUnread.username?.toLowerCase() !== activeChatPartner) {
          const toastData = {
            id: lastMsg?.id || `init_${topUnread.connectionId}`,
            username: topUnread.username,
            fullName: topUnread.fullName,
            avatarUrl: topUnread.avatarUrl,
            isPremium: topUnread.isPremium,
            isRequest,
            text:
              lastMsg?.text ||
              (isRequest
                ? "Sent you a message request"
                : "Sent you a message"),
            time: "Just now",
            extraCount: topUnread.unreadCount > 1 ? topUnread.unreadCount - 1 : 0,
          };

          // Delay slightly on initial app load for smooth UX
          const timer = setTimeout(() => {
            setCurrentToast(toastData);
          }, 1200);

          return () => clearTimeout(timer);
        }
      }
      return;
    }

    // B. Handle New Messages received while browsing
    if (!inAppPopupsEnabled) return;

    for (const conv of unreadConvs) {
      const isRequest = conv.connectionState === "request_received";
      const incomingMsgs = (conv.messages || []).filter(
        (m) => m.sender === "them" || m.senderId !== currentUserId
      );
      const lastMsg = incomingMsgs[incomingMsgs.length - 1];

      // Identify whether this message or request is new
      const targetId = lastMsg?.id || (isRequest ? `req_${conv.connectionId}` : null);
      if (!targetId || seenIdsRef.current.has(targetId)) {
        continue;
      }

      // Mark as seen so it only triggers once
      seenIdsRef.current.add(targetId);

      // If user is actively chatting with this person, suppress toast
      if (conv.username?.toLowerCase() === activeChatPartner) {
        continue;
      }

      const newToast = {
        id: targetId,
        username: conv.username,
        fullName: conv.fullName,
        avatarUrl: conv.avatarUrl,
        isPremium: conv.isPremium,
        isRequest,
        text:
          lastMsg?.text ||
          (isRequest ? "Sent you a message request" : "Sent you a message"),
        time: "Just now",
        extraCount: conv.unreadCount > 1 ? conv.unreadCount - 1 : 0,
      };

      if (isStudyRoute) {
        // Queue notification to display after studying
        setDeferredQueue((prev) => {
          // Keep only the latest notification per user in the queue
          const filtered = prev.filter((item) => item.username !== conv.username);
          return [...filtered, newToast];
        });
      } else {
        // Show immediately
        setCurrentToast(newToast);
      }
    }
  }, [
    conversations,
    currentUserId,
    inAppPopupsEnabled,
    isStudyRoute,
    activeChatPartner,
  ]);

  // 2. When leaving a study route, flush deferred notifications
  useEffect(() => {
    const wasInStudy = wasInStudyRef.current;
    wasInStudyRef.current = isStudyRoute;

    if (wasInStudy && !isStudyRoute && deferredQueue.length > 0 && inAppPopupsEnabled) {
      // Gently delay so the page transition completes first
      const timer = setTimeout(() => {
        setDeferredQueue((prev) => {
          if (prev.length === 0) return prev;
          const nextToast = prev[prev.length - 1]; // latest notification
          const remainingCount = prev.length - 1;
          setCurrentToast({
            ...nextToast,
            extraCount: nextToast.extraCount + remainingCount,
          });
          return [];
        });
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [isStudyRoute, deferredQueue, inAppPopupsEnabled]);

  const dismissToast = useCallback(() => {
    setCurrentToast(null);
  }, []);

  return (
    <InAppNotificationContext.Provider
      value={{
        inAppPopupsEnabled,
        toggleInAppPopups,
        currentToast,
        dismissToast,
      }}
    >
      {children}

      {/* Mount toast globally via Portal so it sits above all page layouts */}
      {currentToast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed top-4 inset-x-4 max-w-sm mx-auto sm:max-w-none sm:top-5 sm:right-6 sm:inset-x-auto sm:w-96 z-[150] pointer-events-auto">
            <InAppMessageToast
              notification={currentToast}
              onDismiss={dismissToast}
              duration={5000}
            />
          </div>,
          document.body
        )}
    </InAppNotificationContext.Provider>
  );
};

export const useInAppNotifications = () => {
  const context = useContext(InAppNotificationContext);
  if (!context) {
    throw new Error(
      "useInAppNotifications must be used within an InAppNotificationProvider"
    );
  }
  return context;
};

export default InAppNotificationContext;
