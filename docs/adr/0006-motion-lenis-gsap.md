# ADR-0006: Motion system with Lenis and GSAP

- Status: Accepted
- Date: 2026-09-26

## Context

The owner asked for the app to feel as polished as possible using Lenis
(smooth scrolling) and GSAP (animation). The product is a serious training
tool, so motion must clarify hierarchy and state, never slow work down, and
must respect users who prefer reduced motion.

## Decision

- **One frame loop.** Lenis is driven by `gsap.ticker` (`autoRaf: false`) and
  feeds `ScrollTrigger.update`, so smooth scroll and scroll-linked animation
  never drift apart (`components/smooth-scroll.tsx`).
- **Shared vocabulary.** `lib/motion.ts` registers ScrollTrigger, SplitText,
  DrawSVG and the React hook once and defines easing and duration tokens
  (`expo.out` for entrances, `power3.inOut` for sequences).
- **Components, not ad-hoc tweens.** `components/motion.tsx` provides
  `RevealText` (SplitText masked line reveal, used by every page title),
  `Reveal` (staggered children), `CountUp`, `PageTransition` (route entrance
  plus panel stagger) and `Magnetic` (pointer-follow for primary CTAs, off on
  touch). `components/compass.tsx` is the drawn brand illustration.
- **Landing page as the showcase.** Split-text hero, DrawSVG compass with
  parallax, a velocity-reactive marquee, a pinned and snapped five-step
  "how a session works" sequence (desktop; a simple stagger on phones), and
  scroll-triggered pillars and closing card.
- **Inside the app, restraint.** Route transitions, staggered panels, a
  gliding active pill in the sidebar, an animated mobile sheet, count-up stats
  and score bars that fill on view. No motion blocks input.
- **Opt-outs.** Inner scroll areas and canvases (transcripts, the reader, the
  tree and knowledge graphs, the sidebar) carry `data-lenis-prevent`.
- **Reduced motion.** When `prefers-reduced-motion: reduce` is set, Lenis is
  not mounted, GSAP's global timeline runs at 1000x (every tween completes
  immediately, final states are correct), and CSS transitions and keyframes
  are neutralised.
- **Licensing.** GSAP 3.13+ is free under its standard licence including the
  former Club plugins (SplitText, DrawSVG). Lenis is MIT.

## Consequences

- About 60 kB gzipped of animation code on first load; route chunks keep the
  rest of the app lazy.
- SplitText rewrites heading DOM but keeps an accessible label, so role-based
  tests and screen readers still see the original text.
- E2E runs with animations on; the suite caps Playwright at two workers to
  keep timing stable on modest machines.
