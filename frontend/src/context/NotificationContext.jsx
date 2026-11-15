import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread
} from "../lib/backend.js";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(false);
  const cursorRef = useRef(null);

  const refresh = useCallback(async ({ append = false, unreadOnly = false, category } = {}) => {
    if (!user || requestRef.current) return;
    requestRef.current = true;
    setError("");
    try {
      const [timeline, count] = await Promise.all([
        listNotifications({ unreadOnly, category, cursor: append ? cursorRef.current : undefined }),
        getUnreadNotificationCount()
      ]);
      setItems((current) => append ? [...current, ...timeline.items.filter((item) => !current.some((old) => old.id === item.id))] : timeline.items);
      setNextCursor(timeline.next_cursor);
      cursorRef.current = timeline.next_cursor;
      setUnreadCount(count);
    } catch (requestError) {
      setError(requestError.message || "Notifications could not be loaded.");
    } finally {
      setLoading(false);
      requestRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setItems([]); setUnreadCount(0); setLoading(false); return undefined; }
    refresh();
    const interval = window.setInterval(() => refresh(), 30000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [user, refresh]);

  const mutateRead = useCallback(async (id, read) => {
    const previous = items;
    setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: read, read_at: read ? new Date().toISOString() : null } : item));
    if (read) setUnreadCount((count) => Math.max(0, count - 1));
    else setUnreadCount((count) => count + 1);
    try { return await (read ? markNotificationRead(id) : markNotificationUnread(id)); }
    catch (requestError) { setItems(previous); setError(requestError.message || "Notification update failed."); await refresh(); throw requestError; }
  }, [items, refresh]);

  const markAllRead = useCallback(async () => {
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at || new Date().toISOString() })));
    setUnreadCount(0);
    try { await markAllNotificationsRead(); }
    catch (requestError) { setItems(previous); setError(requestError.message || "Notifications could not be marked as read."); await refresh(); throw requestError; }
  }, [items, refresh]);

  const value = useMemo(() => ({ items, unreadCount, loading, error, nextCursor, refresh, markRead: (id) => mutateRead(id, true), markUnread: (id) => mutateRead(id, false), markAllRead }), [items, unreadCount, loading, error, nextCursor, refresh, mutateRead, markAllRead]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationProvider");
  return value;
}
