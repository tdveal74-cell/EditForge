import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // Vercel runs its own output tracing. Since the Next 15 to 16 upgrade, asking
  // for a standalone tree on top of that fails the build on a missing
  // .next/next-server.js.nft.json, which is what has broken every Vercel
  // deployment of this repo. The setting is still required everywhere else:
  // infrastructure/web/Dockerfile copies .next/standalone, and that container
  // is what Hostinger actually serves. So scope it to non-Vercel builders
  // rather than removing it. VERCEL is already the house guard, see
  // lib/durable.ts.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
