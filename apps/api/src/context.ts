import { AsyncLocalStorage } from "node:async_hooks";
import type { ModelRouter } from "@lunara/ai";
import type { Auth, AuthUser } from "./auth";
import type { Db } from "./db/client";
import type { AppEnv } from "./env";

/** Per-request context visible to the AI usage sink without threading ids everywhere. */
export interface RequestContext {
  userId: string | null;
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export interface Services {
  db: Db;
  auth: Auth;
  ai: ModelRouter;
  env: AppEnv;
  /** True when the AI layer is the deterministic mock. */
  aiIsMock: boolean;
  aiDescription: { provider: string; model: string };
}

export type Variables = {
  services: Services;
  user: AuthUser;
};

export type HonoEnv = { Variables: Variables };
