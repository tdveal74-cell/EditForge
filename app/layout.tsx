import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: {
    default: "EditForge · The Production Studio",
    template: "%s · EditForge",
  },
  description:
    "One connected production studio for the brief, the voice, the motion and the final cut.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-surface font-sans text-navy antialiased">
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
        <footer className="forge-footer">
          <span>EDITFORGE / MADE FOR THE WORK.</span>
          <div>
            <a href="/canvas">Canvas ↗</a>
            <a href="/hardware">Hardware ↗</a>
            <a href="/rubric">The quality bar ↗</a>
          </div>
          <p>Human review. Intentional delivery.</p>
        </footer>
      </body>
    </html>
  );
}
