"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import AppNavbar from "@/components/AppNavbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Toast from "@/components/ui/Toast";
import { useAuth } from "@/context/AuthContext";
import { fetchMatchesForReport, revealContact } from "@/services/api";
import type { MatchDetail, ContactRevealResponse } from "@/types";

export default function MatchesPage() {
  const params = useParams<{ reportId: string }>();
  const reportId = params.reportId;
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<MatchDetail[]>([]);
  const [missingName, setMissingName] = useState("Unknown");
  const [missingImagePath, setMissingImagePath] = useState<string | null>(null);

  // Contact reveal state per alert id
  const [revealConfirm, setRevealConfirm] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<
    Record<string, ContactRevealResponse>
  >({});

  const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const imgUrl = (path?: string | null) =>
    !path
      ? "/placeholder.png"
      : path.startsWith("http")
        ? path
        : `${API}/${path.replace(/\\/g, "/")}`;

  const loadMatches = useCallback(
    async (mode: "initial" | "silent" = "initial") => {
      if (!token || !reportId) return;
      if (mode === "initial") setLoading(true);
      setError("");
      try {
        const data = await fetchMatchesForReport(reportId, token);
        setMissingName(data.missingName);
        setMissingImagePath(data.missingImagePath);
        // Only show matches ≥ 65% confidence
        const filtered = data.matches.filter((m) => m.similarity >= 0.65);
        filtered.sort((a, b) => {
          const diff = b.similarity - a.similarity;
          return diff !== 0
            ? diff
            : new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime();
        });
        setMatches(filtered);
      } catch (err) {
        if (mode === "initial")
          setError(
            err instanceof Error ? err.message : "Failed to load matches.",
          );
      } finally {
        if (mode === "initial") setLoading(false);
      }
    },
    [token, reportId],
  );

  // Initial load
  useEffect(() => {
    void loadMatches("initial");
  }, [loadMatches]);

  // 10s polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pollRef.current = setInterval(() => void loadMatches("silent"), 10_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadMatches]);

  const handleReveal = async (alertId: string) => {
    if (revealConfirm !== alertId) {
      setRevealConfirm(alertId);
      return;
    }
    if (!token) return;
    setRevealLoading(alertId);
    try {
      const contact = await revealContact(alertId, token);
      setRevealed((prev) => ({ ...prev, [alertId]: contact }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reveal contact.",
      );
    } finally {
      setRevealLoading(null);
      setRevealConfirm(null);
    }
  };

  /* ── Confidence ring SVG helper ── */
  const ConfidenceRing = ({ pct }: { pct: number }) => {
    const r = 36;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const color =
      pct >= 85
        ? "stroke-emerald-500"
        : pct >= 75
          ? "stroke-cyan-500"
          : "stroke-amber-500";
    return (
      <svg width="96" height="96" className="shrink-0">
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-slate-200"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className={`${color} transition-all duration-700`}
          transform="rotate(-90 48 48)"
        />
        <text
          x="48"
          y="44"
          textAnchor="middle"
          className="fill-slate-800 text-lg font-extrabold"
          dominantBaseline="central"
          style={{ fontSize: "18px", fontWeight: 800 }}
        >
          {pct}%
        </text>
        <text
          x="48"
          y="62"
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: "10px" }}
        >
          match
        </text>
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dff4ff_0%,_#f7fbff_45%,_#fff7ef_100%)] text-slate-900">
      <AppNavbar />
      <ProtectedRoute requiredRole="user">
        <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 md:px-8">
          {/* ── Header ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href="/dashboard"
                className="group flex items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 transition group-hover:-translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Dashboard
              </Link>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
                Match Results
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                for&nbsp;
                <span className="font-semibold text-slate-700">
                  {missingName}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadMatches("initial")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>

          {error && <Toast message={error} tone="error" />}

          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <LoadingSpinner label="Searching for matches..." />
            </div>
          ) : matches.length === 0 ? (
            /* ── Empty state ── */
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-12 text-center backdrop-blur">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-sky-50 shadow-inner">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-10 w-10 text-cyan-500"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <p className="text-xl font-bold text-slate-700">
                No matches found yet
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Our AI is actively scanning new reports. You&apos;ll receive a
                notification the moment a potential match is found.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-full bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-cyan-700 hover:shadow-md"
                >
                  Return to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void loadMatches("initial")}
                  className="rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Check Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* ── Summary banner ── */}
              <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 px-5 py-3 shadow-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-white shadow">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-cyan-900">
                    {matches.length} potential match
                    {matches.length !== 1 ? "es" : ""} found
                  </p>
                  <p className="text-xs text-cyan-700/80">
                    Sorted by confidence &middot; auto-refreshes every 10s
                  </p>
                </div>
              </div>

              {/* ── Match cards ── */}
              <div className="space-y-6">
                {matches.map((m, idx) => {
                  const pct = Math.round(m.similarity * 100);
                  const contact = revealed[m._id];
                  const isNew = idx === 0;
                  return (
                    <article
                      key={m._id}
                      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
                    >
                      {/* Top accent bar */}
                      <div
                        className={`h-1 w-full ${pct >= 85 ? "bg-emerald-500" : pct >= 75 ? "bg-cyan-500" : "bg-amber-400"}`}
                      />

                      {isNew && (
                        <span className="absolute right-4 top-4 z-10 rounded-full bg-cyan-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                          Latest
                        </span>
                      )}

                      <div className="p-5 md:p-6">
                        {/* ── Side-by-side photos + confidence ring ── */}
                        <div className="flex flex-col items-center gap-5 sm:flex-row">
                          {/* Missing person photo */}
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="relative h-36 w-36 overflow-hidden rounded-2xl border-2 border-slate-200 shadow-sm md:h-44 md:w-44">
                              <div
                                className="h-full w-full bg-cover bg-center"
                                style={{
                                  backgroundImage: `url(${imgUrl(missingImagePath)})`,
                                }}
                              />
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-semibold text-slate-600">
                              Missing
                            </span>
                          </div>

                          {/* Confidence ring in the middle */}
                          <div className="flex flex-col items-center gap-1">
                            <ConfidenceRing pct={pct} />
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                pct >= 85
                                  ? "bg-emerald-100 text-emerald-700"
                                  : pct >= 75
                                    ? "bg-cyan-100 text-cyan-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {pct >= 85
                                ? "High"
                                : pct >= 75
                                  ? "Medium"
                                  : "Low"}{" "}
                              confidence
                            </span>
                          </div>

                          {/* Found person photo */}
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="relative h-36 w-36 overflow-hidden rounded-2xl border-2 border-cyan-200 shadow-sm md:h-44 md:w-44">
                              <div
                                className="h-full w-full bg-cover bg-center"
                                style={{
                                  backgroundImage: `url(${imgUrl(m.found_image_path)})`,
                                }}
                              />
                            </div>
                            <span className="rounded-full bg-cyan-50 px-3 py-0.5 text-[11px] font-semibold text-cyan-700">
                              Found
                            </span>
                          </div>
                        </div>

                        {/* ── Details row ── */}
                        <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-t border-slate-100 pt-4">
                          <div className="space-y-1.5 text-sm">
                            <p className="text-slate-600">
                              <span className="font-semibold text-slate-800">
                                Reported by:
                              </span>{" "}
                              {m.finder_name || "Anonymous"}
                            </p>
                            {m.found_location && (
                              <p className="text-slate-500">
                                <span className="font-semibold text-slate-700">
                                  Location:
                                </span>{" "}
                                {m.found_location}
                              </p>
                            )}
                            <p className="text-xs text-slate-400">
                              Matched on{" "}
                              {new Date(m.created_at).toLocaleDateString(
                                undefined,
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          </div>

                          {/* ── Contact section ── */}
                          <div className="shrink-0">
                            {contact ? (
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-3 text-center shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                                  Contact Info
                                </p>
                                <p className="mt-1 text-sm font-bold text-emerald-800">
                                  {contact.finder_name}
                                </p>
                                {contact.finder_phone ? (
                                  <a
                                    href={`tel:${contact.finder_phone}`}
                                    className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-cyan-700 underline decoration-cyan-300 underline-offset-2 hover:text-cyan-800"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="h-3.5 w-3.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                      />
                                    </svg>
                                    {contact.finder_phone}
                                  </a>
                                ) : (
                                  <p className="mt-1 text-xs text-slate-500">
                                    No phone available
                                  </p>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleReveal(m._id)}
                                disabled={revealLoading === m._id}
                                className={`inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold shadow-sm transition ${
                                  revealConfirm === m._id
                                    ? "bg-amber-500 text-white hover:bg-amber-600"
                                    : "bg-cyan-600 text-white hover:bg-cyan-700 hover:shadow"
                                } disabled:opacity-50`}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                {revealLoading === m._id
                                  ? "Revealing..."
                                  : revealConfirm === m._id
                                    ? "Confirm — share your contact too"
                                    : "Reveal Contact"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </ProtectedRoute>
    </div>
  );
}
