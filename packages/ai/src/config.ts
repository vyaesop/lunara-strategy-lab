import { AIProviderId, AITask, type AITask as AITaskT } from "@lunara/schemas";
import { GeminiProvider } from "./providers/gemini";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { ModelRouter } from "./router";
import type { AIProvider, ProviderConfig, RoutingTable, TaskRoute, UsageSink } from "./types";

/**
 * Build providers and a routing table from environment variables.
 *
 *   AI_PROVIDER_DEFAULT   mock | gemini | groq | openrouter | mistral | cerebras | nvidia
 *                         | cloudflare | ollama | openai_compatible          (default: mock)
 *   Keys: GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, MISTRAL_API_KEY,
 *         CEREBRAS_API_KEY, NVIDIA_API_KEY, CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID,
 *         OLLAMA_BASE_URL, OPENAI_COMPATIBLE_BASE_URL (+ OPENAI_COMPATIBLE_API_KEY)
 *   AI_MODEL_CHEAP        model for hints / short turns on the default provider
 *   AI_MODEL_STRONG       model for structured generation and assessment
 *   AI_MODEL_EMBED        embedding model (provider must support embeddings)
 *   AI_ROUTE_<TASK>       per-task override "provider:model", e.g. AI_ROUTE_COACH_TURN=groq:openai/gpt-oss-20b
 *   AI_FALLBACKS          ordered fallback chain for every task, e.g.
 *                         "openrouter,gemini:gemini-3.5-flash-lite,mistral". A bare provider
 *                         uses its default cheap/strong model for the task.
 *   AI_ALLOW_USER_CONTENT comma list of providers approved for private user content (default: mock,ollama)
 *
 * Model names below were seen on official model lists on 2026-09-26
 * (docs/AI_PROVIDERS.md). They are defaults only; free lineups change often.
 */
export type Env = Record<string, string | undefined>;

const DEFAULT_MODELS: Record<AIProviderId, { cheap: string; strong: string; embed: string | null }> = {
  mock: { cheap: "mock-small", strong: "mock-large", embed: "mock-embed" },
  gemini: { cheap: "gemini-3.5-flash-lite", strong: "gemini-3.5-flash", embed: "gemini-embedding-001" },
  groq: { cheap: "openai/gpt-oss-20b", strong: "openai/gpt-oss-120b", embed: null },
  openrouter: { cheap: "nvidia/nemotron-3-super-120b-a12b:free", strong: "nvidia/nemotron-3-super-120b-a12b:free", embed: null },
  mistral: { cheap: "mistral-small-latest", strong: "mistral-medium-latest", embed: "mistral-embed" },
  cerebras: { cheap: "gpt-oss-120b", strong: "gpt-oss-120b", embed: null },
  nvidia: { cheap: "nvidia/nemotron-3-super-120b-a12b", strong: "nvidia/nemotron-3-ultra-550b-a55b", embed: null },
  cloudflare: { cheap: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", strong: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", embed: null },
  ollama: { cheap: "llama3.1", strong: "llama3.1", embed: "nomic-embed-text" },
  openai_compatible: { cheap: "default", strong: "default", embed: null },
};

/** Hosted OpenAI-compatible services that need only a key (and a fixed base URL). */
const KEYED_PRESETS: Array<{ id: AIProviderId; name: string; keyVar: string; baseVar: string; baseUrl: string }> = [
  { id: "groq", name: "Groq", keyVar: "GROQ_API_KEY", baseVar: "GROQ_BASE_URL", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "mistral", name: "Mistral", keyVar: "MISTRAL_API_KEY", baseVar: "MISTRAL_BASE_URL", baseUrl: "https://api.mistral.ai/v1" },
  { id: "cerebras", name: "Cerebras", keyVar: "CEREBRAS_API_KEY", baseVar: "CEREBRAS_BASE_URL", baseUrl: "https://api.cerebras.ai/v1" },
  { id: "nvidia", name: "NVIDIA", keyVar: "NVIDIA_API_KEY", baseVar: "NVIDIA_BASE_URL", baseUrl: "https://integrate.api.nvidia.com/v1" },
];

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
  for (const p of KEYED_PRESETS) {
    const apiKey = env[p.keyVar];
    if (!apiKey) continue;
    providers.set(
      p.id,
      new OpenAICompatibleProvider({
        id: p.id,
        name: p.name,
        baseUrl: env[p.baseVar] ?? p.baseUrl,
        apiKey,
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    configs[p.id] = { id: p.id, apiKey, allowsUserContent: allowed.has(p.id) };
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
  if (env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/ai/v1`;
    providers.set(
      "cloudflare",
      new OpenAICompatibleProvider({
        id: "cloudflare",
        name: "Cloudflare Workers AI",
        baseUrl,
        apiKey: env.CLOUDFLARE_API_TOKEN,
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    configs.cloudflare = { id: "cloudflare", baseUrl, apiKey: env.CLOUDFLARE_API_TOKEN, allowsUserContent: allowed.has("cloudflare") };
  }
  if (env.OPENAI_COMPATIBLE_BASE_URL) {
    providers.set(
      "openai_compatible",
      new OpenAICompatibleProvider({
        id: "openai_compatible",
        name: env.OPENAI_COMPATIBLE_NAME ?? "OpenAI-compatible",
        baseUrl: env.OPENAI_COMPATIBLE_BASE_URL,
        ...(env.OPENAI_COMPATIBLE_API_KEY ? { apiKey: env.OPENAI_COMPATIBLE_API_KEY } : {}),
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
    );
    configs.openai_compatible = {
      id: "openai_compatible",
      baseUrl: env.OPENAI_COMPATIBLE_BASE_URL,
      allowsUserContent: allowed.has("openai_compatible"),
    };
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

/** Parse AI_FALLBACKS: "provider" or "provider:model" entries, comma-separated. */
function parseFallbacks(value: string | undefined, available: Set<AIProviderId>): Array<{ provider: AIProviderId; model: string | null }> {
  if (!value) return [];
  const out: Array<{ provider: AIProviderId; model: string | null }> = [];
  for (const raw of value.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const idx = entry.indexOf(":");
    const provider = AIProviderId.safeParse((idx === -1 ? entry : entry.slice(0, idx)).trim());
    if (!provider.success || !available.has(provider.data)) continue;
    const model = idx === -1 ? null : entry.slice(idx + 1).trim() || null;
    out.push({ provider: provider.data, model });
  }
  return out;
}

export function buildRoutesFromEnv(env: Env, available: Set<AIProviderId>): { routes: RoutingTable; defaultProvider: AIProviderId } {
  const requested = AIProviderId.safeParse(env.AI_PROVIDER_DEFAULT ?? "mock");
  let defaultProvider: AIProviderId = requested.success ? requested.data : "mock";
  if (!available.has(defaultProvider)) defaultProvider = "mock";
  const models = DEFAULT_MODELS[defaultProvider];
  const cheap = env.AI_MODEL_CHEAP ?? models.cheap;
  const strong = env.AI_MODEL_STRONG ?? models.strong;

  const fallbacks = parseFallbacks(env.AI_FALLBACKS, available);
  const routes = {} as RoutingTable;
  for (const task of AITask.options) {
    let route: TaskRoute;
    if (task === "embed") {
      const embedModel = env.AI_MODEL_EMBED ?? models.embed;
      route = embedModel
        ? { provider: defaultProvider, model: embedModel, timeoutMs: 20_000, fallback: null }
        : { provider: "mock", model: DEFAULT_MODELS.mock.embed!, timeoutMs: 20_000, fallback: null };
    } else if (CHEAP_TASKS.includes(task)) {
      // Reasoning models spend output tokens on hidden reasoning, so caps are generous.
      route = { provider: defaultProvider, model: cheap, temperature: 0.5, maxOutputTokens: 1_500, timeoutMs: 45_000, fallback: null };
    } else {
      route = { provider: defaultProvider, model: strong, temperature: 0.2, maxOutputTokens: 4_000, timeoutMs: 90_000, fallback: null };
    }
    const override = parseRouteOverride(env[`AI_ROUTE_${task.toUpperCase().replace(/\./g, "_")}`]);
    if (override && available.has(override.provider)) route = { ...route, ...override };
    if (task !== "embed" && fallbacks.length > 0) {
      const tier = CHEAP_TASKS.includes(task) ? "cheap" : "strong";
      route = { ...route, fallbacks: fallbacks.map((f) => ({ provider: f.provider, model: f.model ?? DEFAULT_MODELS[f.provider][tier] })) };
    }
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
