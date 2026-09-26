import { useState, type FormEvent } from "react";
import type { ReviewRating } from "@lunara/schemas";
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Label, PageTitle, Spinner, Textarea } from "@/components/ui";
import { useReviewActions, useReviewItems, useReviewQueue } from "@/lib/queries-reading";

const RATINGS: Array<{ rating: ReviewRating; label: string; tone: "danger" | "warning" | "success" | "info" }> = [
  { rating: "again", label: "Again", tone: "danger" },
  { rating: "hard", label: "Hard", tone: "warning" },
  { rating: "good", label: "Good", tone: "success" },
  { rating: "easy", label: "Easy", tone: "info" },
];

export function ReviewPage() {
  const queue = useReviewQueue();
  const items = useReviewItems();
  const actions = useReviewActions();
  const [revealed, setRevealed] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");

  const current = queue.data?.due[0] ?? null;

  const grade = async (rating: ReviewRating) => {
    if (!current) return;
    await actions.grade.mutateAsync({ id: current.id, rating, explanation: explanation.trim() || null });
    setRevealed(false);
    setExplanation("");
  };

  const addManual = async (e: FormEvent) => {
    e.preventDefault();
    await actions.create.mutateAsync({ kind: "concept", prompt, answer, source: { type: "manual", refId: null, label: "" } });
    setPrompt("");
    setAnswer("");
  };

  return (
    <div>
      <PageTitle eyebrow="Review" title="Spaced repetition" subtitle="Explain the idea in your own words before revealing, then rate your recall honestly. Scheduling uses FSRS; intervals shown are what each rating would produce." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {queue.isPending ? (
            <Spinner />
          ) : current ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="accent">{queue.data!.dueCount} due</Badge>
                <span className="text-xs text-text-faint">{current.kind.replace(/_/g, " ")}{current.source.label ? ` · from ${current.source.label}` : ""} · reviewed {current.card.reps} times</span>
              </div>
              <h2 className="mt-4 text-2xl">{current.prompt}</h2>
              {current.objective ? <p className="mt-1 text-xs text-text-faint">{current.objective}</p> : null}
              <div className="mt-4">
                <Label hint="Optional, but the effort is where retention comes from">Explain it in your own words</Label>
                <Textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
              </div>
              {revealed ? (
                <div className="mt-4 rounded-lg bg-surface-muted p-3">
                  <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Answer</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{current.answer}</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {!revealed ? (
                  <Button onClick={() => setRevealed(true)}>Reveal</Button>
                ) : (
                  RATINGS.map((r) => (
                    <Button key={r.rating} variant="secondary" onClick={() => grade(r.rating)} loading={actions.grade.isPending && actions.grade.variables?.rating === r.rating}>
                      {r.label} <span className="text-xs text-text-faint">{current.preview[r.rating]}d</span>
                    </Button>
                  ))
                )}
                <Button variant="ghost" onClick={() => actions.suspend.mutate({ id: current.id, suspended: true })}>Suspend</Button>
              </div>
              <ErrorNote error={actions.grade.error} />
            </Card>
          ) : (
            <EmptyState title="Nothing due" body={queue.data ? `${queue.data.totalCount} items in your deck · ${queue.data.reviewedToday} touched today.` : ""} />
          )}
        </div>
        <div className="space-y-4">
          <Card title="Add an item">
            <form onSubmit={addManual} className="space-y-2">
              <Input required placeholder="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} />
              <Textarea rows={3} required placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={4000} />
              <ErrorNote error={actions.create.error} />
              <Button type="submit" size="sm" loading={actions.create.isPending}>Add</Button>
            </form>
          </Card>
          <Card title="Deck">
            {items.data && items.data.items.length ? (
              <ul data-lenis-prevent className="max-h-[50vh] space-y-1 overflow-y-auto text-sm">
                {items.data.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-surface-muted">
                    <span className="min-w-0 flex-1 truncate">{it.prompt}</span>
                    <span className="text-xs text-text-faint">{it.suspended ? "suspended" : `due ${new Date(it.card.due).toLocaleDateString()}`}</span>
                    {it.suspended ? <button className="text-xs text-accent" onClick={() => actions.suspend.mutate({ id: it.id, suspended: false })}>resume</button> : null}
                    <button className="text-xs text-text-faint hover:text-danger" onClick={() => actions.remove.mutate(it.id)}>delete</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Empty. Items arrive from generated reading questions, saved concepts, or the form above.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
