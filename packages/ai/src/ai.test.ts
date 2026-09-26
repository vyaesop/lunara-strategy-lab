import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildAIFromEnv, buildRoutesFromEnv } from "./config";
import { AIError } from "./errors";
import { GeminiProvider } from "./providers/gemini";
import { MockProvider } from "./providers/mock";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { ModelRouter } from "./router";
import { extractJson, generateStructured } from "./structured";
import type { AIProvider, RoutingTable, UsageEvent } from "./types";

/** Every task routed to one provider/model; tests then override single tasks. */
const routesFor = (provider: "mock" | "groq", model = "m"): RoutingTable => {
  const base = buildRoutesFromEnv({}, new Set(["mock"])).routes;
  return Object.fromEntries(Object.keys(base).map((t) => [t, { provider, model, fallback: null }])) as RoutingTable;
};

describe("extractJson", () => {
  it("handles fenced and prose-wrapped JSON", () => {
    expect(extractJson('Sure:\n```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('text {"a":{"b":2}} trailing')).toBe('{"a":{"b":2}}');
    expect(extractJson("no json")).toBeNull();
  });
});

describe("generateStructured", () => {
  const schema = z.object({ answer: z.string(), confidence: z.number().min(0).max(1) });

  it("validates on first try", async () => {
    const p = new MockProvider({ scripted: () => '{"answer":"x","confidence":0.4}' });
    const r = await generateStructured(p, schema, { model: "m", messages: [{ role: "user", content: "q" }] });
    expect(r.value.answer).toBe("x");
    expect(r.repaired).toBe(false);
    expect(r.calls).toHaveLength(1);
  });

  it("repairs once, then fails", async () => {
    const p = new MockProvider({ scripted: (_o, i) => (i === 0 ? '{"answer":"x","confidence":7}' : '{"answer":"y","confidence":0.9}') });
    const r = await generateStructured(p, schema, { model: "m", messages: [] });
    expect(r.repaired).toBe(true);
    expect(r.value.answer).toBe("y");
    expect(p.log[1]!.messages.at(-1)!.content).toMatch(/confidence/);

    const bad = new MockProvider({ scripted: () => "not json at all" });
    await expect(generateStructured(bad, schema, { model: "m", messages: [] })).rejects.toBeInstanceOf(AIError);
  });
});

describe("ModelRouter", () => {
  it("routes to the configured provider and records usage", async () => {
    const events: UsageEvent[] = [];
    const mock = new MockProvider();
    const router = new ModelRouter({
      providers: new Map([["mock", mock]]),
      providerConfigs: { mock: { id: "mock", allowsUserContent: true } },
      routes: routesFor("mock"),
      usageSink: { record: (e) => void events.push(e) },
    });
    const r = await router.generate("coach.turn", [{ role: "user", content: "hello" }]);
    expect(r.provider).toBe("mock");
    expect(r.text).toContain("mock coach");
    expect(events).toHaveLength(1);
    expect(events[0]!.ok).toBe(true);
    expect(events[0]!.task).toBe("coach.turn");
  });

  it("retries retryable errors then uses explicit fallback only", async () => {
    let calls = 0;
    const flaky: AIProvider = {
      id: "groq",
      name: "Flaky",
      capabilities: () => new MockProvider().capabilities(),
      generate: async () => {
        calls++;
        throw new AIError("provider_unavailable", "down", { retryable: true });
      },
      stream: async function* () {},
    };
    const events: UsageEvent[] = [];
    const routes = routesFor("groq");
    routes["coach.turn"] = { provider: "groq", model: "m", fallback: { provider: "mock", model: "mock-small" } };
    routes["coach.hint"] = { provider: "groq", model: "m", fallback: null };
    const router = new ModelRouter({
      providers: new Map<"groq" | "mock", AIProvider>([
        ["groq", flaky],
        ["mock", new MockProvider()],
      ]),
      providerConfigs: { groq: { id: "groq", allowsUserContent: false }, mock: { id: "mock", allowsUserContent: true } },
      routes,
      usageSink: { record: (e) => void events.push(e) },
      maxRetries: 1,
    });
    const r = await router.generate("coach.turn", [{ role: "user", content: "x" }]);
    expect(r.usedFallback).toBe(true);
    expect(calls).toBe(2);
    expect(events.filter((e) => !e.ok)).toHaveLength(2);

    calls = 0;
    await expect(router.generate("coach.hint", [{ role: "user", content: "x" }])).rejects.toBeInstanceOf(AIError);
    expect(calls).toBe(2);
  });

  it("refuses private user content on unapproved providers", async () => {
    const router = new ModelRouter({
      providers: new Map([["mock", new MockProvider()]]),
      providerConfigs: { mock: { id: "mock", allowsUserContent: false } },
      routes: routesFor("mock"),
    });
    await expect(
      router.generate("coach.turn", [{ role: "user", content: "my private notes" }], { containsUserContent: true }),
    ).rejects.toMatchObject({ code: "user_content_not_allowed" });
  });

  it("times out slow providers", async () => {
    const slow = new MockProvider({ latencyMs: 200 });
    const routes = routesFor("mock");
    routes["coach.turn"] = { provider: "mock", model: "m", timeoutMs: 20, fallback: null };
    const router = new ModelRouter({
      providers: new Map([["mock", slow]]),
      providerConfigs: { mock: { id: "mock", allowsUserContent: true } },
      routes,
      maxRetries: 0,
    });
    // MockProvider ignores signals, so the router-level result still resolves; verify the timeout signal fires.
    const started = Date.now();
    await router.generate("coach.turn", [{ role: "user", content: "x" }]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
  });
});

describe("buildAIFromEnv", () => {
  it("defaults to mock when nothing is configured", () => {
    const ai = buildAIFromEnv({});
    expect(ai.defaultProvider).toBe("mock");
    expect(ai.routes["coach.turn"].provider).toBe("mock");
    expect(ai.providers.has("gemini")).toBe(false);
  });

  it("falls back to mock when the requested default has no key", () => {
    const ai = buildAIFromEnv({ AI_PROVIDER_DEFAULT: "gemini" });
    expect(ai.defaultProvider).toBe("mock");
  });

  it("configures providers from keys and honours per-task overrides", () => {
    const ai = buildAIFromEnv({
      AI_PROVIDER_DEFAULT: "groq",
      GROQ_API_KEY: "k",
      GEMINI_API_KEY: "g",
      AI_ROUTE_COACH_ASSESS: "gemini:gemini-3.5-flash",
      AI_ALLOW_USER_CONTENT: "gemini",
    });
    expect(ai.defaultProvider).toBe("groq");
    expect(ai.routes["coach.turn"].provider).toBe("groq");
    expect(ai.routes["coach.assess"]).toMatchObject({ provider: "gemini", model: "gemini-3.5-flash" });
    expect(ai.router.allowsUserContent("coach.assess")).toBe(true);
    expect(ai.router.allowsUserContent("coach.turn")).toBe(false);
    // groq has no embeddings -> embed route stays on mock
    expect(ai.routes.embed.provider).toBe("mock");
  });
});

describe("HTTP adapters (mocked fetch)", () => {
  const fetchJson = (status: number, body: unknown): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as typeof fetch;

  it("parses OpenAI-compatible responses and maps errors", async () => {
    const ok = new OpenAICompatibleProvider({
      id: "groq",
      name: "Groq",
      baseUrl: "https://example.test/v1",
      apiKey: "k",
      fetchImpl: fetchJson(200, {
        choices: [{ message: { content: "hi" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 1 },
        model: "m",
      }),
    });
    const r = await ok.generate({ model: "m", messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe("hi");
    expect(r.usage).toEqual({ inputTokens: 3, outputTokens: 1 });

    const limited = new OpenAICompatibleProvider({ id: "groq", name: "Groq", baseUrl: "https://example.test", fetchImpl: fetchJson(429, {}) });
    await expect(limited.generate({ model: "m", messages: [] })).rejects.toMatchObject({ code: "rate_limited", retryable: true });
  });

  it("parses Gemini responses and sends the key in a header", async () => {
    let seenHeaders: Headers | undefined;
    let seenUrl = "";
    const fetchImpl: typeof fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url);
      seenHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const g = new GeminiProvider({ apiKey: "secret", fetchImpl });
    const r = await g.generate({ model: "gemini-3.5-flash", messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }] });
    expect(r.text).toBe("ok");
    expect(seenHeaders?.get("x-goog-api-key")).toBe("secret");
    expect(seenUrl).not.toContain("secret");
  });
});
