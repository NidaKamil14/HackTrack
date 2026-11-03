/**
 * Cross-Dashboard Synchronization Service for HackTrack
 * Broadcasts data changes across components and browser tabs/windows.
 */

const SYNC_EVENT = "hacktrack_data_sync";
const SYNC_STORAGE_KEY = "hacktrack_last_sync";

export function triggerDataSync(eventType = "general", payload = null) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify({ eventType, timestamp: Date.now() }));
    } catch {
      // Ignore localStorage errors
    }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { eventType, payload } }));
    window.dispatchEvent(new CustomEvent("hacktrack_notifications_updated"));
  }
}

export function subscribeToDataSync(callback) {
  if (typeof window === "undefined") return () => {};

  const handleCustomSync = (e) => {
    callback(e.detail || { eventType: "general" });
  };

  const handleStorageSync = (e) => {
    if (e.key === SYNC_STORAGE_KEY || (e.key && e.key.startsWith("hacktrack_"))) {
      callback({ eventType: "storage", key: e.key });
    }
  };

  const handleFocus = () => {
    callback({ eventType: "focus" });
  };

  window.addEventListener(SYNC_EVENT, handleCustomSync);
  window.addEventListener("storage", handleStorageSync);
  window.addEventListener("focus", handleFocus);
  const handleVisibility = () => {
    if (document.visibilityState === "visible") {
      callback({ eventType: "visibility" });
    }
  };
  document.addEventListener("visibilitychange", handleVisibility);

  // Heartbeat so dashboards pick up other users' changes from the server.
  // Skipped while the tab is hidden; focus/visibility refresh immediately.
  const intervalId = setInterval(() => {
    if (document.visibilityState === "hidden") return;
    callback({ eventType: "poll" });
  }, 10000);

  return () => {
    window.removeEventListener(SYNC_EVENT, handleCustomSync);
    window.removeEventListener("storage", handleStorageSync);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibility);
    clearInterval(intervalId);
  };
}
