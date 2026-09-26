import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import { Badge, Button, Card, ErrorNote, PageTitle, Spinner, Textarea } from "@/components/ui";
import { useBriefing, useBriefingActions } from "@/lib/queries-strategy";

export function BriefingPage() {
  const q = useBriefing();
  const actions = useBriefingActions();
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [strategic, setStrategic] = useState("");
  const [prediction, setPrediction] = useState("");
  if (q.isPending) return <Spinner />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const { briefing, reviewItem, exercise } = q.data;
  const r = briefing.responses;
  const respond = (patch: Record<string, unknown>) => actions.respond.mutate({ date: briefing.date, patch });
  const doneCount = [r.puzzleAnswer, r.strategicAnswer, r.predictionText].filter((x) => x !== null).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow={`Daily briefing · ${briefing.date}`} title="Ten minutes of deliberate thinking" subtitle="Precomputed for you each day; nothing here needs a model call." action={<Badge tone={briefing.completedAt ? "success" : "accent"}>{doneCount}/3 done</Badge>} />
      <div className="space-y-4">
        <Card title="1. Puzzle" action={<Badge>{briefing.puzzle.kind.replace(/_/g, " ")}</Badge>}>
          <p className="text-sm">{briefing.puzzle.prompt}</p>
          {r.puzzleAnswer === null ? (
            <div className="mt-3 space-y-2">
              <Textarea rows={2} value={puzzleAnswer} onChange={(e) => setPuzzleAnswer(e.target.value)} placeholder="Commit to an answer before revealing" />
              <Button size="sm" disabled={!puzzleAnswer.trim()} onClick={() => respond({ puzzleAnswer: puzzleAnswer.trim() })} loading={actions.respond.isPending}>Commit and reveal</Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <div className="rounded-lg bg-surface-muted p-3"><span className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Your answer</span><p>{r.puzzleAnswer}</p></div>
              <div className="rounded-lg bg-accent-soft p-3"><span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Answer</span><p>{briefing.puzzle.answer}</p><p className="mt-1 text-text-muted">{briefing.puzzle.explanation}</p></div>
              {r.puzzleCorrectSelf === null ? (
                <div className="flex gap-2"><span className="text-xs text-text-faint">Were you right?</span><Button size="sm" variant="secondary" onClick={() => respond({ puzzleCorrectSelf: true })}>Yes</Button><Button size="sm" variant="secondary" onClick={() => respond({ puzzleCorrectSelf: false })}>No</Button></div>
              ) : <Badge tone={r.puzzleCorrectSelf ? "success" : "warning"}>{r.puzzleCorrectSelf ? "self-marked correct" : "self-marked incorrect"}</Badge>}
            </div>
          )}
        </Card>

        <Card title="2. Strategic question">
          <p className="text-sm">{briefing.strategicQuestion}</p>
          {r.strategicAnswer === null ? (
            <div className="mt-3 space-y-2">
              <Textarea rows={3} value={strategic} onChange={(e) => setStrategic(e.target.value)} />
              <Button size="sm" disabled={!strategic.trim()} onClick={() => respond({ strategicAnswer: strategic.trim() })} loading={actions.respond.isPending}>Save</Button>
            </div>
          ) : <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm">{r.strategicAnswer}</p>}
        </Card>

        <Card title="3. Review" action={reviewItem ? <Link to="/app/review"><Button size="sm" variant="secondary">Open review <ArrowRight className="h-4 w-4" /></Button></Link> : null}>
          {reviewItem ? <p className="text-sm">One item is due: <span className="font-medium">{reviewItem.prompt}</span></p> : <p className="text-sm text-text-muted">Nothing due today.</p>}
        </Card>

        <Card title="4. Prediction or reflection">
          <p className="text-sm">{briefing.predictionPrompt.text}</p>
          {briefing.predictionPrompt.refId ? <Link to="/app/journal" className="text-xs text-accent">Open the journal</Link> : null}
          {r.predictionText === null ? (
            <div className="mt-3 space-y-2">
              <Textarea rows={2} value={prediction} onChange={(e) => setPrediction(e.target.value)} placeholder="Write it here; move it to the journal if it deserves tracking" />
              <Button size="sm" disabled={!prediction.trim()} onClick={() => respond({ predictionText: prediction.trim() })} loading={actions.respond.isPending}>Save</Button>
            </div>
          ) : <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-muted p-3 text-sm">{r.predictionText}</p>}
        </Card>

        {exercise ? (
          <Card title="Want more?">
            <p className="text-sm">Recommended exercise: <span className="font-medium">{exercise.title}</span> <span className="text-text-faint">({exercise.estimatedMinutes} min)</span></p>
            <Link to={`/app/train/${exercise.id}`}><Button size="sm" className="mt-2">Open <ArrowRight className="h-4 w-4" /></Button></Link>
          </Card>
        ) : null}
        {briefing.completedAt ? <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Briefing complete.</p> : null}
        <ErrorNote error={actions.respond.error} />
      </div>
    </div>
  );
}
