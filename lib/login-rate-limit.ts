const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_CLIENTS = 10_000;

type Attempt = { failures: number; resetAt: number };
type Status = { allowed: boolean; retryAfterSeconds: number };

const attempts = new Map<string, Attempt>();

function status(attempt: Attempt | undefined, now: number): Status {
  if (!attempt || attempt.resetAt <= now || attempt.failures < MAX_FAILURES) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((attempt.resetAt - now) / 1000)) };
}

function trimExpired(now: number) {
  for (const [key, attempt] of attempts) {
    if (attempt.resetAt <= now) attempts.delete(key);
  }
  if (attempts.size >= MAX_CLIENTS) attempts.delete(attempts.keys().next().value as string);
}

export function loginRateLimitStatus(key: string, now = Date.now()): Status {
  const attempt = attempts.get(key);
  if (attempt?.resetAt && attempt.resetAt <= now) attempts.delete(key);
  return status(attempt, now);
}

export function recordLoginFailure(key: string, now = Date.now()): Status {
  trimExpired(now);
  const current = attempts.get(key);
  const attempt = current && current.resetAt > now
    ? { failures: current.failures + 1, resetAt: current.resetAt }
    : { failures: 1, resetAt: now + WINDOW_MS };
  attempts.set(key, attempt);
  return status(attempt, now);
}

export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}
