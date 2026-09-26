import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

export const isNative = Capacitor.isNativePlatform();

/** Empty on the web in dev (Vite proxy) and in same-origin deployments. */
export const apiBaseUrl: string = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

const TOKEN_KEY = "lunara.auth.token";
let memoryToken: string | null = null;

/** Bearer token used by the Capacitor app (cookies are unreliable cross-origin in the WebView). */
export async function loadToken(): Promise<string | null> {
  if (memoryToken !== null) return memoryToken;
  try {
    if (isNative) {
      const { value } = await Preferences.get({ key: TOKEN_KEY });
      memoryToken = value ?? "";
    } else {
      memoryToken = localStorage.getItem(TOKEN_KEY) ?? "";
    }
  } catch {
    memoryToken = "";
  }
  return memoryToken || null;
}

export function getTokenSync(): string {
  return memoryToken ?? "";
}

export async function saveToken(token: string | null): Promise<void> {
  memoryToken = token ?? "";
  try {
    if (isNative) {
      if (token) await Preferences.set({ key: TOKEN_KEY, value: token });
      else await Preferences.remove({ key: TOKEN_KEY });
    } else if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode); token stays in memory for this session
  }
}

const THEME_KEY = "lunara.theme";
export type Theme = "system" | "light" | "dark";

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    // ignore
  }
  return "system";
}
