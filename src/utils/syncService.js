/**
 * Cross-Dashboard Synchronization Service for HackTrack
 * Broadcasts data changes across components and browser tabs/windows with zero latency.
 */

const SYNC_EVENT = "hacktrack_data_sync";
const SYNC_STORAGE_KEY = "hacktrack_last_sync";
const CHANNEL_NAME = "hacktrack_sync_channel";

let broadcastChannel = null;
if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    broadcastChannel = null;
  }
}

export function triggerDataSync(eventType = "general", payload = null) {
  if (typeof window !== "undefined") {
    const detail = {
      eventType,
      payload,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).slice(2, 8),
    };

    // 1. Instant cross-tab broadcast via BroadcastChannel (< 5ms)
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(detail);
      } catch {
        // Fallback to storage event
      }
    }

    // 2. Storage event fallback for cross-tab sync
    try {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(detail));
    } catch {
      // Ignore localStorage errors
    }

    // 3. Same-window custom event dispatch
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
    window.dispatchEvent(new CustomEvent("hacktrack_notifications_updated", { detail }));
  }
}

export function subscribeToDataSync(callback) {
  if (typeof window === "undefined") return () => {};

  const handleBroadcast = (event) => {
    callback(event.data || { eventType: "broadcast" });
  };

  const handleCustomSync = (e) => {
    callback(e.detail || { eventType: "general" });
  };

  const handleStorageSync = (e) => {
    if (e.key === SYNC_STORAGE_KEY || (e.key && e.key.startsWith("hacktrack_"))) {
      let parsed = null;
      try {
        parsed = e.newValue ? JSON.parse(e.newValue) : null;
      } catch {
        parsed = null;
      }
      callback({ eventType: parsed?.eventType || "storage", key: e.key, payload: parsed?.payload });
    }
  };

  const handleFocus = () => {
    callback({ eventType: "focus" });
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      callback({ eventType: "visibility" });
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener("message", handleBroadcast);
  }
  window.addEventListener(SYNC_EVENT, handleCustomSync);
  window.addEventListener("storage", handleStorageSync);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Fast heartbeat interval (2.5s) to guarantee background sync if events are missed
  const intervalId = setInterval(() => {
    callback({ eventType: "poll" });
  }, 2500);

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener(SYNC_EVENT, handleCustomSync);
    window.removeEventListener("storage", handleStorageSync);
    window.removeEventListener("focus", handleFocus);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    clearInterval(intervalId);
  };
}
