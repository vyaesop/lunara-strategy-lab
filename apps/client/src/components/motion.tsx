import { useEffect, useRef, type ReactNode } from "react";
import { DUR, EASE, gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/motion";

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/**
 * Headline that reveals line by line from behind a mask. Text stays in the
 * DOM and readable to assistive tech; SplitText re-splits on resize.
 */
export function RevealText({ as: Tag = "h1", children, className, delay = 0, trigger = false }: { as?: "h1" | "h2" | "h3" | "p"; children: ReactNode; className?: string; delay?: number; trigger?: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(
    () => {
      if (!ref.current) return;
      const split = SplitText.create(ref.current, {
        type: "lines,words",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.words, {
            yPercent: 110,
            opacity: 0,
            duration: DUR.slow,
            stagger: 0.035,
            delay,
            ease: EASE.out,
            ...(trigger ? { scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } } : {}),
          }),
      });
      return () => split.revert();
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** Children with `data-reveal` fade up in a stagger when the container mounts or enters view. */
export function Reveal({ children, className, stagger = 0.06, y = 18, onScroll = false, as: Tag = "div" }: { children: ReactNode; className?: string; stagger?: number; y?: number; onScroll?: boolean; as?: "div" | "section" | "ul" }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const items = ref.current?.querySelectorAll<HTMLElement>(":scope > *");
      if (!items?.length) return;
      gsap.from(items, {
        y,
        opacity: 0,
        duration: DUR.base,
        stagger,
        ease: EASE.out,
        clearProps: "transform,opacity",
        ...(onScroll ? { scrollTrigger: { trigger: ref.current, start: "top 88%", once: true } } : {}),
      });
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement & HTMLUListElement>} className={className}>
      {children}
    </Tag>
  );
}

/** Number that counts up to its value when first shown or when it changes. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { n: last.current };
    const tween = gsap.to(obj, {
      n: value,
      duration: DUR.slow,
      ease: EASE.soft,
      onUpdate: () => {
        el.textContent = format(obj.n);
      },
    });
    last.current = value;
    return () => {
      tween.kill();
    };
  }, [value, format]);
  return (
    <span ref={ref} className={cx("tabular-nums", className)}>
      {format(value)}
    </span>
  );
}

/** Route-level entrance: the page slides and fades in; keyed by pathname from the shell. */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(ref.current, { opacity: 0, y: 14, filter: "blur(4px)" }, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.6, ease: EASE.out, clearProps: "filter,transform" });
      const panels = ref.current.querySelectorAll<HTMLElement>(".panel");
      if (panels.length) gsap.from(panels, { y: 16, opacity: 0, duration: 0.6, stagger: 0.045, delay: 0.08, ease: EASE.out, clearProps: "transform,opacity" });
    },
    { scope: ref, dependencies: [routeKey], revertOnUpdate: true },
  );
  return <div ref={ref}>{children}</div>;
}

/** Subtle pointer-follow for primary calls to action. */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    (_, contextSafe) => {
      const el = ref.current;
      if (!el || !contextSafe || window.matchMedia("(pointer: coarse)").matches) return;
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "elastic.out(1, 0.4)" });
      const move = contextSafe((e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      const leave = contextSafe(() => {
        xTo(0);
        yTo(0);
      });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className="inline-block will-change-transform">
      {children}
    </span>
  );
}

export { ScrollTrigger };
