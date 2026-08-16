"use client";

import { motion, useReducedMotion } from "framer-motion";

// docs/outrun/01 — four ambient "living geometry" backgrounds, each a
// full-bleed atmospheric layer (not a corner decoration) sitting behind a
// section's content. All: aria-hidden, pointer-events-none, absolutely
// positioned, mask-faded at the edges so they melt into the page rather
// than reading as a hard-edged panel, and frozen (no drift/rotation,
// static pose only) under prefers-reduced-motion.

const EDGE_MASK = "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent)";

/** Liquid Mesh — several large, softly blurred gradient blobs, each
 * independently morphing shape/position, blended together for an organic,
 * fluid feel. Used behind the hero and other high-energy sections. */
export function LiquidMesh({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const blobs = [
    { color: "var(--color-accent)", size: 42, top: "-10%", left: "-10%", dur: 24 },
    { color: "var(--color-accent-2)", size: 38, top: "10%", left: "60%", dur: 30 },
    { color: "var(--color-accent)", size: 30, top: "55%", left: "20%", dur: 26 },
    { color: "var(--color-accent-2)", size: 34, top: "45%", left: "70%", dur: 22 },
  ];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute opacity-25 blur-3xl"
          style={{
            width: `${b.size}rem`,
            height: `${b.size}rem`,
            top: b.top,
            left: b.left,
            background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
            mixBlendMode: "screen",
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  x: [0, 60, -30, 0],
                  y: [0, -40, 30, 0],
                  scale: [1, 1.15, 0.9, 1],
                  borderRadius: ["50%", "42% 58% 60% 40%", "60% 40% 45% 55%", "50%"],
                }
          }
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

/** Concentric Circles — slowly expanding/rotating ripple rings, like a
 * sonar pulse. Calm and rhythmic; used behind quieter, reflective
 * sections. */
export function ConcentricRings({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const rings = [90, 160, 230, 300, 370];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      <motion.svg
        width="800"
        height="800"
        viewBox="0 0 800 800"
        className="opacity-30"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      >
        {rings.map((r, i) => (
          <motion.circle
            key={r}
            cx="400"
            cy="400"
            r={r}
            fill="none"
            stroke={i % 2 === 0 ? "var(--color-accent)" : "var(--color-accent-2)"}
            strokeWidth="1"
            animate={
              reduceMotion
                ? undefined
                : { opacity: [0.15, 0.5, 0.15], r: [r, r + 14, r] }
            }
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5,
            }}
          />
        ))}
      </motion.svg>
    </div>
  );
}

/** Parametric / Generative Lattice — a fixed (not random, to avoid SSR
 * hydration drift) field of nodes connected by thin lines, each node
 * gently drifting on its own slow cycle — a nod to generative/computational
 * design. Used behind feature/capability sections. */
const LATTICE_NODES = [
  { x: 8, y: 15 }, { x: 22, y: 35 }, { x: 15, y: 62 }, { x: 35, y: 20 },
  { x: 42, y: 55 }, { x: 30, y: 80 }, { x: 58, y: 12 }, { x: 65, y: 42 },
  { x: 52, y: 70 }, { x: 78, y: 25 }, { x: 85, y: 58 }, { x: 70, y: 85 },
  { x: 92, y: 10 }, { x: 95, y: 75 }, { x: 12, y: 90 },
];
const LATTICE_EDGES: [number, number][] = [
  [0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [2, 5], [3, 6], [4, 7], [6, 7],
  [7, 8], [5, 8], [7, 9], [9, 10], [8, 11], [10, 11], [9, 12], [10, 13],
  [11, 13], [2, 14], [5, 14],
];

export function GenerativeLattice({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full opacity-25" preserveAspectRatio="none">
        {LATTICE_EDGES.map(([a, b], i) => (
          <line
            key={i}
            x1={LATTICE_NODES[a]!.x}
            y1={LATTICE_NODES[a]!.y}
            x2={LATTICE_NODES[b]!.x}
            y2={LATTICE_NODES[b]!.y}
            stroke="var(--color-accent-text)"
            strokeWidth="0.15"
          />
        ))}
        {LATTICE_NODES.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x}
            cy={n.y}
            r="0.6"
            fill={i % 3 === 0 ? "var(--color-accent-2)" : "var(--color-accent)"}
            animate={
              reduceMotion
                ? undefined
                : {
                    cx: [n.x, n.x + (i % 2 === 0 ? 1.5 : -1.5), n.x],
                    cy: [n.y, n.y + (i % 3 === 0 ? -1.5 : 1.5), n.y],
                  }
            }
            transition={{
              duration: 8 + (i % 5),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

/** Sacred Geometry (modern) — a "flower of life"-style ring of overlapping
 * circles, rendered thin and faint as a large rotating watermark. Used
 * behind reflective/closing sections (philosophy, FAQ, final CTA). */
export function SacredGeometry({ className = "" }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const petalAngles = [0, 60, 120, 180, 240, 300];
  const r = 90;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      <motion.svg
        width="560"
        height="560"
        viewBox="0 0 400 400"
        className="opacity-20"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 140, repeat: Infinity, ease: "linear" }}
      >
        <circle cx="200" cy="200" r={r} fill="none" stroke="var(--color-accent-2)" strokeWidth="0.8" />
        {petalAngles.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          // Rounded to a fixed precision: raw Math.cos/sin can differ in the
          // last bit between server and client (Node vs browser JS engine),
          // which React's hydration diff treats as a real mismatch.
          const cx = Math.round((200 + r * Math.cos(rad)) * 1000) / 1000;
          const cy = Math.round((200 + r * Math.sin(rad)) * 1000) / 1000;
          return (
            <circle
              key={deg}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="0.6"
            />
          );
        })}
      </motion.svg>
    </div>
  );
}
