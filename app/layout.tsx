import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "EditForge",
  description: "Post-production OS — premium restraint finishing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-navy antialiased">
        <Nav />
        {children}
      </body>
    </html>
  );
}
