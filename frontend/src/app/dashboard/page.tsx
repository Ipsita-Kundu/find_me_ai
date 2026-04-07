// "use client";

// import Link from "next/link";
// import { useCallback, useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";

// import AppNavbar from "@/components/AppNavbar";
// import ProtectedRoute from "@/components/ProtectedRoute";
// import LoadingSpinner from "@/components/ui/LoadingSpinner";
// import Toast from "@/components/ui/Toast";
// import { useAuth } from "@/context/AuthContext";
// import {
//   deleteMissingReport,
//   deleteFoundReport,
//   fetchMyAlerts,
//   fetchMyFoundReports,
//   fetchMyMissingReports,
// } from "@/services/api";

// export default function DashboardPage() {
//   const router = useRouter();
//   const { token } = useAuth();
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState("");
//   const [missingReports, setMissingReports] = useState<
//     Awaited<ReturnType<typeof fetchMyMissingReports>>
//   >([]);
//   const [foundReports, setFoundReports] = useState<
//     Awaited<ReturnType<typeof fetchMyFoundReports>>
//   >([]);
//   const [userAlerts, setUserAlerts] = useState<
//     Awaited<ReturnType<typeof fetchMyAlerts>>
//   >([]);

//   // Delete state (missing)
//   const [deletingId, setDeletingId] = useState<string | null>(null);
//   const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

//   // Delete state (found)
//   const [deletingFoundId, setDeletingFoundId] = useState<string | null>(null);
//   const [deleteFoundConfirmId, setDeleteFoundConfirmId] = useState<
//     string | null
//   >(null);

//   const loadData = useCallback(
//     async (mode: "initial" | "manual" | "silent" = "initial") => {
//       if (!token) {
//         setError("Authentication required. Please login again.");
//         setLoading(false);
//         return;
//       }
//       if (mode === "manual") setRefreshing(true);
//       else if (mode === "initial") setLoading(true);
//       if (mode !== "silent") setError("");
//       try {
//         const [missing, found, alerts] = await Promise.all([
//           fetchMyMissingReports(token),
//           fetchMyFoundReports(token),
//           fetchMyAlerts(token),
//         ]);
//         setMissingReports(missing);
//         setFoundReports(found);
//         setUserAlerts(alerts);
//       } catch (err) {
//         if (mode !== "silent")
//           setError(err instanceof Error ? err.message : "Failed to load data.");
//       } finally {
//         setLoading(false);
//         setRefreshing(false);
//       }
//     },
//     [token],
//   );

//   // Initial load + poll every 5s for real-time updates
//   useEffect(() => {
//     void loadData("initial");
//     const interval = setInterval(() => void loadData("silent"), 5_000);
//     return () => clearInterval(interval);
//   }, [loadData]);

//   const handleDelete = async (reportId: string) => {
//     if (deleteConfirmId !== reportId) {
//       setDeleteConfirmId(reportId);
//       return;
//     }
//     if (!token) return;
//     setDeletingId(reportId);
//     try {
//       await deleteMissingReport(reportId, token);
//       setMissingReports((prev) => prev.filter((r) => r._id !== reportId));
//       setUserAlerts((prev) => prev.filter((a) => a.missing_id !== reportId));
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Failed to delete.");
//     } finally {
//       setDeletingId(null);
//       setDeleteConfirmId(null);
//     }
//   };

//   const handleDeleteFound = async (reportId: string) => {
//     if (deleteFoundConfirmId !== reportId) {
//       setDeleteFoundConfirmId(reportId);
//       return;
//     }
//     if (!token) return;
//     setDeletingFoundId(reportId);
//     try {
//       await deleteFoundReport(reportId, token);
//       setFoundReports((prev) => prev.filter((r) => r._id !== reportId));
//       setUserAlerts((prev) => prev.filter((a) => a.found_id !== reportId));
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Failed to delete.");
//     } finally {
//       setDeletingFoundId(null);
//       setDeleteFoundConfirmId(null);
//     }
//   };

//   const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
//   const imgUrl = (path: string) =>
//     path.startsWith("http") ? path : `${API}/${path.replace(/\\/g, "/")}`;

//   const missingCards = useMemo(
//     () =>
//       missingReports.map((r) => ({
//         id: r._id,
//         name: r.name || "Unknown",
//         age: r.age ?? undefined,
//         gender: r.gender ?? undefined,
//         location: r.last_seen_location ?? undefined,
//         description: r.additional_info || "",
//         imageUrl: imgUrl(r.image_path),
//         createdAt: r.created_at,
//         status: r.status ?? undefined,
//         type: "missing" as const,
//       })),
//     [missingReports],
//   );

//   const foundCards = useMemo(
//     () =>
//       foundReports.map((r) => ({
//         id: r._id,
//         name: "Found Person",
//         location: r.found_location ?? undefined,
//         description: r.additional_info || "",
//         imageUrl: imgUrl(r.image_path),
//         contact: r.contact_info ?? undefined,
//         createdAt: r.created_at,
//         type: "found" as const,
//       })),
//     [foundReports],
//   );

//   const totalMatches = userAlerts.length;
//   const highConfidence = userAlerts.filter(
//     (a) => Math.round((a.similarity ?? 0) * 100) >= 75,
//   ).length;

//   return (
//     <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dff4ff_0%,_#f7fbff_45%,_#fff7ef_100%)] text-slate-900">
//       <AppNavbar />
//       <ProtectedRoute requiredRole="user">
//         <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 md:px-8">
//           {/* Header + Stats */}
//           <section className="rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-xl">
//             <div className="flex flex-wrap items-start justify-between gap-4">
//               <div>
//                 <h1 className="text-3xl font-extrabold">Dashboard</h1>
//                 <p className="mt-1 text-sm text-slate-500">
//                   Your reports and AI-matched results at a glance.
//                 </p>
//               </div>
//               <div className="flex items-center gap-2">
//                 <button
//                   type="button"
//                   onClick={() => void loadData("manual")}
//                   disabled={refreshing}
//                   className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
//                 >
//                   {refreshing ? "Refreshing..." : "Refresh"}
//                 </button>
//                 <Link
//                   href="/report-missing"
//                   className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700"
//                 >
//                   + Report Missing
//                 </Link>
//                 <Link
//                   href="/report-found"
//                   className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100"
//                 >
//                   + Report Found
//                 </Link>
//               </div>
//             </div>

//             {error && (
//               <div className="mt-4">
//                 <Toast message={error} tone="error" />
//               </div>
//             )}

//             {/* Stat cards */}
//             <div className="mt-6 grid gap-3 sm:grid-cols-3">
//               <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
//                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
//                   Total Reports
//                 </p>
//                 <p className="mt-1 text-2xl font-extrabold">
//                   {missingCards.length + foundCards.length}
//                 </p>
//               </div>
//               <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
//                 <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600">
//                   Matches Found
//                 </p>
//                 <p className="mt-1 text-2xl font-extrabold text-cyan-700">
//                   {totalMatches}
//                 </p>
//               </div>
//               <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
//                 <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
//                   High Confidence
//                 </p>
//                 <p className="mt-1 text-2xl font-extrabold text-emerald-700">
//                   {highConfidence}
//                 </p>
//               </div>
//             </div>
//           </section>

//           {loading ? (
//             <div className="flex min-h-[30vh] items-center justify-center">
//               <LoadingSpinner label="Loading dashboard..." />
//             </div>
//           ) : (
//             <>
//               {/* Match Results Section */}
//               {userAlerts.length > 0 && (
//                 <section className="space-y-4">
//                   <div className="flex items-center justify-between">
//                     <h2 className="text-xl font-bold">Detected Matches</h2>
//                     <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
//                       {userAlerts.length} match{userAlerts.length !== 1 ? "es" : ""}
//                     </span>
//                   </div>
//                   <div className="space-y-4">
//                     {userAlerts.map((alert) => {
//                       const pct = Math.round((alert.similarity ?? 0) * 100);
//                       const missingReport = (alert as any).missing_report;
//                       const foundReport = (alert as any).found_report;

//                       return (
//                         <Link
//                           key={alert._id}
//                           href={`/matches/${alert.missing_id}`}
//                           className="group block"
//                         >
//                           <article className="relative overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-sky-50 shadow-sm transition hover:shadow-md hover:border-cyan-400">
//                             <div
//                               className={`h-0.5 w-full ${
//                                 pct >= 85 ? "bg-emerald-500" : pct >= 75 ? "bg-cyan-500" : "bg-amber-400"
//                               }`}
//                             />

//                             <div className="p-4 md:p-5">
//                               <div className="flex flex-col items-center gap-4 md:flex-row">
//                                 {/* Missing Report */}
//                                 <div className="flex items-center gap-2 flex-1">
//                                   {missingReport?.image_path ? (
//                                     <div
//                                       className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-cover bg-center"
//                                       // eslint-disable-next-line
//                                       style={{
//                                         backgroundImage: `url(${imgUrl(missingReport.image_path)})`,
//                                       }}
//                                     />
//                                   ) : (
//                                     <div className="h-16 w-16 shrink-0 rounded-lg border border-slate-300 bg-slate-200" />
//                                   )}
//                                   <div className="min-w-0 flex-1">
//                                     <p className="text-[10px] font-semibold uppercase text-slate-500">Missing</p>
//                                     <p className="font-semibold text-slate-900 truncate text-sm">
//                                       {missingReport?.name || "Unknown"}
//                                     </p>
//                                   </div>
//                                 </div>

//                                 {/* Similarity Badge */}
//                                 <div className="flex items-center gap-2">
//                                   <div
//                                     className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white ${
//                                       pct >= 85
//                                         ? "bg-emerald-500"
//                                         : pct >= 75
//                                           ? "bg-cyan-500"
//                                           : "bg-amber-500"
//                                     }`}
//                                   >
//                                     {pct}%
//                                   </div>
//                                 </div>

//                                 {/* Found Report */}
//                                 <div className="flex items-center gap-2 flex-1 md:justify-end">
//                                   {foundReport?.image_path ? (
//                                     <div
//                                       className="h-16 w-16 shrink-0 rounded-lg border border-cyan-300 bg-cover bg-center"
//                                       // eslint-disable-next-line
//                                       style={{
//                                         backgroundImage: `url(${imgUrl(foundReport.image_path)})`,
//                                       }}
//                                     />
//                                   ) : (
//                                     <div className="h-16 w-16 shrink-0 rounded-lg border border-cyan-300 bg-cyan-200" />
//                                   )}
//                                   <div className="min-w-0 flex-1 text-right md:text-left">
//                                     <p className="text-[10px] font-semibold uppercase text-slate-500">Found</p>
//                                     <p className="font-semibold text-slate-900 truncate text-sm">
//                                       {foundReport?.location || "Unknown location"}
//                                     </p>
//                                   </div>
//                                 </div>
//                               </div>
//                             </div>
//                           </article>
//                         </Link>
//                       );
//                     })}
//                   </div>
//                 </section>
//               )}

//               {/* Missing Reports Section */}
//               <section>
//                 <div className="mb-4 flex items-center justify-between">
//                   <h2 className="text-xl font-bold">Missing Person Reports</h2>
//                   <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
//                     {missingCards.length} report
//                     {missingCards.length !== 1 ? "s" : ""}
//                   </span>
//                 </div>
//                 {missingCards.length ? (
//                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
//                     {missingCards.map((card) => {
//                       const matchCount = userAlerts.filter(
//                         (a) => a.missing_id === card.id,
//                       ).length;
//                       return (
//                         <article
//                           key={card.id}
//                           onClick={() => router.push(`/matches/${card.id}`)}
//                           className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:border-cyan-300"
//                         >
//                           {/* Delete X */}
//                           <button
//                             type="button"
//                             onClick={(e) => {
//                               e.stopPropagation();
//                               void handleDelete(card.id);
//                             }}
//                             disabled={deletingId === card.id}
//                             className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition ${
//                               deleteConfirmId === card.id
//                                 ? "bg-red-500 text-white scale-110"
//                                 : "bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
//                             }`}
//                             title={
//                               deleteConfirmId === card.id
//                                 ? "Click again to confirm"
//                                 : "Delete report"
//                             }
//                           >
//                             {deletingId === card.id ? "..." : "✕"}
//                           </button>

//                           {/* Match badge */}
//                           {matchCount > 0 && (
//                             <span className="absolute left-2 top-2 z-10 rounded-full bg-cyan-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
//                               {matchCount} match{matchCount !== 1 ? "es" : ""}
//                             </span>
//                           )}
//                           {matchCount === 0 &&
//                             card.status !== "ready" &&
//                             card.status !== "failed" && (
//                               <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow animate-pulse">
//                                 <svg
//                                   className="h-3 w-3 animate-spin"
//                                   viewBox="0 0 24 24"
//                                   fill="none"
//                                 >
//                                   <circle
//                                     className="opacity-25"
//                                     cx="12"
//                                     cy="12"
//                                     r="10"
//                                     stroke="currentColor"
//                                     strokeWidth="4"
//                                   />
//                                   <path
//                                     className="opacity-75"
//                                     fill="currentColor"
//                                     d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
//                                   />
//                                 </svg>
//                                 Processing
//                               </span>
//                             )}

//                           <div
//                             className="h-44 w-full bg-cover bg-center"
//                             style={{ backgroundImage: `url(${card.imageUrl})` }}
//                           />
//                           <div className="p-4">
//                             <h3 className="text-lg font-bold text-slate-900">
//                               {card.name}
//                             </h3>
//                             {card.age && (
//                               <p className="text-sm text-slate-500">
//                                 Age {card.age}
//                                 {card.gender ? ` • ${card.gender}` : ""}
//                               </p>
//                             )}
//                             {card.location && (
//                               <p className="mt-1 text-sm text-slate-500">
//                                 Last seen: {card.location}
//                               </p>
//                             )}
//                             {card.description && (
//                               <p className="mt-1 text-sm text-slate-600 line-clamp-2">
//                                 {card.description}
//                               </p>
//                             )}
//                             <p className="mt-3 text-xs font-semibold text-cyan-600">
//                               View matches →
//                             </p>
//                           </div>
//                         </article>
//                       );
//                     })}
//                   </div>
//                 ) : (
//                   <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
//                     <p className="text-sm font-medium text-slate-500">
//                       No missing person reports yet.
//                     </p>
//                     <Link
//                       href="/report-missing"
//                       className="mt-3 inline-block rounded-full bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
//                     >
//                       Report Missing Person
//                     </Link>
//                   </div>
//                 )}
//               </section>

//               {/* Found Reports Section */}
//               <section>
//                 <div className="mb-4 flex items-center justify-between">
//                   <h2 className="text-xl font-bold">Found Person Reports</h2>
//                   <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
//                     {foundCards.length} report
//                     {foundCards.length !== 1 ? "s" : ""}
//                   </span>
//                 </div>
//                 {foundCards.length ? (
//                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
//                     {foundCards.map((card) => (
//                       <article
//                         key={card.id}
//                         className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
//                       >
//                         {/* Delete X */}
//                         <button
//                           type="button"
//                           onClick={() => void handleDeleteFound(card.id)}
//                           disabled={deletingFoundId === card.id}
//                           className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition ${
//                             deleteFoundConfirmId === card.id
//                               ? "bg-red-500 text-white scale-110"
//                               : "bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
//                           }`}
//                           title={
//                             deleteFoundConfirmId === card.id
//                               ? "Click again to confirm"
//                               : "Delete report"
//                           }
//                         >
//                           {deletingFoundId === card.id ? "..." : "✕"}
//                         </button>
//                         <div
//                           className="h-44 w-full bg-cover bg-center"
//                           style={{ backgroundImage: `url(${card.imageUrl})` }}
//                         />
//                         <div className="p-4">
//                           <h3 className="text-lg font-bold text-slate-900">
//                             {card.name}
//                           </h3>
//                           {card.location && (
//                             <p className="mt-1 text-sm text-slate-500">
//                               Found at: {card.location}
//                             </p>
//                           )}
//                           {card.description && (
//                             <p className="mt-1 text-sm text-slate-600 line-clamp-2">
//                               {card.description}
//                             </p>
//                           )}
//                           {card.contact && (
//                             <p className="mt-2 text-xs font-semibold text-slate-400">
//                               Contact: {card.contact}
//                             </p>
//                           )}
//                         </div>
//                       </article>
//                     ))}
//                   </div>
//                 ) : (
//                   <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
//                     <p className="text-sm font-medium text-slate-500">
//                       No found person reports yet.
//                     </p>
//                     <Link
//                       href="/report-found"
//                       className="mt-3 inline-block rounded-full border border-cyan-300 bg-cyan-50 px-5 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
//                     >
//                       Report Found Person
//                     </Link>
//                   </div>
//                 )}
//               </section>
//             </>
//           )}
//         </main>
//       </ProtectedRoute>
//     </div>
//   );
// }

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
  fetchAllAlerts,
  fetchAllMissingReports,
  fetchAllFoundReports,
} from "@/services/api";

// ─── types ────────────────────────────────────────────────────────────────────
type GlobalAlert = Awaited<ReturnType<typeof fetchAllAlerts>>[number];

export default function DashboardPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [missingReports, setMissingReports] = useState<Awaited<ReturnType<typeof fetchMyMissingReports>>>([]);
  const [foundReports, setFoundReports] = useState<Awaited<ReturnType<typeof fetchMyFoundReports>>>([]);
  const [userAlerts, setUserAlerts] = useState<Awaited<ReturnType<typeof fetchMyAlerts>>>([]);
  const [communityMissingReports, setCommunityMissingReports] = useState<Awaited<ReturnType<typeof fetchAllMissingReports>>>([]);
  const [communityFoundReports, setCommunityFoundReports] = useState<Awaited<ReturnType<typeof fetchAllFoundReports>>>([]);

  // 👇 new: global alerts state
  const [globalAlerts, setGlobalAlerts] = useState<GlobalAlert[]>([]);
  const [globalAlertsPage, setGlobalAlertsPage] = useState(1);
  const GLOBAL_PAGE_SIZE = 6;

  // Delete state (missing)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Delete state (found)
  const [deletingFoundId, setDeletingFoundId] = useState<string | null>(null);
  const [deleteFoundConfirmId, setDeleteFoundConfirmId] = useState<string | null>(null);

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
        const [missing, found, alerts, allAlerts, communityMissing, communityFound] = await Promise.all([
          fetchMyMissingReports(token),
          fetchMyFoundReports(token),
          fetchMyAlerts(token),
          fetchAllAlerts(token),
          fetchAllMissingReports(token),
          fetchAllFoundReports(token),
        ]);
        setMissingReports(missing);
        setFoundReports(found);
        setUserAlerts(alerts);
        setGlobalAlerts(allAlerts);
        setCommunityMissingReports(communityMissing);
        setCommunityFoundReports(communityFound);
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

  useEffect(() => {
    void loadData("initial");
    const interval = setInterval(() => void loadData("silent"), 5_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDelete = async (reportId: string) => {
    if (deleteConfirmId !== reportId) { setDeleteConfirmId(reportId); return; }
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
    if (deleteFoundConfirmId !== reportId) { setDeleteFoundConfirmId(reportId); return; }
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
  const imgUrl = (path?: string | null) => {
    if (!path) return "/placeholder.png";
    return path.startsWith("http") ? path : `${API}/${path.replace(/\\/g, "/")}`;
  };

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

  const communityMissingCards = useMemo(
    () =>
      communityMissingReports.map((r) => ({
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
    [communityMissingReports],
  );

  const communityFoundCards = useMemo(
    () =>
      communityFoundReports.map((r) => ({
        id: r._id,
        name: "Found Person",
        location: r.found_location ?? undefined,
        description: r.additional_info || "",
        imageUrl: imgUrl(r.image_path),
        contact: r.contact_info ?? undefined,
        createdAt: r.created_at,
        type: "found" as const,
      })),
    [communityFoundReports],
  );

  const totalMatches = userAlerts.length;
  const highConfidence = userAlerts.filter(
    (a) => Math.round((a.similarity ?? 0) * 100) >= 75,
  ).length;

  // Paginated global alerts
  const pagedGlobalAlerts = useMemo(
    () => globalAlerts.slice(0, globalAlertsPage * GLOBAL_PAGE_SIZE),
    [globalAlerts, globalAlertsPage],
  );
  const hasMoreGlobal = pagedGlobalAlerts.length < globalAlerts.length;

  const getAlertLocation = (report?: any) =>
    report?.location ?? report?.found_location ?? report?.last_seen_location ?? "Unknown location";

  // ── helpers ──────────────────────────────────────────────────────────────
  const confidenceColor = (pct: number) =>
    pct >= 85
      ? { bar: "bg-emerald-500", badge: "bg-emerald-500", border: "border-emerald-200", label: "High Match" }
      : pct >= 75
        ? { bar: "bg-cyan-500", badge: "bg-cyan-500", border: "border-cyan-200", label: "Good Match" }
        : { bar: "bg-amber-400", badge: "bg-amber-500", border: "border-amber-200", label: "Possible Match" };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dff4ff_0%,_#f7fbff_45%,_#fff7ef_100%)] text-slate-900">
      <AppNavbar />
      <ProtectedRoute requiredRole="user">
        <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 md:px-8">

          {/* ── Header + Stats ─────────────────────────────────────────────── */}
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
                <Link href="/report-missing" className="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700">
                  + Report Missing
                </Link>
                <Link href="/report-found" className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100">
                  + Report Found
                </Link>
              </div>
            </div>

            {error && <div className="mt-4"><Toast message={error} tone="error" /></div>}

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Reports</p>
                <p className="mt-1 text-2xl font-extrabold">{missingCards.length + foundCards.length}</p>
              </div>
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-600">Matches Found</p>
                <p className="mt-1 text-2xl font-extrabold text-cyan-700">{totalMatches}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">High Confidence</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700">{highConfidence}</p>
              </div>
            </div>
          </section>

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <LoadingSpinner label="Loading dashboard..." />
            </div>
          ) : (
            <>
              {/* ── Your Matches ──────────────────────────────────────────── */}
              {userAlerts.length > 0 && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Detected Matches</h2>
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                      {userAlerts.length} match{userAlerts.length !== 1 ? "es" : ""}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {userAlerts.map((alert) => {
                      const pct = Math.round((alert.similarity ?? 0) * 100);
                      const missingReport = (alert as any).missing_report;
                      const foundReport = (alert as any).found_report;
                      const c = confidenceColor(pct);
                      return (
                        <Link key={alert._id} href={`/matches/${alert.missing_id}`} className="group block">
                          <article className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-r from-cyan-50 to-sky-50 shadow-sm transition hover:shadow-md hover:border-cyan-400`}>
                            <div className={`h-0.5 w-full ${c.bar}`} />
                            <div className="p-4 md:p-5">
                              <div className="flex flex-col items-center gap-4 md:flex-row">
                                <div className="flex items-center gap-2 flex-1">
                                  {missingReport?.image_path ? (
                                    <div className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-cover bg-center" style={{ backgroundImage: `url(${imgUrl(missingReport.image_path)})` }} />
                                  ) : (
                                    <div className="h-16 w-16 shrink-0 rounded-lg border border-slate-300 bg-slate-200" />
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-semibold uppercase text-slate-500">Missing</p>
                                    <p className="font-semibold text-slate-900 truncate text-sm">{missingReport?.name || "Unknown"}</p>
                                  </div>
                                </div>
                                <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-white ${c.badge}`}>
                                  {pct}%
                                </div>
                                <div className="flex items-center gap-2 flex-1 md:justify-end">
                                  {foundReport?.image_path ? (
                                    <div className="h-16 w-16 shrink-0 rounded-lg border border-cyan-300 bg-cover bg-center" style={{ backgroundImage: `url(${imgUrl(foundReport.image_path)})` }} />
                                  ) : (
                                    <div className="h-16 w-16 shrink-0 rounded-lg border border-cyan-300 bg-cyan-200" />
                                  )}
                                  <div className="min-w-0 flex-1 md:text-left">
                                    <p className="text-[10px] font-semibold uppercase text-slate-500">Found</p>
                                    <p className="font-semibold text-slate-900 truncate text-sm">{getAlertLocation(foundReport)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </article>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── 🆕 GLOBAL ALERTS SECTION ──────────────────────────────── */}
              {globalAlerts.length > 0 && (
                <section className="space-y-4">
                  {/* Section header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Community Match Alerts</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        AI-detected potential matches across all reports — help reunite families.
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                      {globalAlerts.length} alert{globalAlerts.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Alert cards grid */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {pagedGlobalAlerts.map((alert) => {
                      const pct = Math.round((alert.similarity ?? 0) * 100);
                      const c = confidenceColor(pct);
                      const missing = alert.missing_report;
                      const found = alert.found_report;

                      return (
                        <Link
                          key={alert._id}
                          href={`/matches/${alert.missing_id}`}
                          className="group block"
                        >
                          <article
                            className={`relative flex flex-col overflow-hidden rounded-2xl border ${c.border} bg-white shadow-sm transition hover:shadow-lg hover:-translate-y-0.5`}
                          >
                            {/* Confidence bar at top */}
                            <div className={`h-1 w-full ${c.bar}`} />

                            {/* Confidence label pill */}
                            <span
                              className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white shadow ${c.badge}`}
                            >
                              {c.label}
                            </span>

                            {/* Side-by-side photos */}
                            <div className="flex gap-1 p-3 pb-0">
                              {/* Missing photo */}
                              <div className="flex flex-1 flex-col items-center gap-1">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                  Missing
                                </p>
                                <div
                                  className="h-28 w-full rounded-xl border border-slate-200 bg-slate-100 bg-cover bg-center"
                                  style={
                                    missing?.image_path
                                      ? { backgroundImage: `url(${imgUrl(missing.image_path)})` }
                                      : {}
                                  }
                                >
                                  {!missing?.image_path && (
                                    <div className="flex h-full items-center justify-center text-slate-400">
                                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Similarity badge */}
                              <div className="flex flex-col items-center justify-center px-1">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shadow ${c.badge}`}>
                                  {pct}%
                                </div>
                                <div className="mt-1 h-px w-6 bg-slate-200" />
                              </div>

                              {/* Found photo */}
                              <div className="flex flex-1 flex-col items-center gap-1">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                  Found
                                </p>
                                <div
                                  className="h-28 w-full rounded-xl border border-cyan-200 bg-cyan-50 bg-cover bg-center"
                                  style={
                                    found?.image_path
                                      ? { backgroundImage: `url(${imgUrl(found.image_path)})` }
                                      : {}
                                  }
                                >
                                  {!found?.image_path && (
                                    <div className="flex h-full items-center justify-center text-cyan-300">
                                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Info row */}
                            <div className="flex flex-1 flex-col gap-2 p-3">
                              <div className="flex justify-between gap-2 text-xs">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-800 truncate">
                                    {missing?.name ?? "Unknown"}
                                  </p>
                                  {missing?.age && (
                                    <p className="text-slate-500">
                                      Age {missing.age}{missing.gender ? ` · ${missing.gender}` : ""}
                                    </p>
                                  )}
                                  {getAlertLocation(missing) !== "Unknown location" && (
                                    <p className="text-slate-400 truncate">📍 {getAlertLocation(missing)}</p>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 text-right">
                                  <p className="font-semibold text-cyan-700 truncate">
                                    {getAlertLocation(found)}
                                  </p>
                                  <p className="text-slate-400 text-[10px]">Found location</p>
                                </div>
                              </div>

                              <p className="mt-auto text-right text-[10px] font-semibold text-violet-600 group-hover:underline">
                                View details →
                              </p>
                            </div>
                          </article>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Load more */}
                  {hasMoreGlobal && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => setGlobalAlertsPage((p) => p + 1)}
                        className="rounded-full border border-violet-200 bg-violet-50 px-6 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                      >
                        Load more alerts ({globalAlerts.length - pagedGlobalAlerts.length} remaining)
                      </button>
                    </div>
                  )}
                </section>
              )}
              {/* ── END GLOBAL ALERTS ─────────────────────────────────────── */}

              {/* ── Missing Reports ───────────────────────────────────────── */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Missing Person Reports</h2>
                  <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {missingCards.length} report{missingCards.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {missingCards.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {missingCards.map((card) => {
                      const matchCount = userAlerts.filter((a) => a.missing_id === card.id).length;
                      return (
                        <article
                          key={card.id}
                          onClick={() => router.push(`/matches/${card.id}`)}
                          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:border-cyan-300"
                        >
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); void handleDelete(card.id); }}
                            disabled={deletingId === card.id}
                            className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition ${deleteConfirmId === card.id ? "bg-red-500 text-white scale-110" : "bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"}`}
                            title={deleteConfirmId === card.id ? "Click again to confirm" : "Delete report"}
                          >
                            {deletingId === card.id ? "..." : "✕"}
                          </button>
                          {matchCount > 0 && (
                            <span className="absolute left-2 top-2 z-10 rounded-full bg-cyan-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                              {matchCount} match{matchCount !== 1 ? "es" : ""}
                            </span>
                          )}
                          {matchCount === 0 && card.status !== "ready" && card.status !== "failed" && (
                            <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow animate-pulse">
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Processing
                            </span>
                          )}
                          <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${card.imageUrl})` }} />
                          <div className="p-4">
                            <h3 className="text-lg font-bold text-slate-900">{card.name}</h3>
                            {card.age && <p className="text-sm text-slate-500">Age {card.age}{card.gender ? ` • ${card.gender}` : ""}</p>}
                            {card.location && <p className="mt-1 text-sm text-slate-500">Last seen: {card.location}</p>}
                            {card.description && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{card.description}</p>}
                            <p className="mt-3 text-xs font-semibold text-cyan-600">View matches →</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">No missing person reports yet.</p>
                    <Link href="/report-missing" className="mt-3 inline-block rounded-full bg-cyan-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700">
                      Report Missing Person
                    </Link>
                  </div>
                )}
              </section>

              {/* ── Found Reports ─────────────────────────────────────────── */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Found Person Reports</h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {foundCards.length} report{foundCards.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {foundCards.length ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {foundCards.map((card) => (
                      <article key={card.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => void handleDeleteFound(card.id)}
                          disabled={deletingFoundId === card.id}
                          className={`absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow transition ${deleteFoundConfirmId === card.id ? "bg-red-500 text-white scale-110" : "bg-white/90 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"}`}
                          title={deleteFoundConfirmId === card.id ? "Click again to confirm" : "Delete report"}
                        >
                          {deletingFoundId === card.id ? "..." : "✕"}
                        </button>
                        <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${card.imageUrl})` }} />
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-slate-900">{card.name}</h3>
                          {card.location && <p className="mt-1 text-sm text-slate-500">Found at: {card.location}</p>}
                          {card.description && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{card.description}</p>}
                          {card.contact && <p className="mt-2 text-xs font-semibold text-slate-400">Contact: {card.contact}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">No found person reports yet.</p>
                    <Link href="/report-found" className="mt-3 inline-block rounded-full border border-cyan-300 bg-cyan-50 px-5 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100">
                      Report Found Person
                    </Link>
                  </div>
                )}
              </section>

              {/* ── Community Missing Reports ───────────────────────────────── */}
              {communityMissingCards.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Community Missing Reports</h2>
                      <p className="text-sm text-slate-500">A broader view of missing persons reported by the community.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {communityMissingCards.length} report{communityMissingCards.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {communityMissingCards.map((card) => (
                      <article
                        key={card.id}
                        onClick={() => router.push(`/matches/${card.id}`)}
                        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg hover:border-cyan-300"
                      >
                        <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${card.imageUrl})` }} />
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-slate-900">{card.name}</h3>
                          {card.age && <p className="text-sm text-slate-500">Age {card.age}{card.gender ? ` • ${card.gender}` : ""}</p>}
                          {card.location && <p className="mt-1 text-sm text-slate-500">Last seen: {card.location}</p>}
                          {card.description && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{card.description}</p>}
                          <p className="mt-3 text-xs font-semibold text-cyan-600">View matches →</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Community Found Reports ───────────────────────────────── */}
              {communityFoundCards.length > 0 && (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold">Community Found Reports</h2>
                      <p className="text-sm text-slate-500">A broader view of found persons reported by the community.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {communityFoundCards.length} report{communityFoundCards.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {communityFoundCards.map((card) => (
                      <article key={card.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: `url(${card.imageUrl})` }} />
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-slate-900">{card.name}</h3>
                          {card.location && <p className="mt-1 text-sm text-slate-500">Found at: {card.location}</p>}
                          {card.description && <p className="mt-1 text-sm text-slate-600 line-clamp-2">{card.description}</p>}
                          {card.contact && <p className="mt-2 text-xs font-semibold text-slate-400">Contact: {card.contact}</p>}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </ProtectedRoute>
    </div>
  );
}