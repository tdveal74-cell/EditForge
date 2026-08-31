"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MOBILE_MORE, MOBILE_PRIORITY, NAV_GROUPS } from "@/lib/nav";


export function Nav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 max-w-full overflow-x-hidden border-b border-border bg-surface-elevated">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-amber-600 transition-colors duration-flagship hover:text-amber-700 sm:tracking-[0.24em]"
        >
          EditForge
        </Link>

        <nav aria-label="Priority" className="flex min-w-0 items-center justify-end gap-0.5 lg:hidden">
          {MOBILE_PRIORITY.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "shrink-0 rounded-control px-2 py-1.5 text-[11px] font-medium transition-colors duration-flagship",
                  active ? "bg-navy text-surface" : "text-navy/65 hover:bg-surface-muted hover:text-navy"
                )}
              >
                {l.label}
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="nav-more"
            onClick={() => setMoreOpen((o) => !o)}
            className={clsx(
              "shrink-0 rounded-control px-2 py-1.5 text-[11px] font-medium transition-colors duration-flagship",
              moreOpen ? "bg-navy text-surface" : "text-navy/65 hover:bg-surface-muted hover:text-navy"
            )}
          >
            More
          </button>
        </nav>

        <nav aria-label="Studio" className="hidden flex-wrap items-center gap-x-4 gap-y-1 lg:flex">
          {NAV_GROUPS.map((g, gi) => (
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

      {moreOpen && (
        <div
          id="nav-more"
          className="border-t border-border bg-surface-elevated px-4 py-3 lg:hidden"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-navy/45">More</p>
          <ul className="mt-2 grid grid-cols-2 gap-1">
            {MOBILE_MORE.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "block rounded-control px-3 py-2 text-sm transition-colors duration-flagship",
                      active ? "bg-navy text-surface" : "text-navy/75 hover:bg-surface-muted hover:text-navy"
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}
