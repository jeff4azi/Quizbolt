import { useState, useEffect, useCallback } from "react";
import {
  getConversations,
  getConversationByUsername,
  getConnectionState,
  sendMessage as sendMsg,
  acceptRequest as acceptReq,
  declineRequest as declineReq,
  blockUser as blockUsr,
  markConversationAsRead as markAsReadFn,
  getTotalUnreadCount,
  subscribeToMessaging,
  simulateAccept as simAccept,
  simulateReply as simReply,
  simulateIncomingRequest as simIncoming,
  resetDemoMessaging as resetDemo,
} from "../mock/messaging";

export const useMessaging = (username = null) => {
  const [conversations, setConversations] = useState(() => getConversations());
  const [totalUnreadCount, setTotalUnreadCount] = useState(() =>
    getTotalUnreadCount()
  );
  const [currentConv, setCurrentConv] = useState(() =>
    username ? getConversationByUsername(username) : null
  );

  useEffect(() => {
    const sync = () => {
      setConversations(getConversations());
      setTotalUnreadCount(getTotalUnreadCount());
      if (username) {
        setCurrentConv(getConversationByUsername(username));
      }
    };

    sync();
    const unsubscribe = subscribeToMessaging(sync);
    return () => unsubscribe();
  }, [username]);

  const connectionState = username
    ? currentConv?.connectionState || getConnectionState(username)
    : "none";

  const sendMessage = useCallback(
    (text) => {
      if (!username) return null;
      return sendMsg(currentConv || username, text);
    },
    [username, currentConv]
  );

  const accept = useCallback(() => {
    if (!username) return;
    acceptReq(username);
  }, [username]);

  const decline = useCallback(() => {
    if (!username) return;
    declineReq(username);
  }, [username]);

  const block = useCallback(() => {
    if (!username) return;
    blockUsr(username);
  }, [username]);

  return {
    conversations,
    totalUnreadCount,
    currentConv,
    connectionState,
    sendMessage,
    accept,
    decline,
    block,
    markAsRead: useCallback(() => {
      if (username) markAsReadFn(username);
    }, [username]),
    simulateAccept: () => simAccept(username),
    simulateReply: (text) => simReply(username, text),
    simulateIncomingRequest: (user, msg) => simIncoming(user, msg),
    resetDemo,
  };
};

export default useMessaging;
