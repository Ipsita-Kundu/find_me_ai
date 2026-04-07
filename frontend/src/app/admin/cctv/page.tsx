"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { getSurveillanceLiveAlerts, listCameras } from "@/services/api";
import type { CameraFeed, SurveillanceAlert } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function CctcDashboardPage() {
  const { token } = useAuth();
  const { unreadCount, addNotification } = useNotifications();
  const [cameras, setCameras] = useState<CameraFeed[]>([]);
  const [alerts, setAlerts] = useState<SurveillanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [seenAlertIds, setSeenAlertIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [cams, liveAlerts] = await Promise.all([
        listCameras(token),
        getSurveillanceLiveAlerts(token, undefined, 100),
      ]);
      setCameras(cams);
      setAlerts(liveAlerts);

      // Push new alerts to notification context
      liveAlerts.forEach((alert) => {
        if (!seenAlertIds.has(alert.id)) {
          addNotification(alert);
          setSeenAlertIds((prev) => new Set([...prev, alert.id]));
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [token, addNotification, seenAlertIds]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadData();
    }, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const onlineCount = cameras.filter((c) => c.status === "online").length;
  const recentAlerts = alerts.slice(0, 15);
  const alertsByCamera = alerts.reduce(
    (acc, alert) => {
      const cameraName = alert.camera_name || "Unknown";
      acc[cameraName] = (acc[cameraName] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppNavbar />
      <ProtectedRoute requiredRole="authority">
        <main className="mx-auto w-full max-w-full px-4 py-6 md:px-8">
          {/* Header */}
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                CCTV CONTROL CENTER
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Real-time surveillance dashboard with unified alert management.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Refresh</span>
              </label>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              >
                Refresh Now
              </button>
              <Link
                href="/admin/surveillance"
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                Single View
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <Toast message={error} tone="error" />
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <LoadingSpinner label="Loading CCTV dashboard..." />
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
              {/* Main: Camera Grid */}
              <div className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Cameras Online
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-emerald-400">
                      {onlineCount}/{cameras.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Total Alerts
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-amber-400">
                      {alerts.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Unread
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-red-400">
                      {unreadCount}
                    </p>
                  </div>
                </div>

                {/* Camera Grid */}
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                  <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
                    Active Camera Feeds
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cameras.length === 0 ? (
                      <p className="col-span-full text-slate-500">No cameras registered.</p>
                    ) : (
                      cameras.map((camera) => (
                        <div
                          key={camera.id}
                          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <div className="relative aspect-[16/9] bg-gradient-to-br from-slate-800 to-slate-950">
                            <div className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-950 shadow-sm">
                              {camera.status === "online" ? "Live" : "Offline"}
                            </div>
                            <div className="flex h-full items-center justify-center">
                              <svg
                                className="h-12 w-12 text-slate-600 group-hover:text-slate-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <div className="absolute top-2 right-2">
                              <div
                                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${
                                  camera.status === "online"
                                    ? "bg-emerald-900/80 text-emerald-300"
                                    : "bg-red-900/80 text-red-300"
                                }`}
                              >
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                    camera.status === "online" ? "bg-emerald-400" : "bg-red-400"
                                  }`}
                                />
                                {camera.status === "online" ? "LIVE" : "OFFLINE"}
                              </div>
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="font-bold text-slate-100">{camera.name}</p>
                            <p className="text-xs text-slate-400">{camera.location}</p>
                            {alertsByCamera[camera.name] ? (
                              <p className="mt-2 text-xs font-semibold text-amber-400">
                                {alertsByCamera[camera.name]} alert
                                {alertsByCamera[camera.name] > 1 ? "s" : ""}
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500">No recent alerts</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Alert Sidebar */}
              <div className="space-y-4">
                {/* Alert Stats */}
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-slate-300">
                    Alerts by Camera
                  </h3>
                  {Object.entries(alertsByCamera).length === 0 ? (
                    <p className="text-xs text-slate-500">No alerts yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(alertsByCamera)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cameraName, count]) => (
                          <div key={cameraName} className="flex items-center justify-between">
                            <p className="text-xs text-slate-400">{cameraName}</p>
                            <span className="rounded-full bg-amber-900/50 px-2 py-1 text-xs font-bold text-amber-300">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Recent Alerts */}
                <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-slate-300">
                    Recent Alerts
                  </h3>
                  {recentAlerts.length === 0 ? (
                    <p className="text-xs text-slate-500">No alerts yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {recentAlerts.map((alert) => (
                        <article
                          key={alert.id}
                          className="border-l-2 border-amber-600/50 bg-slate-100 text-slate-900 px-3 py-2.5 rounded shadow-sm dark:border-amber-500/40 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-xs font-bold text-amber-400">
                                {new Date(alert.timestamp).toLocaleTimeString()}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-200">
                                {alert.missing_name || "Unknown"}
                              </p>
                              <p className="text-xs text-slate-400">
                                {alert.camera_name || "Unknown Camera"}
                              </p>
                            </div>
                            <span className="ml-2 rounded bg-amber-900/60 px-2 py-1 text-xs font-bold text-amber-300">
                              {((alert.similarity ?? 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </ProtectedRoute>
    </div>
  );
}
