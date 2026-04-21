"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Shows a sticky banner at the top when the user loses internet connectivity.
 * Also listens for service worker messages about queued offline entries.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [syncPending, setSyncPending] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for service worker messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "OFFLINE_ENTRY_QUEUED") {
          setSyncPending(true);
        }
        if (event.data.type === "SYNC_COMPLETE") {
          setSyncPending(false);
        }
      });

      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("SW registration failed:", err));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline && !syncPending) return null;

  return (
    <div className="offline-banner flex items-center justify-center gap-2">
      <WifiOff className="h-4 w-4" />
      {isOffline
        ? "You're offline — log entries will sync when connected"
        : "Syncing queued entries..."}
    </div>
  );
}
