import React, { useState, useMemo, useEffect } from "react";
import {
  FiX,
  FiSearch,
  FiCheck,
  FiSend,
  FiCopy,
  FiDownload,
  FiShare2,
  FiCheckCircle,
  FiMessageSquare,
} from "react-icons/fi";
import { FaCrown } from "react-icons/fa";
import Avatar from "./Avatar";
import QuizResultCard from "./QuizResultCard";
import {
  getMyConnections,
  shareQuizResultToConnections,
} from "../services/messagingService";
import { usePresence } from "../hooks/usePresence";

const QUICK_CAPTIONS = [
  "Think you can beat this? 🔥",
  "Beat my score if you can! 🏆",
  "QuizBolt accuracy on point! ⚡",
  "Challenge accepted? Let's see! 🧠",
];

const ShareResultModal = ({
  isOpen,
  onClose,
  course,
  results,
  questions,
  questionType = "obj",
  timeTaken = 0,
  userProfile = null,
  isPremium = false,
  onExportImage = null, // fallback trigger for toPng
}) => {
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' | 'external'
  const [caption, setCaption] = useState("Think you can beat this? 🔥");
  const [search, setSearch] = useState("");
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null); // { type: 'success'|'error', text: '' }

  const currentUserId = userProfile?.id || null;

  // 1. Calculate accuracy & time
  const totalQuestions = results?.answered || questions?.length || 1;
  const scorePercentage = Math.round(
    ((results?.correct || 0) / totalQuestions) * 100
  );
  const courseId = course?.id || course?.code || "";
  const courseName = course?.name || course?.code || "Course Exam";

  // Build structured payload for QuizBolt chats
  const resultPayload = useMemo(
    () => ({
      _type: "quiz_result_card",
      v: 1,
      courseId,
      courseName,
      scorePercentage,
      correct: results?.correct || 0,
      total: totalQuestions,
      questionType,
      durationSeconds: timeTaken,
      caption: caption.trim() || "Think you can beat this?",
      user: {
        id: currentUserId,
        fullName: userProfile?.full_name || "QuizBolt Scholar",
        username: userProfile?.user_name || "",
        college: userProfile?.college || userProfile?.department || "",
        avatarUrl: userProfile?.avatar_url || "",
        isPremium: Boolean(isPremium),
      },
      timestamp: new Date().toISOString(),
    }),
    [
      courseId,
      courseName,
      scorePercentage,
      results,
      totalQuestions,
      questionType,
      timeTaken,
      caption,
      currentUserId,
      userProfile,
      isPremium,
    ]
  );

  // 2. Fetch connected chats (state === 'accepted')
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    let isMounted = true;
    setLoadingConnections(true);

    getMyConnections(currentUserId)
      .then((list) => {
        if (!isMounted) return;
        // Only accepted connections can be directly shared to
        const accepted = list.filter((c) => c.connectionState === "accepted");
        setConnections(accepted);
      })
      .catch((err) => {
        console.error("Failed to load connections for sharing:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingConnections(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUserId]);

  // Presence hook
  const partnerUserIds = useMemo(
    () => connections.map((c) => c.userId).filter(Boolean),
    [connections]
  );
  const { isOnline } = usePresence(partnerUserIds);

  // 3. Filter connections by search
  const filteredConnections = useMemo(() => {
    if (!search.trim()) return connections;
    const q = search.toLowerCase();
    return connections.filter(
      (c) =>
        c.fullName?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        c.department?.toLowerCase().includes(q)
    );
  }, [connections, search]);

  const toggleSelect = (connId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(connId)) {
        next.delete(connId);
      } else {
        next.add(connId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredConnections.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConnections.map((c) => c.connectionId)));
    }
  };

  // 4. Send Result to Selected QuizBolt Chats
  const handleSendToChats = async () => {
    if (selectedIds.size === 0 || !currentUserId) return;

    setSending(true);
    setStatusFeedback(null);

    const targets = connections
      .filter((c) => selectedIds.has(c.connectionId))
      .map((c) => ({
        connectionId: c.connectionId,
        recipientId: c.userId,
      }));

    try {
      const res = await shareQuizResultToConnections({
        myId: currentUserId,
        connections: targets,
        payload: resultPayload,
      });

      if (res.successCount > 0) {
        setStatusFeedback({
          type: "success",
          text: `Shared successfully to ${res.successCount} scholar${
            res.successCount > 1 ? "s" : ""
          }!`,
        });
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatusFeedback({
          type: "error",
          text: "Could not send to selected scholars. Please check your connection.",
        });
      }
    } catch (err) {
      console.error("Error sharing quiz result:", err);
      setStatusFeedback({
        type: "error",
        text: "Failed to share result. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  // 5. External Sharing Handlers
  const challengeUrl = `https://quizbolt.site/choose-course?course=${encodeURIComponent(
    courseId || courseName
  )}`;

  const getShareText = () =>
    `🎯 I scored ${scorePercentage}% in ${courseName} on QuizBolt!\n"${caption}"\n\nCan you beat my score? Take the challenge:\n${challengeUrl}`;

  // Copy Link / Text
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Main Share API (includes generated result image & caption)
  const handleSystemShare = async () => {
    if (onExportImage) {
      // Delegate to high-res image share
      await onExportImage({
        caption,
        title: `My QuizBolt Result in ${courseName}`,
        text: getShareText(),
        url: challengeUrl,
      });
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `QuizBolt Challenge: ${courseName}`,
          text: getShareText(),
          url: challengeUrl,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("System share error:", err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Direct image download trigger
  const handleDownloadImage = async () => {
    if (onExportImage) {
      await onExportImage({ downloadOnly: true });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85dvh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Share Quiz Result</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider">
                {scorePercentage}%
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-semibold truncate max-w-[280px]">
              {courseName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="size-9 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition active:scale-95 shrink-0"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────── */}
        <div className="px-5 pt-3 shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("chats")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "chats"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750"
            }`}
          >
            <FiMessageSquare size={14} />
            <span>QuizBolt Chats</span>
            {connections.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === "chats"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {connections.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("external")}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === "external"
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750"
            }`}
          >
            <FiShare2 size={14} />
            <span>Share via Apps</span>
          </button>
        </div>

        {/* ── BODY (Scrollable) ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Custom Caption Input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1.5">
              Challenge Caption
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a punchy caption..."
              maxLength={120}
              className="w-full h-10 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
            />
            {/* Quick Caption Chips */}
            <div
              className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 no-scrollbar"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {QUICK_CAPTIONS.map((qc) => (
                <button
                  key={qc}
                  type="button"
                  onClick={() => setCaption(qc)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition border ${
                    caption === qc
                      ? "bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-blue-400/50"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-200"
                  }`}
                >
                  {qc}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback banner */}
          {statusFeedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150 ${
                statusFeedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-500/30"
              }`}
            >
              {statusFeedback.type === "success" && <FiCheckCircle size={16} />}
              <span>{statusFeedback.text}</span>
            </div>
          )}

          {/* ── TAB 1: QUIZBOLT CHATS ────────────────────────────────────── */}
          {activeTab === "chats" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select Connected Scholars
                </span>
                {filteredConnections.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {selectedIds.size === filteredConnections.length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                )}
              </div>

              {/* Scholar search input */}
              {connections.length > 3 && (
                <div className="relative">
                  <FiSearch
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={14}
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search connected scholars..."
                    className="w-full h-9 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/50 text-xs font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* List of Scholars */}
              {loadingConnections ? (
                <div className="py-8 text-center">
                  <div className="size-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-semibold">
                    Loading your connected scholars...
                  </p>
                </div>
              ) : connections.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                  <div className="size-11 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-2.5">
                    <FiMessageSquare size={20} />
                  </div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-white">
                    No Connected Scholars Yet
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    You can connect with scholars in Messages, or share
                    externally with your result image & caption!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("external")}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-xs active:scale-95"
                  >
                    <FiShare2 size={13} />
                    <span>Share Result</span>
                  </button>
                </div>
              ) : filteredConnections.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                  No scholars found matching "{search}"
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-56 overflow-y-auto">
                  {filteredConnections.map((c) => {
                    const isSelected = selectedIds.has(c.connectionId);
                    const online = isOnline(c.userId);

                    return (
                      <div
                        key={c.connectionId}
                        onClick={() => toggleSelect(c.connectionId)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50/70 dark:bg-blue-950/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <Avatar
                              avatarUrl={c.avatarUrl}
                              size="sm"
                              isOnline={online}
                            />
                            {c.isPremium && (
                              <div className="absolute -top-1 -right-1 bg-amber-400 p-0.5 rounded-full border border-white dark:border-slate-900 shadow-xs">
                                <FaCrown className="text-white text-[6px]" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {c.fullName || c.username}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-400 truncate">
                              @{c.username}{" "}
                              {c.department ? `• ${c.department}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={`size-5 rounded-lg flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-transparent"
                          }`}
                        >
                          <FiCheck size={12} className="stroke-[3]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Card preview thumbnail accordion */}
              <div className="pt-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Card Preview
                </span>
                <div className="flex justify-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800">
                  <QuizResultCard
                    data={resultPayload}
                    interactive={false}
                    isMe={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: EXTERNAL & APPS ──────────────────────────────────── */}
          {activeTab === "external" && (
            <div className="space-y-3">
              {/* Action row: Share, Copy, Save */}
              <div className="grid grid-cols-3 gap-2">
                {/* Share */}
                <button
                  type="button"
                  onClick={handleSystemShare}
                  className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200/70 dark:border-blue-800/50 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center gap-2 active:scale-95 transition"
                >
                  <FiShare2 size={20} />
                  <span className="text-[11px] font-bold">Share</span>
                </button>

                {/* Copy Text */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center gap-2 active:scale-95 transition"
                >
                  {copiedLink ? (
                    <FiCheckCircle size={20} className="text-emerald-500" />
                  ) : (
                    <FiCopy size={20} className="text-slate-500" />
                  )}
                  <span className="text-[11px] font-bold">
                    {copiedLink ? "Copied!" : "Copy Text"}
                  </span>
                </button>

                {/* Save Image */}
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center gap-2 active:scale-95 transition"
                >
                  <FiDownload size={20} className="text-slate-500" />
                  <span className="text-[11px] font-bold">Save Image</span>
                </button>
              </div>

              {/* Card preview */}
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Card Preview
                </span>
                <div className="flex justify-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200/60 dark:border-slate-800">
                  <QuizResultCard
                    data={resultPayload}
                    interactive={false}
                    isMe={true}
                  />
                </div>
              </div>

              {/* Challenge text preview */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Message preview
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-medium">
                  {getShareText()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition"
          >
            Cancel
          </button>

          {activeTab === "chats" && (
            <button
              type="button"
              disabled={selectedIds.size === 0 || sending}
              onClick={handleSendToChats}
              className={`flex-1 py-2.5 px-5 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-2 active:scale-98 transition ${
                selectedIds.size === 0 || sending
                  ? "bg-blue-400 opacity-60 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {sending ? (
                <>
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <FiSend size={14} />
                  <span>
                    Send to {selectedIds.size}{" "}
                    {selectedIds.size === 1 ? "Scholar" : "Scholars"}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareResultModal;
