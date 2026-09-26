import { ArrowRight, Clock } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { Badge, Button, Card, EmptyState, ErrorNote, MODE_LABELS, PageTitle, Spinner } from "@/components/ui";
import { useCreateSession, useExercises, useSessions } from "@/lib/queries";

export function TrainPage() {
  const exercises = useExercises();
  const sessions = useSessions();
  const attempted = new Map((sessions.data?.sessions ?? []).map((s) => [s.exerciseId, s]));

  return (
    <div>
      <PageTitle eyebrow="Train" title="Exercise catalog" subtitle="Curated exercises with a hidden answer key or a transparent rubric, coached Socratically." />
      {exercises.isPending ? (
        <Spinner />
      ) : exercises.isError ? (
        <ErrorNote error={exercises.error} />
      ) : exercises.data.exercises.length === 0 ? (
        <EmptyState title="No exercises published yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {exercises.data.exercises.map((e) => {
            const prior = attempted.get(e.id);
            return (
              <Link key={e.id} to={`/app/train/${e.id}`} className="panel block p-5 transition-colors hover:border-border-strong">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="info">{MODE_LABELS[e.mode] ?? e.mode}</Badge>
                  <span className="flex items-center gap-1 text-xs text-text-faint">
                    <Clock className="h-3.5 w-3.5" /> {e.estimatedMinutes} min · difficulty {e.difficulty}/5
                  </span>
                </div>
                <h3 className="mt-3 text-xl">{e.title}</h3>
                <p className="mt-1 text-sm text-text-muted">{e.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>{e.answerKind === "fixed" ? "Fixed answer" : "Rubric-judged"}</Badge>
                  {prior ? <Badge tone={prior.status === "active" ? "accent" : "success"}>{prior.status === "active" ? "In progress" : "Attempted"}</Badge> : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ExercisePage() {
  const { exerciseId = "" } = useParams();
  const exercises = useExercises();
  const sessions = useSessions();
  const create = useCreateSession();
  const navigate = useNavigate();
  const exercise = exercises.data?.exercises.find((e) => e.id === exerciseId);
  const active = sessions.data?.sessions.find((s) => s.exerciseId === exerciseId && s.status === "active");

  if (exercises.isPending) return <Spinner />;
  if (!exercise) return <EmptyState title="Exercise not found" action={<Link to="/app/train"><Button variant="secondary">Back to catalog</Button></Link>} />;

  const start = async () => {
    const r = await create.mutateAsync(exercise.id);
    navigate(`/app/sessions/${r.session.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow={MODE_LABELS[exercise.mode] ?? exercise.mode} title={exercise.title} subtitle={exercise.summary} />
      <Card title="Learning objectives">
        <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
          {exercise.learningObjectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </Card>
      <Card className="mt-4" title="How a session works">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-text-muted">
          <li>The coach asks what you understand before it says anything about the answer.</li>
          <li>You record competing hypotheses or plans with their evidence and your confidence.</li>
          <li>The coach challenges your strongest position; you revise or defend it.</li>
          <li>You make a decision. Only then is the solution or reference analysis released, followed by a debrief.</li>
          <li>Hints are available in five steps. Using them is never punished, but unaided work is tracked separately.</li>
        </ol>
      </Card>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {active ? (
          <Link to={`/app/sessions/${active.id}`}>
            <Button size="lg">
              Resume session <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
        <Button size="lg" variant={active ? "secondary" : "primary"} onClick={start} loading={create.isPending}>
          {active ? "Start a fresh attempt" : "Start session"}
        </Button>
        <span className="text-xs text-text-faint">About {exercise.estimatedMinutes} minutes.</span>
      </div>
      <div className="mt-3">
        <ErrorNote error={create.error} />
      </div>
    </div>
  );
}
