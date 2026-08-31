import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: {
    default: "EditForge — Flagship Studio OS",
    template: "%s · EditForge",
  },
  description:
    "AAA flagship post-production Studio OS — departments, AI media lanes, engine bridges, rubric-gated delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-surface font-sans text-navy antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-navy focus:px-4 focus:py-2 focus:text-sm focus:text-surface"
        >
          Skip to content
        </a>
        <Nav />
        <div id="main" className="flex-1">
          {children}
        </div>
        <footer className="border-t border-border bg-surface-elevated/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-[11px] text-navy/45">
            <span>EditForge — flagship post-production studio OS</span>
            <span>Rubric before master · consent for clones · no silent auto-ship</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
