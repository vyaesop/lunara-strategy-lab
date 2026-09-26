import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { RevealText } from "./motion";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "shine bg-accent text-bg shadow-[0_8px_24px_-12px_var(--accent)] hover:bg-accent-strong hover:shadow-[0_14px_32px_-14px_var(--accent)] disabled:hover:bg-accent disabled:shadow-none",
  secondary: "bg-surface border border-border-strong text-text hover:bg-surface-muted hover:border-accent/40",
  ghost: "bg-transparent text-text-muted hover:bg-surface-muted hover:text-text",
  danger: "bg-danger-soft text-danger border border-danger/30 hover:brightness-95",
};
const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 select-none",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
    >
      {loading ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        "h-10 w-full rounded-lg border border-border bg-bg-elevated px-3 text-sm text-text placeholder:text-text-faint focus:border-accent",
        className,
      )}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={cx(
        "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent resize-y",
        className,
      )}
    />
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <div className="text-[13px] font-medium text-text">{children}</div>
      {hint ? <div className="text-xs text-text-faint">{hint}</div> : null}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("panel p-5", className)}>
      {title || action ? (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title ? <h3 className="text-lg">{title}</h3> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "info" | "success" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-surface-muted text-text-muted",
    accent: "bg-accent-soft text-accent",
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  } as const;
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx("inline-block animate-spin rounded-full border-2 border-current border-t-transparent", className ?? "h-5 w-5")}
      role="status"
      aria-label="Loading"
    />
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong p-8 text-center">
      <div className="font-serif text-lg">{title}</div>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

export function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-accent">
            <span className="h-px w-6 bg-accent/60" />
            {eyebrow}
          </div>
        ) : null}
        <RevealText key={title} className="text-3xl md:text-[2.6rem]">
          {title}
        </RevealText>
        {subtitle ? <p className="mt-2 max-w-2xl text-text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export const MODE_LABELS: Record<string, string> = {
  strategic_planning: "Strategic planning",
  critical_thinking: "Critical thinking",
  deductive_reasoning: "Deductive reasoning",
  abductive_reasoning: "Abductive reasoning",
  inductive_reasoning: "Inductive reasoning",
  bayesian_reasoning: "Bayesian reasoning",
  negotiation: "Negotiation",
  adversarial_thinking: "Adversarial thinking",
  long_term_planning: "Long-term planning",
  decision_under_uncertainty: "Decisions under uncertainty",
  systems_thinking: "Systems thinking",
  historical_analysis: "Historical analysis",
  intelligence_analysis: "Intelligence analysis",
};

export const PHASE_LABELS: Record<string, string> = {
  introduction: "Introduction",
  initial_understanding: "Understanding",
  hypothesis: "Hypotheses",
  evidence_challenge: "Challenge",
  revision: "Revision",
  final_decision: "Decision",
  debrief: "Debrief",
  skill_update: "Skill update",
  completed: "Completed",
};
