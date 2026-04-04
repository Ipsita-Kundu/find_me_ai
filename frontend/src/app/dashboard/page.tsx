"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import {
  deleteMissingReport,
  deleteFoundReport,
  fetchMyAlerts,
  fetchMyFoundReports,
  fetchMyMissingReports,
} from "@/services/api";

export default function DashboardPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [missingReports, setMissingReports] = useState<
    Awaited<ReturnType<typeof fetchMyMissingReports>>
  >([]);
  const [foundReports, setFoundReports] = useState<
    Awaited<ReturnType<typeof fetchMyFoundReports>>
  >([]);
  const [userAlerts, setUserAlerts] = useState<
    Awaited<ReturnType<typeof fetchMyAlerts>>
  >([]);

  // Delete state (missing)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Delete state (found)
  const [deletingFoundId, setDeletingFoundId] = useState<string | null>(null);
  const [deleteFoundConfirmId, setDeleteFoundConfirmId] = useState<
    string | null
  >(null);

  const loadData = useCallback(
    async (mode: "initial" | "manual" | "silent" = "initial") => {
      if (!token) {
        setError("Authentication required. Please login again.");
        setLoading(false);
        return;
      }
      if (mode === "manual") setRefreshing(true);
      else if (mode === "initial") setLoading(true);
      if (mode !== "silent") setError("");
      try {
        const [missing, found, alerts] = await Promise.all([
          fetchMyMissingReports(token),
          fetchMyFoundReports(token),
          fetchMyAlerts(token),
        ]);
        setMissingReports(missing);
        setFoundReports(found);
        setUserAlerts(alerts);
      } catch (err) {
        if (mode !== "silent")
          setError(err instanceof Error ? err.message : "Failed to load data.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  // Initial load + poll every 5s for real-time updates
  useEffect(() => {
    void loadData("initial");
    const interval = setInterval(() => void loadData("silent"), 5_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDelete = async (reportId: string) => {
    if (deleteConfirmId !== reportId) {
      setDeleteConfirmId(reportId);
      return;
    }
    if (!token) return;
    setDeletingId(reportId);
    try {
      await deleteMissingReport(reportId, token);
      setMissingReports((prev) => prev.filter((r) => r._id !== reportId));
      setUserAlerts((prev) => prev.filter((a) => a.missing_id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteFound = async (reportId: string) => {
    if (deleteFoundConfirmId !== reportId) {
      setDeleteFoundConfirmId(reportId);
      return;
    }
    if (!token) return;
    setDeletingFoundId(reportId);
    try {
      await deleteFoundReport(reportId, token);
      setFoundReports((prev) => prev.filter((r) => r._id !== reportId));
      setUserAlerts((prev) => prev.filter((a) => a.found_id !== reportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingFoundId(null);
      setDeleteFoundConfirmId(null);
    }
  };

  const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const imgUrl = (path: string) =>
    path.startsWith("http") ? path : `${API}/${path.replace(/\\/g, "/")}`;

  const missingCards = useMemo(
    () =>
      missingReports.map((r) => ({
        id: r._id,
        name: r.name || "Unknown",
        age: r.age ?? undefined,
        gender: r.gender ?? undefined,
        location: r.last_seen_location ?? undefined,
        description: r.additional_info || "",
        imageUrl: imgUrl(r.image_path),
        createdAt: r.created_at,
        status: r.status ?? undefined,
        type: "missing" as const,
      })),
    [missingReports],
  );

  const foundCards = useMemo(
    () =>
      foundReports.map((r) => ({
        id: r._id,
        name: "Found Person",
        location: r.found_location ?? undefined,
        description: r.additional_info || "",
        imageUrl: imgUrl(r.image_path),
        contact: r.contact_info ?? undefined,
        createdAt: r.created_at,
        type: "found" as const,
      })),
    [foundReports],
  );

  const totalMatches = userAlerts.length;
  const highConfidence = userAlerts.filter(
    (a) => Math.round((a.similarity ?? 0) * 100) >= 75,
  ).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dff4ff_0%,_#f7fbff_45%,_#fff7ef_100%)] text-slate-900">
      <AppNavbar />
      <ProtectedRoute requiredRole="user">
        <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 md:px-8">
          {/* Header + Stats */}
          <section className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Your reports and AI-matched results at a glance.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadData("manual")}
                  disabled={refreshing}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
                <Link
                  href="/report-missing"
                  className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
                >
                  + Report Missing
                </Link>
                <Link
                  href="/report-found"
                  className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
                >
                  + Report Found
                </Link>
              </div>
            </div>

            {error && (
              <div className="mt-4">
                <Toast message={error} tone="error" />
              </div>
            )}

            {/* Stat cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Total Reports
                </p>
                <p className="mt-1 text-2xl font-extrabold">
                  {missingCards.length + foundCards.length}
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600">
                  Matches Found
                </p>
                <p className="mt-1 text-2xl font-extrabold text-cyan-700">
                  {totalMatches}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  High Confidence
                </p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                  {highConfidence}
                </p>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <LoadingSpinner label="Loading dashboard..." />
            </div>
          ) : (
            <>
              {/* Missing Reports Section */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Missing Person Reports</h2>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {missingCards.length} report
                    {missingCards.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {missingCards.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {missingCards.map((card) => {
                      const matchCount = userAlerts.filter(
                        (a) => a.missing_id === card.id,
                      ).length;
                      return (
                        <article
                          key={card.id}
                          onClick={() => router.push(`/matches/${card.id}`)}
                          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:border-cyan-300"
                        >
                          {/* Delete X */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(card.id);
                            }}
                            disabled={deletingId === card.id}
                            className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition ${
                              deleteConfirmId === card.id
                                ? "bg-red-500 text-white scale-110"
                                : "bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                            }`}
                            title={
                              deleteConfirmId === card.id
                                ? "Click again to confirm"
                                : "Delete report"
                            }
                          >
                            {deletingId === card.id ? "..." : "✕"}
                          </button>

                          {/* Match badge */}
                          {matchCount > 0 && (
                            <span className="absolute left-2 top-2 z-10 rounded-full bg-cyan-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                              {matchCount} match{matchCount !== 1 ? "es" : ""}
                            </span>
                          )}
                          {matchCount === 0 &&
                            card.status !== "ready" &&
                            card.status !== "failed" && (
                              <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow animate-pulse">
                                <svg
                                  className="h-3 w-3 animate-spin"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                                Processing
                              </span>
                            )}

                          <div
                            className="h-44 w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${card.imageUrl})` }}
                          />
                          <div className="p-4">
                            <h3 className="text-lg font-bold text-slate-900">
                              {card.name}
                            </h3>
                            {card.age && (
                              <p className="text-sm text-slate-500">
                                Age {card.age}
                                {card.gender ? ` • ${card.gender}` : ""}
                              </p>
                            )}
                            {card.location && (
                              <p className="mt-1 text-sm text-slate-500">
                                Last seen: {card.location}
                              </p>
                            )}
                            {card.description && (
                              <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                                {card.description}
                              </p>
                            )}
                            <p className="mt-3 text-xs font-semibold text-cyan-600">
                              View matches →
                            </p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      No missing person reports yet.
                    </p>
                    <Link
                      href="/report-missing"
                      className="mt-3 inline-block rounded-full bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
                    >
                      Report Missing Person
                    </Link>
                  </div>
                )}
              </section>

              {/* Found Reports Section */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Found Person Reports</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {foundCards.length} report
                    {foundCards.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {foundCards.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {foundCards.map((card) => (
                      <article
                        key={card.id}
                        className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        {/* Delete X */}
                        <button
                          type="button"
                          onClick={() => void handleDeleteFound(card.id)}
                          disabled={deletingFoundId === card.id}
                          className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition ${
                            deleteFoundConfirmId === card.id
                              ? "bg-red-500 text-white scale-110"
                              : "bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                          }`}
                          title={
                            deleteFoundConfirmId === card.id
                              ? "Click again to confirm"
                              : "Delete report"
                          }
                        >
                          {deletingFoundId === card.id ? "..." : "✕"}
                        </button>
                        <div
                          className="h-44 w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${card.imageUrl})` }}
                        />
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-slate-900">
                            {card.name}
                          </h3>
                          {card.location && (
                            <p className="mt-1 text-sm text-slate-500">
                              Found at: {card.location}
                            </p>
                          )}
                          {card.description && (
                            <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                              {card.description}
                            </p>
                          )}
                          {card.contact && (
                            <p className="mt-2 text-xs font-semibold text-slate-400">
                              Contact: {card.contact}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      No found person reports yet.
                    </p>
                    <Link
                      href="/report-found"
                      className="mt-3 inline-block rounded-full border border-cyan-300 bg-cyan-50 px-5 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                    >
                      Report Found Person
                    </Link>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </ProtectedRoute>
    </div>
  );
}
