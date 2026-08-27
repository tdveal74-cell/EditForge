export function remoteMediaUrl(value, label, env = process.env) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`${label} must be HTTP or HTTPS`);
  if (env.NODE_ENV === "production" && env.EDITFORGE_ALLOW_PRIVATE_MEDIA_URLS !== "true") {
    const trusted = new Set(
      (env.EDITFORGE_TRUSTED_MEDIA_ORIGINS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => new URL(item).origin)
    );
    const trustedOrigin = trusted.has(parsed.origin);
    if (parsed.protocol !== "https:" && !trustedOrigin) throw new Error(`${label} must use HTTPS in production`);
    const host = parsed.hostname.toLowerCase();
    const privateHost = host === "localhost" || host === "::1" || host.startsWith("127.") ||
      host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (privateHost && !trustedOrigin) throw new Error(`${label} cannot target a private network address`);
  }
  return parsed;
}

