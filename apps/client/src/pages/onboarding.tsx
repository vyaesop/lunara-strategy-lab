import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { TRAINING_MODES, type CoachingIntensity, type SessionLengthPreference, type TrainingMode } from "@lunara/schemas";
import { Button, Card, ErrorNote, Input, Label, MODE_LABELS, PageTitle, cx } from "@/components/ui";
import { useCompleteOnboarding } from "@/lib/queries";

const GOALS = ["Make better decisions at work", "Reason more rigorously", "Prepare for negotiations", "Study strategy and history", "Investigate and analyse evidence"];

export function OnboardingPage() {
  const navigate = useNavigate();
  const complete = useCompleteOnboarding();
  const [goals, setGoals] = useState<string[]>([]);
  const [customGoal, setCustomGoal] = useState("");
  const [focus, setFocus] = useState<TrainingMode[]>([]);
  const [experience, setExperience] = useState<"new" | "some" | "experienced" | undefined>();
  const [startWith, setStartWith] = useState<"strategy" | "deduction" | "negotiation" | "general" | undefined>();
  const [intensity, setIntensity] = useState<CoachingIntensity>("balanced");
  const [length, setLength] = useState<SessionLengthPreference>("standard");

  const toggle = <T,>(list: T[], v: T, max: number) => (list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await complete.mutateAsync({
      answers: {
        primaryGoals: [...goals, ...(customGoal.trim() ? [customGoal.trim()] : [])].slice(0, 5),
        interests: [],
        ...(experience ? { selfReportedExperience: experience } : {}),
        ...(startWith ? { startWith } : {}),
      },
      preferences: { coachingIntensity: intensity, sessionLength: length, focusModes: focus },
    });
    navigate("/app", { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Onboarding" title="Set up your training" subtitle="Only what is needed to personalise sessions. Nothing here sets a skill level; that comes from your work." />
      <form onSubmit={submit} className="space-y-4">
        <Card title="What are you training for?">
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip key={g} active={goals.includes(g)} onClick={() => setGoals((l) => toggle(l, g, 4))}>
                {g}
              </Chip>
            ))}
          </div>
          <div className="mt-3">
            <Label hint="Optional">Something else</Label>
            <Input value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} maxLength={120} />
          </div>
        </Card>

        <Card title="Areas to emphasise">
          <p className="mb-2 text-sm text-text-muted">Pick up to four. The curriculum still exposes you to unfamiliar areas deliberately.</p>
          <div className="flex flex-wrap gap-2">
            {TRAINING_MODES.map((m) => (
              <Chip key={m} active={focus.includes(m)} onClick={() => setFocus((l) => toggle(l, m, 4))}>
                {MODE_LABELS[m]}
              </Chip>
            ))}
          </div>
        </Card>

        <Card title="Starting point">
          <Label hint="Self-reported; used only to pick your first exercise">Experience with structured reasoning</Label>
          <div className="flex flex-wrap gap-2">
            {(["new", "some", "experienced"] as const).map((v) => (
              <Chip key={v} active={experience === v} onClick={() => setExperience(v)}>
                {v === "new" ? "New to it" : v === "some" ? "Some practice" : "Experienced"}
              </Chip>
            ))}
          </div>
          <div className="mt-4">
            <Label>Begin with</Label>
            <div className="flex flex-wrap gap-2">
              {(["strategy", "deduction", "negotiation", "general"] as const).map((v) => (
                <Chip key={v} active={startWith === v} onClick={() => setStartWith(v)}>
                  {v[0]!.toUpperCase() + v.slice(1)}
                </Chip>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Coaching style">
          <Label>Intensity</Label>
          <div className="flex flex-wrap gap-2">
            {(["gentle", "balanced", "demanding"] as const).map((v) => (
              <Chip key={v} active={intensity === v} onClick={() => setIntensity(v)}>
                {v[0]!.toUpperCase() + v.slice(1)}
              </Chip>
            ))}
          </div>
          <div className="mt-4">
            <Label>Preferred session length</Label>
            <div className="flex flex-wrap gap-2">
              {(["short", "standard", "deep"] as const).map((v) => (
                <Chip key={v} active={length === v} onClick={() => setLength(v)}>
                  {v === "short" ? "Short (5–10 min)" : v === "standard" ? "Standard (15–25 min)" : "Deep (30+ min)"}
                </Chip>
              ))}
            </div>
          </div>
        </Card>

        <ErrorNote error={complete.error} />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" loading={complete.isPending}>
            Save and continue
          </Button>
          <Button type="button" size="lg" variant="ghost" onClick={() => complete.mutateAsync({ answers: { primaryGoals: [], interests: [] } }).then(() => navigate("/app", { replace: true }))}>
            Skip for now
          </Button>
        </div>
      </form>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
