import { useRef } from "react";
import { ArrowRight, Brain, GitBranch, Landmark, Scale, Search, Users } from "lucide-react";
import { Link } from "react-router";
import { Compass } from "@/components/compass";
import { Magnetic, Reveal, RevealText } from "@/components/motion";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Button } from "@/components/ui";
import { EASE, gsap, useGSAP } from "@/lib/motion";

const PILLARS = [
  { icon: Brain, title: "Socratic coaching", body: "A coach that asks before it explains. You state what you know, what you assume and what you would need to see." },
  { icon: Search, title: "Inference Lab", body: "Spend a limited budget on evidence, keep rival hypotheses alive, and conclude only what the evidence supports." },
  { icon: GitBranch, title: "Scenario trees", body: "Map decisions, responses and contingencies, then let an auditor find the branch you forgot." },
  { icon: Landmark, title: "Historical decisions", body: "Stand where Bismarck or Carnegie stood, with only what they knew. History is cited; counterfactuals are labelled." },
  { icon: Users, title: "The War Room", body: "Five advisers argue about your plan from different angles. They never vote. You decide." },
  { icon: Scale, title: "Honest scoring", body: "Assisted learning is tracked apart from unaided mastery. No IQ numbers, no invented statistics." },
];

const STEPS = [
  { k: "01", title: "Understand", body: "Restate the situation. Separate what you know from what you are assuming." },
  { k: "02", title: "Hypothesise", body: "Record competing explanations or plans, each linked to its evidence and a confidence." },
  { k: "03", title: "Be challenged", body: "The coach presses on your strongest position. You revise, or defend it with evidence." },
  { k: "04", title: "Decide", body: "Commit with a rationale. Only now does the solution or reference analysis unlock." },
  { k: "05", title: "Debrief", body: "Your reasoning is scored against a rubric, citing your own words, and your profile learns." },
];

const MODES = ["Deduction", "Abduction", "Bayesian updating", "Strategic planning", "Negotiation", "Systems thinking", "Adversarial thinking", "Historical analysis", "Intelligence analysis", "Decisions under uncertainty"];

export function LandingPage() {
  return (
    <SmoothScroll>
      <div className="relative min-h-full overflow-x-clip">
        <div className="noise pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        <Header />
        <Hero />
        <Marquee />
        <Process />
        <Pillars />
        <Closing />
        <footer className="relative z-10 border-t border-border px-6 py-10 text-center text-xs text-text-faint">Lunara Strategy Lab · practise thinking, not answers</footer>
      </div>
    </SmoothScroll>
  );
}

function Header() {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      gsap.from(ref.current, { y: -24, opacity: 0, duration: 0.9, delay: 0.2 });
      // Header gains a surface once the page has scrolled.
      gsap.to(ref.current, {
        backgroundColor: "color-mix(in srgb, var(--bg) 78%, transparent)",
        backdropFilter: "blur(14px)",
        borderBottomColor: "var(--border)",
        scrollTrigger: { start: 60, end: 61, toggleActions: "play none none reverse" },
        duration: 0.3,
      });
    },
    { scope: ref },
  );
  return (
    <header ref={ref} className="fixed inset-x-0 top-0 z-30 border-b border-transparent">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="group flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-accent/50">
            <span className="h-2 w-2 rounded-full bg-accent transition-transform duration-500 group-hover:scale-150" />
          </span>
          <span>
            <span className="block font-serif text-lg leading-none">Lunara</span>
            <span className="block text-[10px] uppercase tracking-[0.24em] text-text-faint">Strategy Lab</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link to="/login" className="link-underline px-3 py-2 text-sm text-text-muted hover:text-text">
            Sign in
          </Link>
          <Link to="/signup">
            <Button size="sm">Start training</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      gsap.from(q(".hero-fade"), { y: 20, opacity: 0, duration: 1, stagger: 0.1, delay: 0.7, clearProps: "transform,opacity" });
      // Parallax: compass drifts and scales as the hero scrolls away.
      gsap.to(q(".hero-compass"), { yPercent: 18, scale: 0.92, rotation: 12, ease: "none", scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true } });
      gsap.to(q(".hero-copy"), { yPercent: -12, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ref.current, start: "top top", end: "bottom top", scrub: true } });
    },
    { scope: ref },
  );
  return (
    <section ref={ref} className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl items-center gap-10 px-6 pb-16 pt-28 lg:grid-cols-[1.15fr_1fr]">
      <div className="hero-copy">
        <div className="hero-fade mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-text-muted backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Deliberate reasoning practice
        </div>
        <RevealText className="text-[clamp(2.6rem,6.2vw,5.2rem)] leading-[1.02] tracking-[-0.02em]" delay={0.15}>
          Think like a strategist, an investigator, a negotiator.
        </RevealText>
        <p className="hero-fade mt-7 max-w-xl text-lg leading-relaxed text-text-muted">
          Lunara does not hand you answers. It puts you in a situation, asks what you know, challenges what you assume, and scores how you reasoned, not whether you got lucky.
        </p>
        <div className="hero-fade mt-9 flex flex-wrap items-center gap-3">
          <Magnetic>
            <Link to="/signup">
              <Button size="lg" className="shine">
                Create an account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Magnetic>
          <Link to="/login">
            <Button size="lg" variant="secondary">
              Sign in
            </Button>
          </Link>
        </div>
        <div className="hero-fade mt-10 flex flex-wrap gap-x-8 gap-y-2 text-xs text-text-faint">
          <span>6 coached exercises</span>
          <span>2 investigations</span>
          <span>2 historical simulations</span>
          <span>a monthly master challenge</span>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-[520px]">
        <Compass className="hero-compass h-auto w-full" />
      </div>
      <div className="hero-fade absolute bottom-8 right-6 hidden flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-text-faint lg:flex">
        Scroll
        <span className="scroll-cue block h-10 w-px bg-gradient-to-b from-accent to-transparent" />
      </div>
    </section>
  );
}

function Marquee() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const track = ref.current?.querySelector<HTMLElement>(".marquee-track");
      if (!track) return;
      const tween = gsap.to(track, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
      // Scrolling nudges the marquee faster in the scroll direction, then eases back.
      gsap.timeline({
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            gsap.to(tween, { timeScale: 1 + Math.min(4, Math.abs(self.getVelocity()) / 400) * self.direction, duration: 0.2, overwrite: true });
            gsap.to(tween, { timeScale: 1, duration: 1.2, delay: 0.2, overwrite: false });
          },
        },
      });
    },
    { scope: ref },
  );
  const row = [...MODES, ...MODES];
  return (
    <div ref={ref} className="relative z-10 overflow-hidden border-y border-border bg-bg-elevated/70 py-5 backdrop-blur">
      <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-serif text-2xl text-text-muted">
        {row.map((m, i) => (
          <span key={i} className="flex items-center gap-10">
            {m}
            <span className="h-1.5 w-1.5 rounded-full bg-accent/70" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Pinned sequence: the five phases of a session, advanced by scroll. */
function Process() {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px)", () => {
        const steps = q(".step");
        const tl = gsap.timeline({
          defaults: { ease: EASE.inOut },
          scrollTrigger: { trigger: ref.current, start: "top top", end: `+=${steps.length * 70}%`, pin: true, scrub: 0.6, snap: { snapTo: 1 / (steps.length - 1), duration: 0.4, ease: "power1.inOut" } },
        });
        gsap.set(steps.slice(1), { opacity: 0, y: 40 });
        steps.forEach((step, i) => {
          if (i === 0) return;
          tl.to(steps[i - 1]!, { opacity: 0, y: -40, duration: 0.5 }, i).to(step, { opacity: 1, y: 0, duration: 0.5 }, i);
        });
        tl.fromTo(q(".progress-fill"), { scaleY: 0 }, { scaleY: 1, ease: "none", duration: steps.length - 1 }, 0);
        q(".dot").forEach((dot, i) => tl.to(dot, { backgroundColor: "var(--accent)", scale: 1.4, duration: 0.2 }, i === 0 ? 0 : i));
      });
      mm.add("(max-width: 899px)", () => {
        gsap.from(q(".step"), { y: 30, opacity: 0, stagger: 0.15, scrollTrigger: { trigger: ref.current, start: "top 75%", once: true } });
      });
    },
    { scope: ref },
  );
  return (
    <section ref={ref} className="relative z-10 flex min-h-[100svh] items-center">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.24em] text-accent">How a session works</div>
          <RevealText as="h2" trigger className="mt-4 text-4xl leading-tight md:text-5xl">
            The answer is locked until you have earned it.
          </RevealText>
          <p className="mt-5 max-w-md text-text-muted">The server, not the model, decides when hints and solutions unlock. You cannot talk your way past the reasoning.</p>
        </div>
        <div className="relative flex gap-8">
          <div className="relative hidden w-px bg-border lg:block">
            <div className="progress-fill absolute inset-0 origin-top bg-accent" />
            <div className="absolute -left-[5px] top-0 flex h-full flex-col justify-between">
              {STEPS.map((s) => (
                <span key={s.k} className="dot block h-[11px] w-[11px] rounded-full border border-accent bg-bg" />
              ))}
            </div>
          </div>
          <div className="relative grid w-full lg:min-h-[320px] lg:[&>*]:col-start-1 lg:[&>*]:row-start-1">
            {STEPS.map((s) => (
              <article key={s.k} className="step panel mb-4 p-8 lg:mb-0">
                <div className="font-mono text-sm text-accent">{s.k}</div>
                <h3 className="mt-3 text-3xl">{s.title}</h3>
                <p className="mt-3 text-lg text-text-muted">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 max-w-2xl">
        <div className="text-xs font-medium uppercase tracking-[0.24em] text-accent">One training system</div>
        <RevealText as="h2" trigger className="mt-4 text-4xl leading-tight md:text-5xl">
          Every exercise feeds the same profile.
        </RevealText>
      </div>
      <Reveal onScroll className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.08}>
        {PILLARS.map((p) => (
          <div key={p.title} className="panel card-lift group p-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-110">
              <p.icon className="h-5 w-5 text-accent" />
            </div>
            <h3 className="mt-4 text-xl">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{p.body}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

function Closing() {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      gsap.from(ref.current!.querySelector(".closing-card"), { scale: 0.94, opacity: 0, y: 40, duration: 1.1, scrollTrigger: { trigger: ref.current, start: "top 80%", once: true } });
    },
    { scope: ref },
  );
  return (
    <section ref={ref} className="relative z-10 mx-auto max-w-6xl px-6 pb-28">
      <div className="closing-card panel relative overflow-hidden px-8 py-16 text-center md:px-16">
        <div className="closing-glow pointer-events-none absolute -inset-24 opacity-60" aria-hidden="true" />
        <RevealText as="h2" trigger className="relative mx-auto max-w-2xl text-4xl leading-tight md:text-5xl">
          Ten minutes a day of thinking on purpose.
        </RevealText>
        <p className="relative mx-auto mt-4 max-w-lg text-text-muted">A daily briefing, a puzzle, one review item and one prediction. The rest is there when you want depth.</p>
        <div className="relative mt-8 flex justify-center">
          <Magnetic>
            <Link to="/signup">
              <Button size="lg" className="shine">
                Start training <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Magnetic>
        </div>
      </div>
    </section>
  );
}
