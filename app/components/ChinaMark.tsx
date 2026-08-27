"use client";

// The china-marker stroke — the platform's signature human mark.
// A red grease-pencil gesture drawn over content when a REAL action
// happened (vote cast, idea shortlisted, coach flag). Never decorative.
// Contract: docs/ogilvy-showcase-direction.md ("Signature elements").

import { BRAND } from "@/lib/config";

const PATHS: Record<MarkVariant, { d: string; viewBox: string }> = {
  // Hand-weight ellipse, open at the join like a real grease pencil
  circle: {
    viewBox: "0 0 200 80",
    d: "M128 12 C 60 4, 12 18, 10 40 C 8 62, 58 74, 104 72 C 152 70, 192 58, 190 38 C 188 20, 152 8, 118 10",
  },
  // Confident underline with a slight rise
  underline: {
    viewBox: "0 0 200 20",
    d: "M6 14 C 60 10, 140 8, 194 6",
  },
  // A quick tally slash
  slash: {
    viewBox: "0 0 60 60",
    d: "M12 50 C 24 34, 38 20, 50 8",
  },
  // A boxed select — the grease pencil ruled around a whole frame, drawn
  // in one pass with the waver and corner overshoot of a real hand. Used
  // where a card carries a print: the ellipse squashes on wide, short
  // text and the prints hold circular strokes of their own, but a ruled
  // box marks the WHOLE idea from the perimeter.
  frame: {
    viewBox: "0 0 200 120",
    d: "M8 7 C 60 4, 140 5, 193 6 C 195 40, 194 82, 193 113 C 140 116, 62 115, 7 114 C 5 80, 6 40, 8 7 C 20 6, 34 6, 48 6",
  },
};

type MarkVariant = "circle" | "underline" | "slash" | "frame";

export default function ChinaMark({
  variant = "circle",
  color = BRAND.colors.primary,
  strokeWidth = 5,
  animate = true,
  opacity = 0.9,
  delay = 0,
  className = "",
}: {
  variant?: MarkVariant;
  color?: string;
  strokeWidth?: number;
  animate?: boolean;
  /** Wax translucency — pair with `mix-blend-multiply` on light registers
      so type stays legible under the stroke. */
  opacity?: number;
  /** Seconds to hold before the stroke draws (choreographed reveals). */
  delay?: number;
  className?: string;
}) {
  const { d, viewBox } = PATHS[variant];
  return (
    <svg
      viewBox={viewBox}
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        pathLength={400}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={animate ? "marker-draw" : undefined}
        // Inline dashoffset keeps the stroke invisible through the delay window;
        // the keyframes take over once the animation starts.
        style={{
          opacity,
          ...(animate && delay > 0
            ? { strokeDashoffset: 400, animationDelay: `${delay}s` }
            : {}),
        }}
      />
    </svg>
  );
}
