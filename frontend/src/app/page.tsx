"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppNavbar from "@/components/AppNavbar";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { initialized, isAuthenticated, getDefaultDashboardPath } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!initialized || !isAuthenticated) {
      setRedirecting(false);
      return;
    }

    const currentHash =
      typeof window !== "undefined" ? window.location.hash.trim() : "";

    if (currentHash.length > 0) {
      setRedirecting(false);
      return;
    }

    setRedirecting(true);
    const timer = window.setTimeout(() => {
      router.replace(getDefaultDashboardPath());
    }, 0);

    return () => window.clearTimeout(timer);
  }, [getDefaultDashboardPath, initialized, isAuthenticated, router]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner label="Loading..." />
      </div>
    );
  }

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <LoadingSpinner label="Redirecting to your dashboard..." />
      </div>
    );
  }

  const primaryActions = [
    {
      title: "Report Missing",
      description:
        "Create a missing report and let AI search reports posted by other users.",
      href: "/report-missing",
      cta: "Start Missing Report",
      tone: "primary",
    },
    {
      title: "Report Found",
      description:
        "Submit a found-person report so families can discover a potential match.",
      href: "/report-found",
      cta: "Start Found Report",
      tone: "secondary",
    },
  ] as const;

  const toolCards = [
    {
      title: "Create Missing Case",
      desc: "Open a complete missing-person report workflow.",
      href: "/report-missing",
      badge: "Report",
    },
    {
      title: "Create Found Case",
      desc: "Capture location and evidence from found-person cases.",
      href: "/report-found",
      badge: "Report",
    },
    {
      title: "Track Case Status",
      desc: "View current progress and updates for all active reports.",
      href: "/dashboard",
      badge: "Dashboard",
    },
    {
      title: "AI Match Results",
      desc: "Review possible matches generated from reports by other users.",
      href: "/dashboard",
      badge: "Matching",
    },
    {
      title: "Cross-User Matches",
      desc: "Open your match feed and evaluate confidence-based suggestions.",
      href: "/dashboard",
      badge: "Matching",
    },
    {
      title: "Send Contact Request",
      desc: "Request safe follow-up when a match looks promising.",
      href: "/dashboard",
      badge: "Connect",
    },
    {
      title: "Authority Login",
      desc: "Sign in with assigned role to access secure actions.",
      href: "/login",
      badge: "Access",
    },
    {
      title: "Create Team Account",
      desc: "Onboard volunteers, NGOs, and response teams quickly.",
      href: "/signup",
      badge: "Access",
    },
    {
      title: "Admin Control Center",
      desc: "Moderate cases, users, and approvals with guardrails.",
      href: "/admin",
      badge: "Admin",
    },
  ];

  return (
    <div
      id="home"
      className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#dff4ff_0%,_#f7fbff_45%,_#fff7ef_100%)] dark:bg-[radial-gradient(circle_at_top_right,_#102032_0%,_#0c1523_45%,_#0a121e_100%)] dark:text-slate-100 text-slate-900"
    >
      <AppNavbar />

      <section className="px-5 pb-10 pt-16 md:px-10 md:pb-14 md:pt-20">
        <div className="mx-auto max-w-6xl text-center">
          <p className="inline-flex rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">
            FindMe AI Utility Hub
          </p>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl">
            Find and match missing cases faster in one workflow
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
            Inspired by utility-first platforms, FindMe AI helps users publish
            reports, discover cross-user matches, and coordinate safe follow-up.
          </p>
        </div>
      </section>

      <section className="px-5 pb-10 md:px-10 md:pb-14">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          {primaryActions.map((action) => (
            <article
              key={action.title}
              className={`home-card h-full rounded-2xl border p-6 md:p-7 ${action.tone === "primary" ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-200 bg-white text-slate-900"}`}
            >
              <h2 className="text-2xl font-extrabold md:text-3xl">
                {action.title}
              </h2>
              <p
                className={`mt-3 text-sm leading-relaxed ${action.tone === "primary" ? "text-cyan-50" : "text-slate-600"}`}
              >
                {action.description}
              </p>
              <Link
                href={action.href}
                className={`mt-6 inline-flex rounded-xl px-4 py-2.5 text-sm font-bold transition ${action.tone === "primary" ? "bg-white text-cyan-700 hover:bg-cyan-50" : "border border-slate-300 bg-white text-slate-800 hover:border-slate-400"}`}
              >
                {action.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="services" className="px-5 pb-10 md:px-10 md:pb-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex flex-wrap justify-center gap-2 md:mb-6">
            {["All Actions", "Report", "Matching", "Dashboard", "Connect"].map(
              (tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${index === 0 ? "border-cyan-200 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                >
                  {tab}
                </button>
              ),
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {toolCards.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="home-card group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-200"
              >
                <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 group-hover:bg-cyan-50 group-hover:text-cyan-700">
                  {tool.badge}
                </span>
                <h3 className="mt-3 text-base font-bold text-slate-900">
                  {tool.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {tool.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-12 md:px-10">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 md:p-7">
          <h2 className="text-center text-2xl font-extrabold text-slate-900 md:text-3xl">
            How Matching Works
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "1. Submit Report",
                desc: "Add photo and details in a guided report form.",
              },
              {
                title: "2. AI Finds Similar Cases",
                desc: "Your report is compared against other user submissions.",
              },
              {
                title: "3. Connect Safely",
                desc: "Review confidence and request secure follow-up.",
              },
            ].map((step) => (
              <article
                key={step.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600">{step.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/80 px-5 py-8 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-3 text-center sm:grid-cols-3">
          {[
            {
              title: "For Authorities",
              desc: "Role-based access and audit-ready records.",
            },
            {
              title: "For Volunteers",
              desc: "Quick, guided steps to report and verify.",
            },
            {
              title: "For Teams",
              desc: "Shared dashboards for coordinated response.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200 bg-white px-4 py-5"
            >
              <p className="font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="px-5 py-12 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 md:p-7">
            <h2 className="text-2xl font-extrabold md:text-3xl">
              Trusted to handle sensitive case workflows
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              FindMe AI keeps high-pressure case coordination practical with
              secure access, transparent activity, and AI-assisted matching
              support.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { value: "24/7", label: "Case Intake" },
                { value: "95%", label: "Review Accuracy" },
                { value: "<4s", label: "Avg Match Lookup" },
                { value: "RBAC", label: "Controlled Access" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-slate-50 px-3 py-4 text-center"
                >
                  <p className="text-lg font-black text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <aside className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Get Started
            </p>
            <h3 className="mt-2 text-2xl font-extrabold text-slate-900">
              Set up your response team
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Create an account, assign roles, and begin reporting cases in a
              clean operational flow.
            </p>
            <div className="mt-5 space-y-2.5">
              <Link
                href="/signup"
                className="block rounded-xl bg-cyan-600 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-cyan-700"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="block rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-800 transition hover:border-slate-400"
              >
                Login
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <section id="contact" className="px-5 pb-12 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-700">
              Contact
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-slate-900 md:text-2xl">
              Need onboarding support?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              We can help your team set up deployment and workflow training.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="mailto:team@findme.ai"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              team@findme.ai
            </a>
            <a
              href="tel:+910000000000"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-slate-400"
            >
              +91 00000 00000
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-7 text-center text-sm text-slate-600">
        <p>© {new Date().getFullYear()} FindMe AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
