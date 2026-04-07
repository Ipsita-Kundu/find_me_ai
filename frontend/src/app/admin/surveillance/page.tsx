"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { getSurveillanceLiveAlerts, listCameras } from "@/services/api";
import type { CameraFeed, SurveillanceAlert } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function SurveillanceMonitorPage() {
  const { token } = useAuth();
  const { addNotification } = useNotifications();
  const [cameras, setCameras] = useState<CameraFeed[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraStatus, setCameraStatus] = useState<"online" | "offline">("offline");
  const [streaming, setStreaming] = useState(false);
  const [alerts, setAlerts] = useState<SurveillanceAlert[]>([]);
  const [liveMatches, setLiveMatches] = useState<SurveillanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seenAlertIds, setSeenAlertIds] = useState<Set<string>>(new Set());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const buildAssetUrl = (path: string | undefined | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path.replace(/\\/g, "/")}`;
  };

  const loadCameras = useCallback(async () => {
    if (!token) return;
    try {
      const cams = await listCameras(token);
      setCameras(cams);
      if (cams.length > 0 && !selectedCameraId) {
        const firstOnline = cams.find((c) => c.status === "online") || cams[0];
        if (firstOnline) {
          setSelectedCameraId(firstOnline.id);
          setCameraStatus(firstOnline.status);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cameras.");
    } finally {
      setLoading(false);
    }
  }, [token, selectedCameraId]);

  const loadSurveillanceAlerts = useCallback(async () => {
    if (!token) return;
    try {
      const liveAlerts = await getSurveillanceLiveAlerts(token, selectedCameraId, 100);
      setAlerts(liveAlerts);
      const recent = liveAlerts.slice(0, 10);
      setLiveMatches(recent);

      // Push new alerts to notification context
      liveAlerts.forEach((alert) => {
        if (!seenAlertIds.has(alert.id)) {
          addNotification(alert);
          setSeenAlertIds((prev) => new Set([...prev, alert.id]));
        }
      });
    } catch {
      // silently fail on polling
    }
  }, [token, selectedCameraId, addNotification, seenAlertIds]);

  useEffect(() => {
    void loadCameras();
  }, [loadCameras]);

  useEffect(() => {
    if (!streaming) return;

    void loadSurveillanceAlerts();
    pollIntervalRef.current = setInterval(() => {
      void loadSurveillanceAlerts();
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [streaming, loadSurveillanceAlerts]);

  const handleCameraChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const cameraId = event.target.value;
    const camera = cameras.find((c) => c.id === cameraId);
    if (camera) {
      setSelectedCameraId(cameraId);
      setCameraStatus(camera.status);
      setLiveMatches([]);
    }
  };

  const handleStartCamera = () => {
    if (cameraStatus === "offline") {
      setError("Selected camera is offline. Please choose an active camera.");
      return;
    }
    setStreaming(true);
    setError("");
  };

  const handleStopCamera = () => {
    setStreaming(false);
    setLiveMatches([]);
  };

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <AppNavbar />
      <ProtectedRoute requiredRole="authority">
        <main className="mx-auto w-full max-w-full px-4 py-6 md:px-8">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                LIVE SURVEILLANCE
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Monitor cameras and track missing person detections in real-time.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    cameraStatus === "online"
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-red-500"
                  }`}
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {cameraStatus === "online" ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="flex items-center gap-3">
              <label htmlFor="camera-select" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Camera:
              </label>
              <select
                id="camera-select"
                value={selectedCameraId}
                onChange={handleCameraChange}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.id} — {cam.name}
                  </option>
                ))}
              </select>
            </div>
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <Toast message={error} tone="error" />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
            {/* Left: Camera Feed & Start Button */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="relative overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-950 aspect-video min-h-[320px]">
                  {loading ? (
                    <div className="flex h-full items-center justify-center bg-slate-100 dark:bg-slate-950">
                      <LoadingSpinner label="Loading cameras..." />
                    </div>
                  ) : streaming ? (
                    <>
                      <div className="relative flex h-full items-center justify-center bg-slate-100 dark:bg-slate-950">
                        <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg">
                          Live
                        </div>
                        <div className="text-center">
                          <svg
                            className="mx-auto mb-3 h-16 w-16 text-slate-600 animate-pulse"
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
                          <p className="text-sm text-slate-400">
                            {selectedCamera?.name} — {selectedCamera?.location}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            24/7 Surveillance Active
                          </p>
                        </div>
                      </div>
                      <video ref={videoRef} className="hidden" />
                      <canvas ref={canvasRef} className="hidden" />
                    </>
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
                      <div className="text-center">
                        <svg
                          className="mx-auto mb-3 h-16 w-16 text-slate-600"
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
                        <p className="text-sm text-slate-400">
                          Camera feed offline
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={streaming ? handleStopCamera : handleStartCamera}
                disabled={cameraStatus === "offline" && !streaming}
                className={`w-full rounded-xl px-4 py-3 font-bold transition ${
                  streaming
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50"
                }`}
              >
                {streaming ? "Stop Camera" : "Start Camera"}
              </button>
            </div>

            {/* Right: Matches & Alerts */}
            <div className="space-y-4">
              {/* Live Matches */}
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-slate-300">
                  Live Matches
                </h3>
                {!streaming ? (
                  <p className="text-xs text-slate-500">
                    Start a camera feed to see live matches.
                  </p>
                ) : liveMatches.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No matches detected yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {liveMatches.map((match) => (
                      <article
                        key={match.id}
                        className="rounded-2xl border border-slate-200 bg-slate-100 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                      >
                        <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                          Match Alert
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {match.missing_name || "Unknown"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          Similarity: {((match.similarity ?? 0) * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(match.timestamp).toLocaleTimeString()}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* Alert Log */}
              <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-slate-300">
                  Alert Log
                </h3>
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No alerts yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-950"
                      >
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="mt-1 text-slate-600 dark:text-slate-400">
                          {alert.missing_name} ({((alert.similarity ?? 0) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </ProtectedRoute>
    </div>
  );
}
