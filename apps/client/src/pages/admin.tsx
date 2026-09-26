import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Badge, Card, ErrorNote, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";

const Overview = z.object({
  counts: z.object({ users: z.number(), coachingSessions: z.number(), investigations: z.number(), simulations: z.number() }),
  ai: z.object({
    defaultProvider: z.string(),
    mock: z.boolean(),
    routes: z.array(z.object({ task: z.string(), provider: z.string(), model: z.string(), allowsUserContent: z.boolean() })),
    last7Days: z.object({ calls: z.number(), estimatedCostUsd: z.number(), inputTokens: z.number(), outputTokens: z.number() }),
    byTask30Days: z.array(z.object({ task: z.string(), calls: z.number(), estimatedCostUsd: z.number() })),
    byProvider30Days: z.array(z.object({ provider: z.string(), model: z.string(), calls: z.number(), estimatedCostUsd: z.number(), avgLatencyMs: z.number() })),
    errors7Days: z.array(z.object({ code: z.string(), n: z.number() })),
  }),
  limits: z.object({ ratePerMinute: z.number(), aiDailyRequests: z.number(), aiMonthlyCostUsd: z.number() }),
});
const Content = z.object({ ok: z.boolean(), report: z.record(z.string(), z.union([z.object({ ok: z.literal(true) }), z.object({ ok: z.literal(false), errors: z.array(z.string()) })])) });

export function AdminPage() {
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api("/api/v1/admin/overview", { schema: Overview }) });
  const content = useQuery({ queryKey: ["admin", "content"], queryFn: () => api("/api/v1/admin/content", { schema: Content }) });
  if (overview.isPending) return <Spinner />;
  if (overview.isError) return <ErrorNote error={overview.error} />;
  const o = overview.data;
  return (
    <div>
      <PageTitle eyebrow="Administration" title="Platform overview" subtitle="Aggregate, anonymised metrics; provider routing without keys; content validation. Content authoring remains in code." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Users" value={o.counts.users} />
        <Stat label="Coaching sessions" value={o.counts.coachingSessions} />
        <Stat label="Investigations" value={o.counts.investigations} />
        <Stat label="Simulations" value={o.counts.simulations} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="AI usage, last 7 days">
          <div className="flex flex-wrap gap-2">
            <Badge tone={o.ai.mock ? "warning" : "success"}>{o.ai.mock ? "mock provider" : o.ai.defaultProvider}</Badge>
            <Badge>{o.ai.last7Days.calls} calls</Badge>
            <Badge>${o.ai.last7Days.estimatedCostUsd.toFixed(4)} est.</Badge>
            <Badge>{o.ai.last7Days.inputTokens.toLocaleString()} in / {o.ai.last7Days.outputTokens.toLocaleString()} out tokens</Badge>
          </div>
          {o.ai.errors7Days.length ? <ul className="mt-3 text-sm">{o.ai.errors7Days.map((e) => <li key={e.code} className="flex justify-between"><span>{e.code}</span><Badge tone="danger">{e.n}</Badge></li>)}</ul> : <p className="mt-3 text-sm text-text-muted">No provider errors in the last 7 days.</p>}
          <div className="mt-3 text-xs text-text-faint">Limits: {o.limits.ratePerMinute} req/min · {o.limits.aiDailyRequests} AI calls/day/user · ${o.limits.aiMonthlyCostUsd}/month/user</div>
        </Card>
        <Card title="Routing">
          <table className="w-full text-xs"><thead><tr className="text-left text-text-faint"><th>Task</th><th>Provider</th><th>Model</th><th>Private content</th></tr></thead><tbody>{o.ai.routes.map((r) => <tr key={r.task} className="border-t border-border"><td>{r.task}</td><td>{r.provider}</td><td>{r.model}</td><td>{r.allowsUserContent ? "allowed" : "blocked"}</td></tr>)}</tbody></table>
          <p className="mt-2 text-xs text-text-faint">Change routing with AI_ROUTE_&lt;TASK&gt;, AI_MODEL_* and AI_ALLOW_USER_CONTENT; restart the API to apply.</p>
        </Card>
        <Card title="By task, 30 days">
          <ul className="text-sm">{o.ai.byTask30Days.map((t) => <li key={t.task} className="flex justify-between border-t border-border py-1 first:border-0"><span>{t.task}</span><span className="text-text-muted">{t.calls} · ${t.estimatedCostUsd.toFixed(4)}</span></li>)}</ul>
        </Card>
        <Card title="By provider and model, 30 days">
          <ul className="text-sm">{o.ai.byProvider30Days.map((p) => <li key={`${p.provider}:${p.model}`} className="flex justify-between border-t border-border py-1 first:border-0"><span>{p.provider} · {p.model}</span><span className="text-text-muted">{p.calls} · ${p.estimatedCostUsd.toFixed(4)} · {p.avgLatencyMs} ms</span></li>)}</ul>
        </Card>
        <Card className="lg:col-span-2" title="Content validation">
          {content.isPending ? <Spinner /> : content.data ? (
            <ul className="grid gap-2 sm:grid-cols-3">{Object.entries(content.data.report).map(([k, v]) => <li key={k} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>{k}</span>{v.ok ? <Badge tone="success">valid</Badge> : <Badge tone="danger">{v.errors.length} errors</Badge>}</li>)}</ul>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="panel p-4"><div className="text-xs text-text-muted">{label}</div><div className="mt-1 font-serif text-3xl">{value.toLocaleString()}</div></div>;
}
