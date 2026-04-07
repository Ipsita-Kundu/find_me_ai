"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { scanLiveCamera } from "@/services/api";
import type { LiveCameraMatch } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function LiveCamPage() {
  const { token } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<LiveCameraMatch[]>([]);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);  const [revealConfirmId, setRevealConfirmId] = useState<string | null>(null);
  const [revealedContactIds, setRevealedContactIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      if (typeof window === "undefined" || !navigator.mediaDevices) {
        setError("Camera access is not available in this browser.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStreamReady(true);
      } catch (err) {
        setError(
          "Unable to access your camera. Please allow camera access or upload a snapshot manually.",
        );
      }
    };

    void startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const buildAssetUrl = (path: string | undefined | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${API_BASE_URL}${path.replace(/\\/g, "/")}`;
  };

  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Could not capture a camera frame."));
          }
        },
        "image/jpeg",
        0.9,
      );
    });
  };

  const handleScan = async (input: Blob) => {
    if (!token) {
      setError("You must be logged in to scan live footage.");
      return;
    }
    setError("");
    setScanLoading(true);
    try {
      const result = await scanLiveCamera(input, token, "Live Camera");
      setMatches(result.matches);
      setScreenshotUrl(buildAssetUrl(result.screenshot_url));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live scan failed.";
      if (message.includes("Not Found")) {
        setError(
          "Live scan endpoint could not be reached. Ensure the backend is running and /admin/webcam-scan is available.",
        );
      } else {
        setError(message);
      }
    } finally {
      setScanLoading(false);
    }
  };

  const handleCaptureClick = async () => {
    setCapturing(true);
    setError("");
    try {
      const frame = await captureFrame();
      if (!frame) {
        setError("Unable to capture the current camera frame.");
        return;
      }
      await handleScan(frame);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture live frame.");
    } finally {
      setCapturing(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setMatches([]);
    setScreenshotUrl(null);
  };

  const handleUploadScan = async () => {
    if (!file) {
      setError("Please choose an image file to scan.");
      return;
    }
    await handleScan(file);
  };

  const matchCards = useMemo(
    () =>
      matches.map((match) => ({
        ...match,
        imageUrl: buildAssetUrl(match.missing_image_path),
        foundImageUrl: buildAssetUrl(match.found_image_path ?? undefined),
      })),
    [matches],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavbar />
      <ProtectedRoute requiredRole="authority">
        <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900">
                  Live Camera Scan
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Capture a live frame and search it against all registered missing person reports.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCaptureClick}
                  disabled={!streamReady || capturing || scanLoading}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-60"
                >
                  {capturing ? "Capturing..." : "Capture from Camera"}
                </button>
                <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-slate-200">
                  Browse Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleUploadScan}
                  disabled={!file || scanLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  Scan Uploaded Image
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4">
                <Toast message={error} tone="error" />
              </div>
            )}

            {screenshotUrl ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800">
                  Live capture screenshot
                </p>
                <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
                  <img
                    src={screenshotUrl}
                    alt="Live camera screenshot"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  This screenshot represents the frame used by the admin scan.
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 text-sm font-semibold text-slate-700">
                  Live Feed Preview
                </div>
                <div className="relative overflow-hidden rounded-3xl bg-black">
                  {streamReady ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex min-h-[280px] items-center justify-center bg-slate-900/90 text-sm text-slate-200">
                      Camera is unavailable.
                    </div>
                  )}
                </div>
                <small className="mt-3 block text-xs text-slate-500">
                  If your camera is blocked, upload a snapshot from a CCTV or mobile phone instead.
                </small>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-4 text-sm font-semibold text-slate-700">
                  Scan Results
                </div>
                {scanLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center">
                    <LoadingSpinner label="Scanning live frame..." />
                  </div>
                ) : matches.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No matching missing person found yet. Try another frame or verify that missing reports have been registered.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {matchCards.map((match) => (
                      <article
                        key={match.missing_id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex gap-4">
                          {match.imageUrl ? (
                            <img
                              src={match.imageUrl}
                              alt={match.missing_name || "Missing person"}
                              className="h-24 w-24 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-200 text-xs text-slate-500">
                              No image
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              {match.missing_name || "Unknown missing person"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Similarity: {(match.similarity * 100).toFixed(1)}%
                            </p>
                              {match.missing_location ? (
                              <p className="mt-2 text-sm text-slate-600">
                                Last seen: {match.missing_location}
                              </p>
                            ) : null}
                            {match.found_location ? (
                              <p className="mt-2 text-sm text-slate-600">
                                Found by admin at: {match.found_location}
                              </p>
                            ) : null}
                            {match.authority_name || match.authority_phone ? (
                              <div className="mt-4 rounded-2xl bg-slate-100 p-3">
                                {revealedContactIds.has(match.missing_id) ? (
                                  <p className="text-sm text-slate-700">
                                    Admin: {match.authority_name ?? "Admin"}
                                    {match.authority_phone ? ` • ${match.authority_phone}` : ""}
                                  </p>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (revealConfirmId !== match.missing_id) {
                                        setRevealConfirmId(match.missing_id);
                                        return;
                                      }
                                      setRevealedContactIds((prev) => new Set(prev).add(match.missing_id));
                                      setRevealConfirmId(null);
                                    }}
                                    className="rounded-full bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-700"
                                  >
                                    {revealConfirmId === match.missing_id
                                      ? "Click again to confirm reveal"
                                      : "Reveal admin contact"}
                                  </button>
                                )}
                              </div>
                            ) : null}
                            {match.missing_age != null || match.missing_gender ? (
                              <p className="mt-2 text-sm text-slate-600">
                                {match.missing_age != null ? `Age: ${match.missing_age}` : ""}
                                {match.missing_age != null && match.missing_gender ? ", " : ""}
                                {match.missing_gender ?? ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </section>
        </main>
      </ProtectedRoute>
    </div>
  );
}
