"use client";

import { useNotifications } from "@/context/NotificationContext";

export default function LiveAlertBanner() {
  const { notifications, dismissNotification, dismissAll, unreadCount } = useNotifications();
  const visibleAlerts = notifications.filter((n) => !n.dismissed).slice(0, 3);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-b-2 border-red-600 shadow-2xl">
      <div className="mx-auto max-w-full px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-3">
            <div className="mt-1 flex h-3 w-3 shrink-0 rounded-full bg-red-300 animate-pulse" />
            <div className="flex-1 space-y-2">
              {visibleAlerts.map((alert) => (
                <div key={alert.displayId} className="text-sm">
                  <p className="font-bold text-red-100">
                    🚨 SURVEILLANCE ALERT
                  </p>
                  <p className="mt-1 text-red-50">
                    <span className="font-semibold">{alert.missing_name || "Unknown Person"}</span>{" "}
                    detected on{" "}
                    <span className="font-semibold">{alert.camera_name || "Camera"}</span> —{" "}
                    <span className="text-red-200">
                      {((alert.similarity ?? 0) * 100).toFixed(1)}% match
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unreadCount > 3 && (
              <span className="inline-flex items-center rounded-full bg-red-700 px-2.5 py-0.5 text-xs font-bold text-red-100">
                +{unreadCount - 3} more
              </span>
            )}
            <button
              type="button"
              onClick={dismissAll}
              className="rounded px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-700/50"
            >
              Dismiss All
            </button>
            {visibleAlerts.length > 0 && (
              <button
                type="button"
                onClick={() => dismissNotification(visibleAlerts[0].displayId)}
                className="rounded-full p-1 text-red-100 transition hover:bg-red-700/50"
                aria-label="Close alert"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
