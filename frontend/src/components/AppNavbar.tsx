"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import {
  fetchMyAlerts,
  markAlertRead,
  markAllAlertsRead,
  clearAllAlerts,
} from "@/services/api";
import Button from "@/components/ui/Button";

const navLinks = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
  { label: "Contact", href: "/#contact" },
];

const serviceLinks = [
  { label: "Report Missing", href: "/report-missing" },
  { label: "Report Found", href: "/report-found" },
];

const navTabBaseClass =
  "rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 dark:focus-visible:ring-cyan-700/70";

const navTabActiveClass =
  "text-cyan-700 ring-1 ring-cyan-200 dark:text-cyan-300 dark:ring-cyan-900/60";

const navTabInactiveClass =
  "text-slate-600 hover:text-cyan-700 hover:ring-1 hover:ring-cyan-200 dark:text-slate-300 dark:hover:text-cyan-300 dark:hover:ring-cyan-900/60";

export default function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, token, logout, getDefaultDashboardPath } =
    useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      similarity: number;
      missingId: string;
      createdAt: string;
      isNew: boolean;
      readAt: string | null;
    }>
  >([]);
  const [currentHash, setCurrentHash] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportTypeFilter, setReportTypeFilter] = useState<
    "all" | "missing" | "found"
  >("all");
  const servicesMenuRef = useRef<HTMLDivElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isServicesActive =
    servicesOpen ||
    pathname === "/report-missing" ||
    pathname === "/report-found";
  const dashboardHref = isAuthenticated
    ? getDefaultDashboardPath()
    : "/dashboard";
  const isDashboardActive = pathname === "/dashboard" || pathname === "/admin";

  const isHomeActive =
    pathname === "/" && (currentHash === "" || currentHash === "#home");
  const isAboutActive = pathname === "/" && currentHash === "#about";
  const isContactActive = pathname === "/" && currentHash === "#contact";

  const clearHoverTimers = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleOpenServices = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (servicesOpen) {
      return;
    }
    openTimerRef.current = setTimeout(() => {
      setServicesOpen(true);
      openTimerRef.current = null;
    }, 120);
  };

  const scheduleCloseServices = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = setTimeout(() => {
      setServicesOpen(false);
      closeTimerRef.current = null;
    }, 260);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const type = searchParams.get("type");

    setReportSearch(q);
    setReportTypeFilter(type === "missing" || type === "found" ? type : "all");
  }, [searchParams]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        servicesMenuRef.current &&
        !servicesMenuRef.current.contains(event.target as Node)
      ) {
        setServicesOpen(false);
      }
      if (
        notifMenuRef.current &&
        !notifMenuRef.current.contains(event.target as Node)
      ) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    return () => {
      clearHoverTimers();
    };
  }, []);

  // Fetch notifications for bell icon
  const loadNotifications = useCallback(async () => {
    if (!token || !isAuthenticated) return;
    try {
      const alerts = await fetchMyAlerts(token);
      const mapped = alerts
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 20)
        .map((alert) => ({
          id: alert._id,
          similarity: Math.round((alert.similarity ?? 0) * 100),
          missingId: alert.missing_id ?? "",
          createdAt: alert.created_at,
          isNew: !alert.read_at,
          readAt: alert.read_at ?? null,
        }));
      setNotifications(mapped);
    } catch {
      // Silent fail for notifications
    }
  }, [token, isAuthenticated]);

  // Initial load + poll every 10s for real-time notification updates
  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 10_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkRead = async (alertId: string) => {
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === alertId
          ? { ...n, isNew: false, readAt: new Date().toISOString() }
          : n,
      ),
    );
    try {
      await markAlertRead(alertId, token);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        isNew: false,
        readAt: new Date().toISOString(),
      })),
    );
    try {
      await markAllAlertsRead(token);
    } catch {
      // ignore
    }
  };

  const handleClearAll = async () => {
    if (!token) return;
    setNotifications([]);
    setNotifOpen(false);
    try {
      await clearAllAlerts(token);
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => n.isNew).length;

  const handleNavTabClick = (href: string, label: string) => {
    void label;
    setServicesOpen(false);
    setMenuOpen(false);
    router.push(href);
  };

  const handleReportSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const trimmedQuery = reportSearch.trim();

    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }
    if (reportTypeFilter !== "all") {
      params.set("type", reportTypeFilter);
    }

    const queryString = params.toString();
    router.push(queryString ? `/dashboard?${queryString}` : "/dashboard");
    setMenuOpen(false);
  };

  const visibleNavLinks = navLinks.filter((link) => {
    if (!("role" in link) || !link.role) {
      return true;
    }
    return user?.role === link.role;
  });

  const homeLink = visibleNavLinks.find((link) => link.label === "Home");
  const tailNavLinks = visibleNavLinks.filter((link) => link.label !== "Home");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link
          href="/"
          className="text-lg font-extrabold tracking-tight text-slate-900 md:text-xl dark:text-slate-100"
        >
          FindMe AI
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {homeLink ? (
            <button
              key={homeLink.href}
              onClick={() => {
                handleNavTabClick(homeLink.href, homeLink.label);
              }}
              type="button"
              className={`${navTabBaseClass} ${isHomeActive ? navTabActiveClass : navTabInactiveClass}`}
            >
              {homeLink.label}
            </button>
          ) : null}

          <button
            onClick={() => {
              handleNavTabClick(dashboardHref, "Dashboard");
            }}
            type="button"
            className={`${navTabBaseClass} ${isDashboardActive ? navTabActiveClass : navTabInactiveClass}`}
          >
            Dashboard
          </button>

          <div
            className="relative"
            ref={servicesMenuRef}
            onMouseEnter={scheduleOpenServices}
            onMouseLeave={scheduleCloseServices}
          >
            <button
              onClick={() => {
                clearHoverTimers();
                setServicesOpen((prev) => !prev);
              }}
              className={`appearance-none border-0 bg-transparent cursor-pointer ${navTabBaseClass} ${isServicesActive ? navTabActiveClass : navTabInactiveClass}`}
              aria-haspopup="menu"
              aria-expanded={servicesOpen}
              onFocus={scheduleOpenServices}
            >
              Services
            </button>
            <div
              className={`${servicesOpen ? "visible opacity-100" : "invisible opacity-0"} absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg transition dark:border-slate-700 dark:bg-slate-900`}
              role="menu"
              onMouseEnter={scheduleOpenServices}
              onMouseLeave={scheduleCloseServices}
            >
              {serviceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setServicesOpen(false);
                  }}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:text-cyan-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:text-cyan-300 dark:hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {tailNavLinks.map((link) => {
            const isActive =
              link.label === "About"
                ? isAboutActive
                : link.label === "Contact"
                  ? isContactActive
                  : false;
            return (
              <button
                key={link.href}
                onClick={() => {
                  handleNavTabClick(link.href, link.label);
                }}
                type="button"
                className={`${navTabBaseClass} ${isActive ? navTabActiveClass : navTabInactiveClass}`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        <form
          onSubmit={handleReportSearchSubmit}
          className="hidden items-center gap-2 lg:flex"
          role="search"
        >
          <input
            type="search"
            value={reportSearch}
            onChange={(event) => setReportSearch(event.target.value)}
            placeholder="Search reports..."
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <select
            value={reportTypeFilter}
            onChange={(event) =>
              setReportTypeFilter(
                event.target.value as "all" | "missing" | "found",
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label="Filter report type"
          >
            <option value="all">All</option>
            <option value="missing">Missing</option>
            <option value="found">Found</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          {isAuthenticated && (
            <div className="relative" ref={notifMenuRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        Notifications
                      </p>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[11px] font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                          >
                            Mark all read
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-[11px] font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => {
                            if (notif.isNew) {
                              void handleMarkRead(notif.id);
                            }
                            setNotifOpen(false);
                            router.push(`/matches/${notif.missingId}`);
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/70 ${
                            notif.isNew
                              ? "bg-cyan-50/60 dark:bg-cyan-900/10"
                              : ""
                          }`}
                        >
                          {notif.isNew && (
                            <span className="flex h-2 w-2 shrink-0 rounded-full bg-cyan-500" />
                          )}
                          <div className={notif.isNew ? "" : "ml-5"}>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Match found —{" "}
                              <span
                                className={`${notif.similarity >= 80 ? "text-emerald-600" : notif.similarity >= 70 ? "text-cyan-600" : "text-amber-600"}`}
                              >
                                {notif.similarity}%
                              </span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(notif.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        No notifications yet
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAuthenticated ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-300">
                Hi, {user?.name}
              </span>
              <Button variant="ghost" onClick={logout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">Login</Button>
              </Link>
              <Link href="/signup">
                <Button variant="secondary">Sign Up</Button>
              </Link>
            </>
          )}
          <button
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-700 md:hidden dark:border-slate-700 dark:text-slate-200"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            Menu
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-t border-slate-200 px-4 py-3 md:hidden dark:border-slate-800">
          <div className="flex flex-col gap-2">
            {homeLink ? (
              <button
                onClick={() => {
                  handleNavTabClick(homeLink.href, homeLink.label);
                }}
                type="button"
                className={`${navTabBaseClass} ${isHomeActive ? navTabActiveClass : navTabInactiveClass}`}
              >
                {homeLink.label}
              </button>
            ) : null}
            <button
              onClick={() => {
                handleNavTabClick(dashboardHref, "Dashboard");
              }}
              type="button"
              className={`${navTabBaseClass} ${isDashboardActive ? navTabActiveClass : navTabInactiveClass}`}
            >
              Dashboard
            </button>
            <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Services
            </p>
            {serviceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-700 hover:text-cyan-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:text-cyan-300 dark:hover:bg-slate-800"
              >
                {item.label}
              </Link>
            ))}
            {tailNavLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => {
                  handleNavTabClick(link.href, link.label);
                }}
                type="button"
                className={`${navTabBaseClass} ${(link.label === "About" ? isAboutActive : link.label === "Contact" ? isContactActive : false) ? navTabActiveClass : navTabInactiveClass}`}
              >
                {link.label}
              </button>
            ))}

            <form
              onSubmit={handleReportSearchSubmit}
              className="mt-2 space-y-2"
            >
              <input
                type="search"
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Search reports..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <div className="flex gap-2">
                <select
                  value={reportTypeFilter}
                  onChange={(event) =>
                    setReportTypeFilter(
                      event.target.value as "all" | "missing" | "found",
                    )
                  }
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  aria-label="Filter report type"
                >
                  <option value="all">All</option>
                  <option value="missing">Missing</option>
                  <option value="found">Found</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </header>
  );
}
