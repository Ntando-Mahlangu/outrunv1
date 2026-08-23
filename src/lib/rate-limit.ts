import { prisma } from "@/lib/prisma";
import { RateLimitError } from "@/lib/errors";

const CLEANUP_PROBABILITY = 0.01;
const CLEANUP_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Fixed-window rate limiter for Outrun's own routes (docs/outrun/15
 * "RATE LIMITING" — AI Endpoints, Search, Exports, Webhook Endpoints).
 * Backed by Postgres rather than in-memory so limits hold across
 * serverless instances, matching the same reasoning as Better Auth's own
 * database-backed rate limiter (src/lib/auth.ts). Throws a friendly
 * UserFacingError once the window's limit is exceeded; callers just
 * await this before doing the expensive/abusable work.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "app_rate_limit_bucket" (key, "windowStart", count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, "windowStart")
    DO UPDATE SET count = "app_rate_limit_bucket".count + 1
    RETURNING count
  `;
  const count = rows[0]?.count ?? 1;

  if (Math.random() < CLEANUP_PROBABILITY) {
    prisma.appRateLimitBucket
      .deleteMany({ where: { windowStart: { lt: new Date(Date.now() - CLEANUP_MAX_AGE_MS) } } })
      .catch(() => {});
  }

  if (count > limit) {
    throw new RateLimitError("You're doing that too often. Please wait a moment and try again.");
  }
}

// docs/outrun/15 "RATE LIMITING" categories this app actually has routes
// for. Generous enough not to bother a legitimate single workspace's
// normal usage, tight enough to stop a runaway loop or scripted abuse.
export const RATE_LIMITS = {
  AI: { limit: 20, windowSeconds: 60 },
  SEARCH: { limit: 20, windowSeconds: 60 },
  EXPORT: { limit: 10, windowSeconds: 60 },
  IMPORT: { limit: 10, windowSeconds: 60 },
  WEBHOOK: { limit: 30, windowSeconds: 60 },
  // docs/outrun/14 "API Access (Limited)" — the limit is the point, not an
  // afterthought, so it's tighter than the in-app SEARCH limit even though
  // it serves similar data.
  PUBLIC_API: { limit: 60, windowSeconds: 60 },
} as const;

/** Best-effort client IP for rate-limiting requests with no session yet (webhooks). */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
