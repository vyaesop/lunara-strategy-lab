import { ReactLenis, type LenisRef } from "lenis/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/motion";
import "lenis/dist/lenis.css";

/**
 * Lenis smooth scrolling driven by GSAP's ticker, so ScrollTrigger and Lenis
 * share one frame loop. Disabled for reduced motion. Scroll containers inside
 * the app (transcripts, the tree canvas) opt out with `data-lenis-prevent`.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);
  const location = useLocation();
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    const lenis = lenisRef.current?.lenis;
    lenis?.on("scroll", ScrollTrigger.update);
    return () => {
      gsap.ticker.remove(update);
      lenis?.off("scroll", ScrollTrigger.update);
    };
  }, [reduced]);

  // New route: jump to top instantly, then let triggers re-measure.
  useEffect(() => {
    lenisRef.current?.lenis?.scrollTo(0, { immediate: true });
    if (reduced) window.scrollTo(0, 0);
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [location.pathname, reduced]);

  if (reduced) return <>{children}</>;
  return (
    <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.1, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false }}>
      {children}
    </ReactLenis>
  );
}
