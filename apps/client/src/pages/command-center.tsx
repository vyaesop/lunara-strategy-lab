import { ArrowRight, Flame, Target } from "lucide-react";
import { Link } from "react-router";
import { SKILL_DEFINITIONS } from "@lunara/core";
import { ScoreBar } from "@/components/assessment";
import { CountUp } from "@/components/motion";
import { Badge, Button, Card, EmptyState, MODE_LABELS, PHASE_LABELS, PageTitle, Spinner } from "@/components/ui";
import { useExercises, useMe, useRecommendations, useSessions } from "@/lib/queries";

export function CommandCenterPage() {
  const me = useMe();
  const sessions = useSessions();
  const exercises = useExercises();

  const recs = useRecommendations();
  const profile = me.data?.profile;
  const active = sessions.data?.sessions.find((s) => s.status === "active") ?? null;
  const completed = sessions.data?.sessions.filter((s) => s.status === "completed") ?? [];
  const recommended = recs.data?.primary ?? null;
  const skills = [...(me.data?.skills ?? [])].sort((a, b) => b.evidenceCount - a.evidenceCount);
  const recentErrors = completed
    .flatMap((s) => s.assessment?.errorPatterns ?? [])
    .reduce<Record<string, number>>((acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }), {});
  const repeatedErrors = Object.entries(recentErrors).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  const firstName = profile?.displayName?.split(" ")[0];

  return (
    <div>
      <PageTitle
        eyebrow="Command Center"
        title={firstName ? `Ready, ${firstName}.` : "Ready."}
        subtitle="What to train today, what you are in the middle of, and what your evidence says so far."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={active ? "Continue your session" : "Recommended next"}>
          {sessions.isPending || exercises.isPending || recs.isPending ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : active ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-text-muted">{MODE_LABELS[active.mode] ?? active.mode}</div>
                <div className="mt-1 text-lg">
                  {exercises.data?.exercises.find((e) => e.id === active.exerciseId)?.title ?? active.exerciseId}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="accent">{PHASE_LABELS[active.phase] ?? active.phase}</Badge>
                  <Badge>Hints used: {active.hintLevel}/5</Badge>
                  <Badge>{active.hypotheses.filter((h) => h.status === "active").length} active hypotheses</Badge>
                </div>
              </div>
              <Link to={`/app/sessions/${active.id}`}>
                <Button>
                  Resume <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : recommended ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-text-muted">{MODE_LABELS[recommended.exercise.mode] ?? recommended.exercise.mode} · about {recommended.exercise.estimatedMinutes} min · difficulty {recommended.exercise.difficulty}/5</div>
                  <div className="mt-1 text-lg">{recommended.exercise.title}</div>
                  <p className="mt-1 max-w-xl text-sm text-text-muted">{recommended.exercise.summary}</p>
                  <p className="mt-2 max-w-xl text-xs text-accent">{recommended.reason}</p>
                </div>
                <Link to={`/app/train/${recommended.exercise.id}`}>
                  <Button>
                    Open <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              {recs.data && recs.data.alternatives.length > 0 ? (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Also suggested</div>
                  <ul className="mt-1 space-y-1">
                    {recs.data.alternatives.map((r) => (
                      <li key={r.exercise.id} className="text-sm">
                        <Link to={`/app/train/${r.exercise.id}`} className="text-text hover:text-accent">
                          {r.exercise.title}
                        </Link>
                        <span className="ml-2 text-xs text-text-faint">{r.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState title="Nothing to recommend yet" body="No published exercises are available." action={<Link to="/app/train"><Button variant="secondary">Browse catalog</Button></Link>} />
          )}
        </Card>

        <Card title="Streak and sessions">
          <div className="grid grid-cols-2 gap-4">
            <Stat icon={<Flame className="h-4 w-4 text-accent" />} label="Current streak" value={profile?.stats.streak.current ?? 0} suffix=" d" />
            <Stat icon={<Target className="h-4 w-4 text-accent" />} label="Completed" value={profile?.stats.sessionsCompleted ?? completed.length} />
          </div>
          <p className="mt-3 text-xs text-text-faint">Streaks count days with a completed session. Nothing here is estimated.</p>
          <Link to="/app/briefing" className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted">
            <span>Today's briefing (10 min)</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          {recs.data && recs.data.reviewsDue > 0 ? (
            <Link to="/app/review" className="mt-3 flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent hover:brightness-95">
              <span>{recs.data.reviewsDue} review item{recs.data.reviewsDue === 1 ? "" : "s"} due</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </Card>

        <Card className="lg:col-span-2" title="Skill profile">
          {skills.length === 0 ? (
            <EmptyState
              title="No evidence yet"
              body="Skill estimates appear only after a completed session produces assessment evidence. Nothing is inferred from onboarding answers."
            />
          ) : (
            <ul className="divide-y divide-border">
              {skills.slice(0, 6).map((s) => (
                <li key={s.skillId} className="flex items-center justify-between py-2 text-sm">
                  <span>{SKILL_DEFINITIONS[s.skillId].label}</span>
                  <ScoreBar value={s.estimate} />
                </li>
              ))}
            </ul>
          )}
          {repeatedErrors.length ? (
            <div className="mt-3 border-t border-border pt-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Repeated reasoning errors</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {repeatedErrors.map(([p, n]) => (
                  <Badge key={p} tone="warning">
                    {p.replace(/_/g, " ")} ×{n}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        <Card title="Recent sessions">
          {sessions.data && sessions.data.sessions.length > 0 ? (
            <ul className="space-y-2">
              {sessions.data.sessions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link to={`/app/sessions/${s.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-muted">
                    <span className="truncate">{exercises.data?.exercises.find((e) => e.id === s.exerciseId)?.title ?? s.exerciseId}</span>
                    <Badge tone={s.status === "active" ? "accent" : s.status === "completed" ? "success" : "neutral"}>{s.status}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No sessions yet" body="Your first session will appear here." />
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, suffix = "" }: { icon: React.ReactNode; label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-serif text-3xl"><CountUp value={value} />{suffix}</div>
    </div>
  );
}
