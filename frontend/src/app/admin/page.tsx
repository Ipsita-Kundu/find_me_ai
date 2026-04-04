"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAlerts,
  fetchFoundReports,
  fetchMissingReports,
  resetDatabase,
} from "@/services/api";

const statusStyles = {
  Pending: "bg-amber-100 text-amber-800",
  Matched: "bg-emerald-100 text-emerald-800",
  Closed: "bg-slate-200 text-slate-700",
};

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missingReports, setMissingReports] = useState<
    Awaited<ReturnType<typeof fetchMissingReports>>
  >([]);
  const [foundReports, setFoundReports] = useState<
    Awaited<ReturnType<typeof fetchFoundReports>>
  >([]);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof fetchAlerts>>>(
    [],
  );
  const [resetting, setResetting] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const loadAdminData = useCallback(
    async (silent = false) => {
      if (!token) {
        setError("Authentication required. Please login again.");
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const [missing, found, alertsData] = await Promise.all([
          fetchMissingReports(token),
          fetchFoundReports(token),
          fetchAlerts(token),
        ]);
        setMissingReports(missing);
        setFoundReports(found);
        setAlerts(alertsData);
      } catch (loadError) {
        if (!silent) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : "Failed to load admin data.";
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // Initial load + poll every 10s
  useEffect(() => {
    void loadAdminData();
    const interval = setInterval(() => void loadAdminData(true), 10_000);
    return () => clearInterval(interval);
  }, [loadAdminData]);

  const handleReset = async () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    if (!token) return;
    setResetting(true);
    try {
      await resetDatabase(token);
      setMissingReports([]);
      setFoundReports([]);
      setAlerts([]);
      setResetConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset.");
    } finally {
      setResetting(false);
    }
  };

  const adminCases = useMemo(() => {
    const missingCases = missingReports.map((item) => ({
      id: item._id,
      title: item.name
        ? `${item.name} Case`
        : `Missing Case ${item._id.slice(-6)}`,
      status: "Pending" as const,
      mediaType: "image" as const,
    }));

    const foundCases = foundReports.map((item) => ({
      id: item._id,
      title: item.found_location
        ? `Found at ${item.found_location}`
        : `Found Case ${item._id.slice(-6)}`,
      status: "Matched" as const,
      mediaType: "video" as const,
    }));

    return [...missingCases, ...foundCases];
  }, [foundReports, missingReports]);

  const alertCards = useMemo(
    () =>
      alerts.map((item) => ({
        id: item._id,
        confidence: Number(((item.similarity ?? 0) * 100).toFixed(1)),
        faceScore: Number(((item.scoring?.face_score ?? 0) * 100).toFixed(1)),
        metadataScore: Number(
          ((item.scoring?.metadata_score ?? 0) * 100).toFixed(1),
        ),
        location: "AI matching event",
        contactInfo: `Missing ID: ${item.missing_id} | Found ID: ${item.found_id}`,
      })),
    [alerts],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNavbar />
      <ProtectedRoute requiredRole="authority">
        <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
          <section className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900">
              Admin & Legal Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Monitor case evidence feeds, active alerts, and legal workflow
              statuses.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetting}
                className={`rounded-lg px-4 py-2 text-xs font-bold shadow transition ${
                  resetConfirm
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-white border border-red-300 text-red-600 hover:bg-red-50"
                } disabled:opacity-60`}
              >
                {resetting
                  ? "Resetting..."
                  : resetConfirm
                    ? "Click again to confirm reset"
                    : "Reset Database"}
              </button>
              {resetConfirm && (
                <button
                  type="button"
                  onClick={() => setResetConfirm(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              )}
            </div>
            {error ? (
              <div className="mt-4">
                <Toast message={error} tone="error" />
              </div>
            ) : null}
          </section>

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <LoadingSpinner label="Loading admin dashboard..." />
            </div>
          ) : (
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.6fr]">
              <div className="space-y-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Evidence Streams
                  </h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {adminCases.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="mb-3 flex h-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-sm text-slate-500">
                          {item.mediaType === "video"
                            ? "Video Feed Placeholder"
                            : "Image Placeholder"}
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Case ID: {item.id}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-slate-900">
                    Case Status
                  </h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600">
                          <th className="pb-2">Case</th>
                          <th className="pb-2">Media</th>
                          <th className="pb-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminCases.map((item) => (
                          <tr
                            key={`${item.id}-row`}
                            className="border-b border-slate-100"
                          >
                            <td className="py-3 font-medium text-slate-800">
                              {item.title}
                            </td>
                            <td className="py-3 capitalize text-slate-600">
                              {item.mediaType}
                            </td>
                            <td className="py-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[item.status]}`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Alerts Panel
                </h2>
                <div className="mt-4 space-y-3">
                  {alertCards.map((alert) => (
                    <div
                      key={`admin-${alert.id}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50 p-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                        Alert
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        Confidence: {alert.confidence.toFixed(1)}%
                      </p>
                      <p className="text-xs text-slate-600">
                        Face: {alert.faceScore.toFixed(1)}% | Metadata:{" "}
                        {alert.metadataScore.toFixed(1)}%
                      </p>
                      <p className="text-sm text-slate-700">{alert.location}</p>
                      <p className="text-xs text-slate-600">
                        Contact: {alert.contactInfo}
                      </p>
                    </div>
                  ))}
                </div>
              </aside>
            </section>
          )}
        </main>
      </ProtectedRoute>
    </div>
  );
}
