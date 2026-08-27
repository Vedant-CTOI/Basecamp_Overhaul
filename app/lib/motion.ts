// ─────────────────────────────────────────────────────────────
// The house motion grammar — single source of truth.
// Derived from the settled reference: components/CoachTakeover.tsx
// (the coaching-room arrival). Motion is an event: it marks arrival,
// reveal, and decision — never ambient decoration.
//
// Every page-level entrance speaks the same three-beat sequence:
//   beat 1 · STRUCTURE — the frame arrives (header slides down)
//   beat 2 · HERO      — the marquee lands or the rule draws itself
//   beat 3 · CONTENT   — the working surface settles in
//   detail · tiles/rows stagger at the house interval
//
// Rules and seams DRAW themselves (scale from an origin), then settle
// to a hairline — they never wipe the screen. Arrivals decelerate
// (EASE); departures accelerate (EASE_EXIT). No bounce, no elastic.
// ─────────────────────────────────────────────────────────────

/** Arrival ease — every entrance beat. (CoachTakeover's EASE.) */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Departure ease — accelerating exits. (The portal zoom's leave.) */
export const EASE_EXIT = [0.62, 0, 0.9, 0.4] as const;

export const DUR = {
  /** State swaps, veils, overlay fades. */
  cut: 0.25,
  /** One arrival beat. */
  beat: 0.5,
  /** A rule drawing itself. */
  draw: 0.55,
  /** A drawn rule settling to a hairline. */
  settle: 1.4,
} as const;

/** Where a drawn rule rests — present, no longer speaking. */
export const SEAM_REST = 0.25;

/** Detail cadence — tiles, medallions, dots. */
export const STAGGER = 0.08;

/** Long lists — ballot rows, feed items. */
export const STAGGER_DENSE = 0.04;

/** Page-arrival beat map: delays from mount. */
export const BEAT = {
  structure: 0.1,
  hero: 0.28,
  content: 0.5,
  detail: 0.66,
} as const;
