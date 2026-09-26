import type { ExercisePublic, SessionAssessment } from "@lunara/schemas";
import { SKILL_DEFINITIONS } from "@lunara/core";
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/motion";
import { CountUp } from "./motion";
import { Badge, cx } from "./ui";

const OUTCOME_LABEL: Record<SessionAssessment["outcomeQuality"], { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  correct_well_supported: { label: "Correct and well supported", tone: "success" },
  correct_by_coincidence: { label: "Correct, but weakly supported", tone: "warning" },
  plausible_underdetermined: { label: "Plausible but underdetermined", tone: "info" },
  incorrect_reasonably_justified: { label: "Incorrect, reasonably justified", tone: "info" },
  incorrect_poorly_supported: { label: "Incorrect and poorly supported", tone: "danger" },
  not_applicable: { label: "Rubric-judged (no single answer)", tone: "neutral" },
};

const pct = (v: number) => `${Math.round(v * 100)}`;

/** Renders a persisted assessment. Every number here was computed server-side from rubric scores. */
export function AssessmentView({ assessment, exercise }: { assessment: SessionAssessment; exercise: ExercisePublic }) {
  const outcome = OUTCOME_LABEL[assessment.outcomeQuality];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={outcome.tone}>{outcome.label}</Badge>
        <Badge tone="accent">Overall {pct(assessment.overallScore)}</Badge>
        <Badge>Unaided {pct(assessment.unaidedScore)}</Badge>
        <Badge>{assessment.hintLevelUsed} hint{assessment.hintLevelUsed === 1 ? "" : "s"}</Badge>
        {assessment.revealedBeforeDecision ? <Badge tone="warning">Solution revealed before decision</Badge> : null}
      </div>
      <p className="text-xs text-text-faint">
        Overall is the weighted rubric score. Unaided discounts hints and caps attempts where the solution was revealed first; it is what feeds your unaided skill estimates.
      </p>

      <div>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Rubric</div>
        <ul className="mt-2 space-y-2">
          {assessment.criteria.map((c) => (
            <li key={c.criterionId} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{c.criterionId.replace(/_/g, " ")}</span>
                <ScoreBar value={c.score} />
              </div>
              <p className="mt-1 text-sm text-text-muted">{c.evidence}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Strengths</div>
          <ul className="mt-1 list-disc pl-5 text-sm">{assessment.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Gaps</div>
          <ul className="mt-1 list-disc pl-5 text-sm">{assessment.weaknesses.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>

      {assessment.errorPatterns.length ? (
        <div className="flex flex-wrap gap-1">
          {assessment.errorPatterns.map((p) => (
            <Badge key={p} tone="warning">
              {p.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      ) : null}

      <div>
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Skill evidence from this session</div>
        <ul className="mt-1 divide-y divide-border text-sm">
          {assessment.skillScores.map((s) => (
            <li key={s.skillId} className="flex items-center justify-between py-1.5">
              <span>{SKILL_DEFINITIONS[s.skillId].label}</span>
              <ScoreBar value={s.score} />
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-text-faint">Dimensions declared by "{exercise.title}": {exercise.expectedDimensions.map((d) => SKILL_DEFINITIONS[d].label).join(", ")}.</p>
      </div>

      <div className="border-t border-border pt-3">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-text-faint">Personal debrief</div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{assessment.debrief}</p>
      </div>
    </div>
  );
}

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      // Fill from zero when the bar scrolls into view.
      gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: bar.current, start: "top 95%", once: true } });
    },
    { dependencies: [value], scope: bar },
  );
  return (
    <span className={cx("flex items-center gap-2", className)} aria-label={`${pct(value)} out of 100`}>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted">
        <span ref={bar} className="block h-full origin-left rounded-full bg-gradient-to-r from-accent/70 to-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <CountUp value={Math.round(value * 100)} className="w-7 text-right text-xs text-text-muted" />
    </span>
  );
}
