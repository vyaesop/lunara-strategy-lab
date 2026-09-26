import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, useGSAP);

/** Shared easing vocabulary so motion feels like one system. */
export const EASE = {
  out: "expo.out",
  inOut: "power3.inOut",
  soft: "power2.out",
} as const;

export const DUR = { fast: 0.35, base: 0.7, slow: 1.1 } as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

gsap.defaults({ ease: EASE.out, duration: DUR.base });
// Respect reduced motion globally: every tween completes instantly.
if (prefersReducedMotion()) gsap.globalTimeline.timeScale(1000);

export { gsap, ScrollTrigger, SplitText, useGSAP };
