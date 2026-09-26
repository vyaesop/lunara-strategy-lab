import { createAuthClient } from "better-auth/react";
import { apiBaseUrl, getTokenSync, saveToken } from "./platform";

/**
 * Better Auth client. On the web the server also sets a cookie; on native
 * the bearer token from `set-auth-token` is the only credential.
 */
// Better Auth requires an absolute base URL; fall back to the page origin (Vite proxy / same-origin deploy).
const origin = apiBaseUrl || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8787");

export const authClient = createAuthClient({
  baseURL: `${origin}/api/auth`,
  fetchOptions: {
    credentials: "include",
    auth: { type: "Bearer", token: () => getTokenSync() },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) void saveToken(token);
    },
  },
});

export async function signOut(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    await saveToken(null);
  }
}
