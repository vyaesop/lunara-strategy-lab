import { AIProviderId, AITask, type AITask as AITaskT } from "@lunara/schemas";
import { GeminiProvider } from "./providers/gemini";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { ModelRouter } from "./router";
import type { AIProvider, ProviderConfig, RoutingTable, TaskRoute, UsageSink } from "./types";

/**
 * Build providers and a routing table from environment variables.
 *
 *   AI_PROVIDER_DEFAULT   mock | gemini | groq | openrouter | ollama   (default: mock)
 *   GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, OLLAMA_BASE_URL
 *   AI_MODEL_CHEAP        model for hints / short turns on the default provider
 *   AI_MODEL_STRONG       model for structured generation and assessment
 *   AI_MODEL_EMBED        embedding model (provider must support embeddings)
 *   AI_ROUTE_<TASK>       per-task override "provider:model", e.g. AI_ROUTE_COACH_TURN=groq:llama-3.1-8b-instant
 *   AI_ALLOW_USER_CONTENT comma list of providers approved for private user content (default: mock,ollama)
 *
 * Model names below were seen in official docs on 2026-09-25 (docs/AI_PROVIDERS.md).
 * They are defaults only; verify before production use.
 */
export type Env = Record<string, string | undefined>;

const DEFAULT_MODELS: Record<AIProviderId, { cheap: string; strong: string; embed: string | null }> = {
  mock: { cheap: "mock-small", strong: "mock-large", embed: "mock-embed" },
  gemini: { cheap: "gemini-3.5-flash-lite", strong: "gemini-3.5-flash", embed: "gemini-embedding-001" },
  groq: { cheap: "llama-3.1-8b-instant", strong: "llama-3.3-70b-versatile", embed: null },
  openrouter: { cheap: "openai/gpt-oss-20b", strong: "openai/gpt-oss-120b", embed: null },
  ollama: { cheap: "llama3.1", strong: "llama3.1", embed: "nomic-embed-text" },
  openai_compatible: { cheap: "default", strong: "default", embed: null },
};

const CHEAP_TASKS: AITaskT[] = ["coach.turn", "coach.hint", "health"];

export interface BuiltAI {
  router: ModelRouter;
  providers: Map<AIProviderId, AIProvider>;
  providerConfigs: Partial<Record<AIProviderId, ProviderConfig>>;
  routes: RoutingTable;
  defaultProvider: AIProviderId;
}

export function buildProvidersFromEnv(env: Env, fetchImpl?: typeof fetch): {
  providers: Map<AIProviderId, AIProvider>;
  configs: Partial<Record<AIProviderId, ProviderConfig>>;
} {
  const providers = new Map<AIProviderId, AIProvider>();
  const configs: Partial<Record<AIProviderId, ProviderConfig>> = {};
  const allowed = new Set(
    (env.AI_ALLOW_USER_CONTENT ?? "mock,ollama")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  providers.set("mock", new MockProvider());
  configs.mock = { id: "mock", allowsUserContent: allowed.has("mock") };

  if (env.GEMINI_API_KEY) {
    providers.set("gemini", new GeminiProvider({ apiKey: env.GEMINI_API_KEY, ...(fetchImpl ? { fetchImpl } : {}) }));
    configs.gemini = { id: "gemini", apiKey: env.GEMINI_API_KEY, allowsUserContent: allowed.has("gemini") };
  }
  if (env.GROQ_API_KEY) {
    providers.set(
      "groq",
      new OpenAICompatibleProvider({
        id: "groq",
        name: "Groq",
        baseUrl: env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
        apiKey: env.GROQ_API_KEY,
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    configs.groq = { id: "groq", apiKey: env.GROQ_API_KEY, allowsUserContent: allowed.has("groq") };
  }
  if (env.OPENROUTER_API_KEY) {
    providers.set(
      "openrouter",
      new OpenAICompatibleProvider({
        id: "openrouter",
        name: "OpenRouter",
        baseUrl: env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        headers: env.OPENROUTER_SITE_URL ? { "HTTP-Referer": env.OPENROUTER_SITE_URL, "X-Title": "Lunara Strategy Lab" } : {},
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    configs.openrouter = { id: "openrouter", apiKey: env.OPENROUTER_API_KEY, allowsUserContent: allowed.has("openrouter") };
  }
  if (env.OLLAMA_BASE_URL) {
    providers.set(
      "ollama",
      new OpenAICompatibleProvider({
        id: "ollama",
        name: "Ollama (local)",
        baseUrl: env.OLLAMA_BASE_URL.replace(/\/+$/, "") + (env.OLLAMA_BASE_URL.includes("/v1") ? "" : "/v1"),
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    configs.ollama = { id: "ollama", baseUrl: env.OLLAMA_BASE_URL, allowsUserContent: allowed.has("ollama") };
  }
  return { providers, configs };
}

function parseRouteOverride(value: string | undefined): { provider: AIProviderId; model: string } | null {
  if (!value) return null;
  const idx = value.indexOf(":");
  if (idx === -1) return null;
  const provider = AIProviderId.safeParse(value.slice(0, idx).trim());
  const model = value.slice(idx + 1).trim();
  if (!provider.success || !model) return null;
  return { provider: provider.data, model };
}

export function buildRoutesFromEnv(env: Env, available: Set<AIProviderId>): { routes: RoutingTable; defaultProvider: AIProviderId } {
  const requested = AIProviderId.safeParse(env.AI_PROVIDER_DEFAULT ?? "mock");
  let defaultProvider: AIProviderId = requested.success ? requested.data : "mock";
  if (!available.has(defaultProvider)) defaultProvider = "mock";
  const models = DEFAULT_MODELS[defaultProvider];
  const cheap = env.AI_MODEL_CHEAP ?? models.cheap;
  const strong = env.AI_MODEL_STRONG ?? models.strong;

  const routes = {} as RoutingTable;
  for (const task of AITask.options) {
    let route: TaskRoute;
    if (task === "embed") {
      const embedModel = env.AI_MODEL_EMBED ?? models.embed;
      route = embedModel
        ? { provider: defaultProvider, model: embedModel, timeoutMs: 20_000, fallback: null }
        : { provider: "mock", model: DEFAULT_MODELS.mock.embed!, timeoutMs: 20_000, fallback: null };
    } else if (CHEAP_TASKS.includes(task)) {
      route = { provider: defaultProvider, model: cheap, temperature: 0.5, maxOutputTokens: 700, timeoutMs: 30_000, fallback: null };
    } else {
      route = { provider: defaultProvider, model: strong, temperature: 0.2, maxOutputTokens: 2_000, timeoutMs: 60_000, fallback: null };
    }
    const override = parseRouteOverride(env[`AI_ROUTE_${task.toUpperCase().replace(/\./g, "_")}`]);
    if (override && available.has(override.provider)) route = { ...route, ...override };
    routes[task] = route;
  }
  return { routes, defaultProvider };
}

export function buildAIFromEnv(env: Env, options: { usageSink?: UsageSink; fetchImpl?: typeof fetch } = {}): BuiltAI {
  const { providers, configs } = buildProvidersFromEnv(env, options.fetchImpl);
  const { routes, defaultProvider } = buildRoutesFromEnv(env, new Set(providers.keys()));
  const router = new ModelRouter({
    providers,
    providerConfigs: configs,
    routes,
    ...(options.usageSink ? { usageSink: options.usageSink } : {}),
  });
  return { router, providers, providerConfigs: configs, routes, defaultProvider };
}
