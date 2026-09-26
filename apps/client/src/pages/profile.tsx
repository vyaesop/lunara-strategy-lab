import { SKILL_DEFINITIONS, recentTrend } from "@lunara/core";
import { SKILL_IDS } from "@lunara/schemas";
import { Badge, Card, EmptyState, PageTitle } from "@/components/ui";
import { useMe } from "@/lib/queries";

export function ProfilePage() {
  const me = useMe();
  const skills = new Map((me.data?.skills ?? []).map((s) => [s.skillId, s]));
  const goals = me.data?.profile.goals ?? [];

  return (
    <div>
      <PageTitle eyebrow="Progress" title="Strategic profile" subtitle="Every number here has a definition, a scoring method and an evidence source. None of it is an intelligence score." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Skill dimensions">
          <ul className="divide-y divide-border">
            {SKILL_IDS.map((id) => {
              const def = SKILL_DEFINITIONS[id];
              const s = skills.get(id);
              const trend = s ? recentTrend(s) : null;
              return (
                <li key={id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{def.label}</div>
                    {s ? (
                      <div className="flex items-center gap-2">
                        <Badge tone="accent">{Math.round(s.estimate * 100)}</Badge>
                        {s.unaidedEstimate !== null ? <Badge>unaided {Math.round(s.unaidedEstimate * 100)}</Badge> : null}
                        <Badge>{s.evidenceCount} obs. · confidence {Math.round(s.confidence * 100)}%</Badge>
                        {trend !== null ? <Badge tone={trend > 0 ? "success" : trend < 0 ? "warning" : "neutral"}>{trend > 0 ? "improving" : trend < 0 ? "slipping" : "flat"}</Badge> : null}
                      </div>
                    ) : (
                      <Badge>no evidence yet</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{def.definition}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-text-faint">How it is scored</summary>
                    <p className="mt-1 text-xs text-text-muted">
                      <strong>Method:</strong> {def.scoringMethod} <strong>Evidence:</strong> {def.evidenceSource}
                    </p>
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Goals">
          {goals.length === 0 ? (
            <EmptyState title="No goals recorded" body="Goals from onboarding and settings appear here and shape recommendations." />
          ) : (
            <ul className="space-y-2 text-sm">
              {goals.map((g) => (
                <li key={g.id} className="rounded-lg bg-surface-muted p-2">
                  {g.title}
                </li>
              ))}
            </ul>
          )}
          {me.data?.profile.onboarding.answers?.primaryGoals.length ? (
            <div className="mt-3 text-xs text-text-faint">Onboarding goals: {me.data.profile.onboarding.answers.primaryGoals.join(", ")}</div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
