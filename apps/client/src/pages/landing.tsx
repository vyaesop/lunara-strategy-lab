import { ArrowRight, Brain, GitBranch, Scale, Search } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui";

const PILLARS = [
  { icon: Brain, title: "Socratic coaching", body: "A coach that asks before it explains. You state what you know, what you assume and what you would need to see." },
  { icon: Search, title: "Inference lab", body: "Competing hypotheses, evidence links and calibrated confidence, judged against a hidden ground truth." },
  { icon: GitBranch, title: "Scenario trees", body: "Map decisions, responses and contingencies, then let an auditor find the branch you forgot." },
  { icon: Scale, title: "Honest scoring", body: "Assisted learning is tracked separately from unaided mastery. No IQ numbers, no invented statistics." },
];

export function LandingPage() {
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div>
          <div className="font-serif text-xl">Lunara</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-text-faint">Strategy Lab</div>
        </div>
        <nav className="flex items-center gap-2">
          <Link to="/login" className="px-3 py-2 text-sm text-text-muted hover:text-text">
            Sign in
          </Link>
          <Link to="/signup">
            <Button size="sm">Start training</Button>
          </Link>
        </nav>
      </header>

      <section className="bg-grid mx-auto max-w-6xl px-6 pb-16 pt-14 md:pt-24">
        <div className="max-w-3xl">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Deliberate reasoning practice</div>
          <h1 className="mt-4 text-5xl leading-[1.05] md:text-6xl">
            Train to think like a strategist, an investigator, a negotiator.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-text-muted">
            Lunara does not hand you answers. It puts you in a situation, asks what you know, challenges what you assume, and
            scores how you reasoned, not whether you got lucky.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button size="lg">
                Create an account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-2">
        {PILLARS.map((p) => (
          <div key={p.title} className="panel p-6">
            <p.icon className="h-5 w-5 text-accent" />
            <h3 className="mt-3 text-xl">{p.title}</h3>
            <p className="mt-2 text-sm text-text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-text-faint">Lunara Strategy Lab</footer>
    </div>
  );
}
