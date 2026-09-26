import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import type { Db } from "./db/client";
import { account, session, user, verification } from "./db/schema";
import type { AppEnv } from "./env";

/**
 * Better Auth instance. Web clients use cookies; the Capacitor app uses the
 * bearer plugin (token from the `set-auth-token` response header).
 */
export function createAuth(db: Db, env: AppEnv) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.authSecret,
    basePath: "/api/auth",
    trustedOrigins: env.CLIENT_ORIGINS,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    user: {
      deleteUser: { enabled: true },
    },
    plugins: [bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = { id: string; email: string; name: string };
