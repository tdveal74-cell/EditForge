import { cookies } from "next/headers";
import { isAuthenticated, SESSION_COOKIE } from "./auth";
import { workerIsLoopback } from "./forge-worker";

/**
 * Production mutations and protected artifacts require the studio credential.
 * Local development may operate without a login only when its worker is also
 * loopback; a public deployment never inherits that exception.
 */
export async function controlRequestAuthorized(req: Request): Promise<boolean> {
  if (
    await isAuthenticated({
      authorization: req.headers.get("authorization"),
      sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
    })
  ) {
    return true;
  }
  return process.env.NODE_ENV !== "production" && workerIsLoopback();
}

