import { useRef } from "react";
import { EASE, gsap, useGSAP } from "@/lib/motion";

/**
 * The strategy compass: concentric rings, a decision tree branching from the
 * centre, and nodes that light up in sequence. Drawn with DrawSVG, then it
 * breathes slowly. Purely decorative; hidden from assistive tech.
 */
export function Compass({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      const q = gsap.utils.selector(ref);
      const tl = gsap.timeline({ defaults: { ease: EASE.inOut } });
      tl.from(q(".ring"), { drawSVG: 0, duration: 1.6, stagger: 0.15 })
        .from(q(".tick"), { opacity: 0, scale: 0, transformOrigin: "center", duration: 0.4, stagger: 0.02, ease: "back.out(2)" }, "-=1.0")
        .from(q(".branch"), { drawSVG: 0, duration: 0.9, stagger: 0.08 }, "-=0.6")
        .from(q(".node"), { scale: 0, transformOrigin: "center", duration: 0.5, stagger: 0.06, ease: "back.out(3)" }, "-=0.5")
        .from(q(".core"), { scale: 0, transformOrigin: "center", duration: 0.6, ease: "back.out(2.5)" }, "-=0.4");
      gsap.to(q(".orbit"), { rotation: 360, transformOrigin: "50% 50%", duration: 90, ease: "none", repeat: -1 });
      gsap.to(q(".node-glow"), { opacity: 0.2, duration: 1.6, stagger: { each: 0.4, repeat: -1, yoyo: true }, ease: "sine.inOut" });
    },
    { scope: ref },
  );

  const ticks = Array.from({ length: 48 }, (_, i) => i);
  const nodes = [
    { x: 250, y: 120 },
    { x: 350, y: 180 },
    { x: 150, y: 180 },
    { x: 395, y: 290 },
    { x: 105, y: 290 },
    { x: 300, y: 370 },
    { x: 200, y: 370 },
  ];
  return (
    <svg ref={ref} viewBox="0 0 500 500" className={className} aria-hidden="true" fill="none">
      <defs>
        <radialGradient id="cg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="250" cy="250" r="240" fill="url(#cg)" />
      <g className="orbit">
        <circle className="ring" cx="250" cy="250" r="220" stroke="var(--border-strong)" strokeWidth="1" />
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const r1 = i % 4 === 0 ? 205 : 212;
          return <line key={i} className="tick" x1={250 + Math.cos(a) * r1} y1={250 + Math.sin(a) * r1} x2={250 + Math.cos(a) * 220} y2={250 + Math.sin(a) * 220} stroke="var(--accent)" strokeOpacity={i % 4 === 0 ? 0.8 : 0.35} strokeWidth="1.5" />;
        })}
      </g>
      <circle className="ring" cx="250" cy="250" r="160" stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="2 6" />
      <circle className="ring" cx="250" cy="250" r="95" stroke="var(--border-strong)" strokeWidth="1" />
      {nodes.map((n, i) => (
        <path key={`b${i}`} className="branch" d={`M250 250 Q ${(250 + n.x) / 2 + (i % 2 ? 20 : -20)} ${(250 + n.y) / 2} ${n.x} ${n.y}`} stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="1.5" />
      ))}
      {nodes.map((n, i) => (
        <g key={`n${i}`} className="node">
          <circle className="node-glow" cx={n.x} cy={n.y} r="14" fill="var(--accent)" opacity="0.08" />
          <circle cx={n.x} cy={n.y} r="6" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
        </g>
      ))}
      <circle className="core" cx="250" cy="250" r="14" fill="var(--accent)" />
    </svg>
  );
}
