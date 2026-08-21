"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const groups: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Create",
    links: [
      { href: "/ascension", label: "Ascension" },
      { href: "/tsws-microdrama", label: "TSWS Micro" },
      { href: "/studio", label: "Studio" },
      { href: "/pipeline", label: "Pipeline" },
      { href: "/projects", label: "Projects" },
      { href: "/timeline", label: "Timeline" },
    ],
  },
  {
    label: "AI media",
    links: [
      { href: "/engines", label: "Engines" },
      { href: "/voice", label: "Voice" },
      { href: "/avatar", label: "Avatar" },
      { href: "/gen-video", label: "Gen video" },
      { href: "/stock", label: "Stock" },
    ],
  },
  {
    label: "Finish",
    links: [
      { href: "/color", label: "Grade" },
      { href: "/longform", label: "Long-form" },
      { href: "/rubric", label: "Rubric" },
      { href: "/export", label: "Export" },
    ],
  },
  {
    label: "Bridges",
    links: [
      { href: "/nle", label: "NLE" },
      { href: "/render", label: "Render" },
      { href: "/hardware", label: "Hardware" },
    ],
  },
];

/** Highest-frequency operator destinations on small screens */
const mobilePriority = [
  { href: "/ascension", label: "Ascension" },
  { href: "/tsws-microdrama", label: "TSWS" },
  { href: "/studio", label: "Studio" },
  { href: "/dailies", label: "Dailies" },
  { href: "/engines", label: "Engines" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-elevated/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <Link
            href="/"
            className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600 transition-colors duration-flagship hover:text-amber-700"
          >
            EditForge
          </Link>
          {/* Mobile priority strip — product actions, not full map */}
          <nav
            aria-label="Priority"
            className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start sm:gap-2 lg:hidden"
          >
            {mobilePriority.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "whitespace-nowrap rounded-control px-2 py-1.5 text-[11px] font-medium transition-colors duration-flagship sm:px-2.5",
                    active
                      ? "bg-navy text-surface"
                      : "text-navy/65 hover:bg-surface-muted hover:text-navy"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <nav aria-label="Studio" className="hidden flex-wrap items-center gap-x-4 gap-y-1 lg:flex">
          {groups.map((g, gi) => (
            <div key={g.label} className="flex items-center gap-x-3">
              {gi > 0 && <span aria-hidden className="h-3 w-px bg-border-strong" />}
              {g.links.map((l) => {
                const active = pathname === l.href || pathname.startsWith(l.href + "/");
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "relative py-1 text-xs transition-colors duration-flagship",
                      active
                        ? "font-semibold text-navy after:absolute after:inset-x-0 after:-bottom-[13px] after:h-0.5 after:bg-amber"
                        : "text-navy/60 hover:text-navy"
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
