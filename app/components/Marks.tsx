"use client";

// Drawn marks — the showcase's bespoke icon set, in the china-marker
// family (see components/ChinaMark.tsx, the signature stroke). Rules:
// hand-weight strokes (2 at a 24 viewBox), round caps and joins, and
// geometry that wavers slightly — circles that don't quite close, lines
// with a hand's drift. stroke="currentColor" so every mark takes ink,
// white, or red from the type it sits beside. These are marks, not
// illustrations: one confident gesture each, quiet next to the type.
// Contract: docs/ogilvy-showcase-direction.md (sports emoji → drawn marks).

import type { ReactNode } from "react";

type MarkProps = {
  size?: number;
  className?: string;
};

function MarkSvg({
  size = 24,
  className = "",
  children,
}: MarkProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Field glasses — two lens rings, each nearly closed like the
    ChinaMark circle, and the bridge arching the gap. */
export function MarkScout({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 8.2 10.5 C 5.5 9.5, 3 11.2, 2.8 13.8 C 2.6 16.4, 4.6 18.5, 7.1 18.4 C 9.6 18.3, 11.4 16.3, 11.2 13.9 C 11.05 12.4, 10.2 11.2, 9 10.7" />
      <path d="M 16.1 10.5 C 18.7 9.6, 21.1 11.3, 21.2 13.9 C 21.3 16.5, 19.3 18.5, 16.8 18.3 C 14.4 18.1, 12.7 16.2, 12.9 13.8 C 13 12.4, 13.8 11.2, 15 10.7" />
      <path d="M 10.6 11.4 C 11 9.7, 13.1 9.6, 13.5 11.3" />
    </MarkSvg>
  );
}

/** The editor's caret — insert here, and above it the addition.
    What a coach does to your line. */
export function MarkCoach({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 4.7 18.6 C 7 15.7, 9.5 12.6, 11.9 9.9 C 14.3 12.5, 16.7 15.5, 19 18.4" />
      <path d="M 9.5 5.7 C 11.2 5.2, 13.2 5.2, 14.7 5.6" />
    </MarkSvg>
  );
}

/** An open door — the frame in one up-over-down gesture, the leaf
    swung out toward you. WELCOME. */
export function MarkWelcome({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 6.1 20.4 C 5.8 15.2, 5.8 9.4, 6.2 4.8 C 8.6 4.3, 11.9 4.3, 14.2 4.7 C 14.5 9.6, 14.5 15, 14.3 20.3" />
      <path d="M 6.7 5.7 C 10.4 6.7, 14.1 7.7, 17.5 8.7 C 17.7 12.2, 17.7 16.1, 17.5 19.7" />
    </MarkSvg>
  );
}

/** A spark — the hand-drawn asterisk, three strokes crossing almost
    at the center. GENERATE. */
export function MarkGenerate({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 12.3 3.8 C 11.9 6.6, 11.9 9.4, 12 12.1 C 12.1 14.9, 12 17.7, 11.8 20.2" />
      <path d="M 4.9 16.3 C 7.3 14.9, 9.7 13.5, 12.1 12.1 C 14.5 10.6, 16.9 9.2, 19.2 7.9" />
      <path d="M 5 7.7 C 7.4 9.2, 9.8 10.6, 12.2 12 C 14.6 13.4, 16.8 14.9, 19 16.3" />
    </MarkSvg>
  );
}

/** The china-marker check — short drop, long confident sweep. DECIDE. */
export function MarkDecide({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 4.2 13.9 C 6 14.9, 7.9 16.8, 9.2 18.8 C 11.3 14.6, 15.2 8.9, 19.8 5.1" />
    </MarkSvg>
  );
}

/** The editor's kill mark — the china-marker X struck corner to
    corner through work that doesn't make it. You kill an idea, you
    don't file it in a bin. The second diagonal is gone over twice,
    the marker pressed back along the line — that repeated stroke is
    what says "killed", not "close". */
export function MarkKill({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 4.9 5.2 C 7.5 7.8, 10.1 10.4, 12.4 12.8 C 14.7 15.2, 17 17.6, 19.3 19.8" />
      <path d="M 19.4 5 C 16.8 7.6, 14.2 10.2, 11.9 12.6 C 9.7 14.9, 7.4 17.3, 5.1 19.5" />
      <path d="M 20.7 6.9 C 18.2 9.4, 15.7 11.9, 13.4 14.2 C 11.4 16.2, 9.4 18.2, 7.4 20.1" />
    </MarkSvg>
  );
}

/** The wire — a steady line with one pulse crossing it. FOLLOW. */
export function MarkFollow({ size, className }: MarkProps) {
  return (
    <MarkSvg size={size} className={className}>
      <path d="M 2.6 13.4 C 4.7 13.2, 6.8 13.2, 8.9 13.1 L 11 6.6 L 13.2 18.4 L 15 12.8 C 17.1 12.7, 19.3 12.7, 21.4 12.6" />
    </MarkSvg>
  );
}
