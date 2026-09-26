import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATABASE_URL: z.string().min(1).optional(),
  PGLITE_DATA_DIR: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:8787"),
  CLIENT_ORIGINS: z
    .string()
    .default("http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost,https://localhost")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  /** Comma-separated emails granted the admin flag when their profile is created or loaded. */
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().min(0).default(200),
  AI_MONTHLY_COST_LIMIT_USD: z.coerce.number().min(0).default(5),
});

export type AppEnv = z.infer<typeof EnvSchema> & {
  /** Raw env passed through to the AI layer (provider keys, routes). */
  raw: Record<string, string | undefined>;
  authSecret: string;
};

const DEV_SECRET = "lunara-dev-only-secret-do-not-use-in-production-0123456789";

export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  // Treat empty variables (common in hosting dashboards) as unset so defaults apply.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ""));
  const parsed = EnvSchema.safeParse(cleaned);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required in production");
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required in production");
  }
  return { ...env, raw: cleaned, authSecret: env.BETTER_AUTH_SECRET ?? DEV_SECRET };
}
