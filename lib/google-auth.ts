export type GoogleAuthConfig = {
  clientId: string;
  clientSecret: string;
  allowedEmails: string[];
  origin: string;
};

export const GOOGLE_STATE_COOKIE = "editforge_google_state";
export const GOOGLE_VERIFIER_COOKIE = "editforge_google_verifier";

export function googleAuthOrigin(): string {
  return (
    process.env.EDITFORGE_GOOGLE_REDIRECT_ORIGIN?.trim() ||
    process.env.EDITFORGE_PASSKEY_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "production" ? "https://editforge.online" : "http://localhost:3000")
  );
}

export function googleAuthConfig(): GoogleAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const allowedEmails = (process.env.EDITFORGE_GOOGLE_ALLOWED_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const origin = googleAuthOrigin();
  if (!clientId || !clientSecret || allowedEmails.length === 0) return null;
  return { clientId, clientSecret, allowedEmails, origin };
}
