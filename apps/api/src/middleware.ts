import { lt, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { HonoEnv } from "./context";
import { requestContext } from "./context";
import { rateLimits } from "./db/schema";
import { ApiHttpError } from "./errors";

/** Verify the Better Auth session (cookie or bearer) and attach the user. */
export const requireUser = createMiddleware<HonoEnv>(async (c, next) => {
  const { auth } = c.get("services");
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) throw new ApiHttpError("unauthenticated", "Sign in required");
  const user = { id: session.user.id, email: session.user.email, name: session.user.name };
  c.set("user", user);
  const ctx = requestContext.getStore();
  if (ctx) ctx.userId = user.id;
  await next();
});

/**
 * Fixed-window rate limit stored in Postgres so it works across instances.
 * Keyed by user id when authenticated, else by client IP.
 */
export const rateLimit = createMiddleware<HonoEnv>(async (c, next) => {
  const { db, env } = c.get("services");
  const user = c.get("user") as { id: string } | undefined;
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "local";
  const key = user ? `u:${user.id}` : `ip:${ip}`;
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = ${windowStart} then ${rateLimits.count} + 1 else 1 end`,
        windowStart,
      },
    })
    .returning({ count: rateLimits.count });

  const remaining = Math.max(0, env.RATE_LIMIT_PER_MINUTE - (row?.count ?? 0));
  c.header("x-ratelimit-limit", String(env.RATE_LIMIT_PER_MINUTE));
  c.header("x-ratelimit-remaining", String(remaining));
  if ((row?.count ?? 0) > env.RATE_LIMIT_PER_MINUTE) {
    c.header("retry-after", "60");
    throw new ApiHttpError("rate_limited", "Too many requests; try again in a minute");
  }
  await next();
});

/** Remove stale rate-limit rows (called opportunistically). */
export async function pruneRateLimits(db: HonoEnv["Variables"]["services"]["db"]): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60_000);
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, cutoff));
}
