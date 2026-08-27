"use client";

// ============================================================
// ROUND 7 (REVISED) — THE SHARED CLOCK (LAB ONLY, DO NOT SHIP)
// ============================================================
// This REPLACES the first Round 7 pass. That pass put the clock in
// each surface's header. Two verdicts killed it:
//
//   1. CROWDED. The Board's header strip was already carrying the
//      wordmark, the team chip, the surface name and three nav
//      items. A countdown was the fifth tenant of a strip that had
//      no room for a fourth.
//   2. THE PAPER CHIP WAS SENSELESS. A white chip lifting off the
//      team band at the threshold was a fix for a problem the
//      placement created — red could not live on a team colour, so
//      the design invented a white object to carry the red. Delete
//      the red and the chip has no reason to exist.
//
// And one correction from running real workshops, which reorders
// everything: THE BOARD IS THE PRIMARY SURFACE FOR THIS CLOCK.
// During generation the teams are in separate breakout rooms with
// THEIR OWN BOARD on the screen. The Stage is dark or irrelevant
// then. The clock matters most exactly where the old pass had put
// it most quietly.
//
// ── THE RULING ──────────────────────────────────────────────
//
// A. THE CLOCK IS NOT CHROME. It leaves the nav strip and lands on
//    the HERO BAND, beside the idea count that already lives at the
//    band's right — two live facts about this moment at the same
//    scale: what the room has made, and what it has left. The
//    activity names the moment in the band's own small caps, over
//    the pair, mirroring the TEAM <name> kicker on the left. It
//    reads as the room's wall clock because it has the presence of
//    one, not because it is decorated like one.
//
// B. THE CLOCK IS NEVER RED. Anywhere. The old pass turned the
//    numeral red at two minutes, which forced the chip, which the
//    band rejected. Three reasons the ban is right, not a
//    concession: (1) the clock's home ground is a team colour, and
//    on Touffou's #DA291C a red numeral is invisible — a clock that
//    means two different things on two different teams is two
//    clocks; (2) red is the platform's VOICE — the Kruger, the
//    china-marker, the LIVE chip — and it marks the room's current
//    OBJECT. Time running short is a CONDITION, not an object;
//    (3) the emphasis red was buying is available in the band's own
//    two-colour system and works on every hue.
//
// C. THE THRESHOLD IS WEIGHT, NOT COLOUR — three levers, none of
//    them a hue. At two minutes the numeral goes to FULL-STRENGTH
//    BAND INK and BOLD (white on cobalt and Touffou red, ink on
//    Baskerville's pewter — the band's own text colour, whatever it
//    is); the label under it changes from MIN LEFT to "2 MIN LEFT";
//    and a 3px rule lights under the clock block in that same ink.
//    The rule is the one that carries at distance, and it is the
//    system's own mark — the Stage's active-nav underline (Round 7
//    item 1), which has always meant "this is the one." On a band
//    holding two numerals of identical scale it says which of the
//    two matters right now, which is the entire message. It is the
//    BAND's lever: the Stage header and the turn band have no
//    second number to be confused with, so weight and the
//    unit-word carry those. All of it swaps once on DUR.cut and
//    then HOLDS.
//
// D. ZERO HOLDS ON "Time," in that same treatment, and the label
//    slot empties. No alarm, no pulse, no auto-advance — the
//    facilitator stops the room; the clock only reports. Nothing on
//    this surface moves at zero. That is the whole difference
//    between a clock and a buzzer.
//
// E. "+5" IS A VISIBLE, GENEROUS ACT, rendered in the surface's own
//    ink as a rubber stamp (house signature 5, applied only when
//    the state is real) on the band's label row. The point of the
//    moment is watching the emphasis LEAVE: the numeral drops back
//    to rest weight the instant time is given. Its slot is RESERVED
//    in every state, so a grant costs the band a small permanent
//    gutter instead of repacking the label the moment it lands.
//
// F. MINUTES ONLY, NEVER SECONDS. A per-second numeral would be a
//    SECOND continuously-moving element on a system whose laws
//    reserve that slot for the wire alone (signature element 6),
//    and a countdown you can watch is a countdown the room watches
//    instead of each other. This changes once a minute, and it
//    CUTS.
//
// G. THE STAGE KEEPS A SECONDARY INSTANCE. It earns one in the
//    plenary phases — presenting turns and the ballot — where the
//    room is looking at one screen together. Header-right, 48px
//    serif, same grammar, simplified from the prior pass.
//    Emphasis is SINGLE-TENANT: when a turn clock runs inside an
//    activity, only the turn takes the threshold weight; the
//    activity clock above it holds at rest.
//
// H. THE NEWSROOM INSTANCE IS DROPPED. Nobody watches the Newsroom
//    to learn the time. It watches the Newsroom to learn who is
//    winning. A clock there was placement for its own sake.
//
// Laws observed (docs/ogilvy-showcase-direction.md):
// - The wire is the one continuously moving element; nothing here
//   loops, breathes, or pulses. Ever. Including at zero.
// - Motion is an event: the minute cuts, the threshold swaps once,
//   the +5 stamp arrives on EASE/DUR.beat.
// - Room-facing secondary type ≥48px @1080p — the band numeral is
//   52px, matching the idea count exactly.
// - Big room-facing numerals are Ogilvy Serif with tabular figures;
//   the serif floor (Round 4 item 2, ≥28px) is cleared everywhere
//   the clock now appears, which it was NOT in the header pass.
// - The Kruger bar is not available to the clock (Round 7 item 1):
//   it marks the room's current object, never a condition.
// - The slot RESERVES (Round 13 part 1): the band holds the clock's
//   footprint whether or not an activity is running, so a phase
//   starting never moves the room's screen.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { EASE, DUR } from "@/lib/motion";
import { PAGE_NAMES, PILLAR_LIST, GROUPS } from "@/lib/config";

const STAGE = "#0A0A0C";
const PANEL = "#1B1A1D";
const RED = "#002663";
const INK = "#231F20";
const BODY = "#4a4749";
const HAIR_W = "rgba(255,255,255,0.14)";
const DIM_W = "rgba(255,255,255,0.55)";
const NAV_W = "rgba(255,255,255,0.45)";
const HAIR_I = "rgba(35,31,32,0.15)";
const NAV_I = "#6e6a6c";
const SLUG_DIM = "#8A8689";

/** The four states every placement must survive. */
type ClockState = "running" | "threshold" | "time" | "granted";

// ── What the phase machine would carry ───────────────────────
// LAB ONLY — deliberately NOT added to lib/workshop-phase.ts.
// The facilitator pushes an ABSOLUTE end time once; every surface
// derives its own minutes from it. Nothing counts down locally, so
// three breakout rooms can never disagree — that is what makes it
// a SHARED clock rather than three timers.
export type ActivityClock = {
  /** The activity's name. `null` = nothing running; the clock isn't there. */
  activity: string | null;
  /** ISO instant the activity is due to end. Pushed, never derived client-side. */
  ends_at: string | null;
  /** Minutes granted so far — drives the "+5" acknowledgement, and only that. */
  granted: number;
};

/**
 * Minutes remaining, floored at 0 and CEILED on the way down:
 * "1" holds for the whole final minute and "Time" appears exactly
 * at expiry. A clock that reads 0 while time remains is a lie the
 * room will catch.
 */
export function minutesLeft(endsAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 60000));
}

/** The threshold: two minutes or fewer. Weight, never colour. */
export function isThreshold(mins: number): boolean {
  return mins <= 2 && mins > 0;
}

/** Ink or white on a team hue — the band's existing luminance rule. */
function bandText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq > 128 ? INK : "#fff";
}

/**
 * The grant mark. Mounted in every state and merely transparent when
 * there is no grant, so the layout at 12 min, 2 min, Time and +5 is
 * pixel-identical. Arrives on the house EASE over one beat, then stops
 * — an event that announces new material and gets out of the way.
 * Always the surface's own ink; never red, because red would say the
 * opposite of what a grant means.
 */
function GrantMark({ on, color, size = 10 }: { on: boolean; color: string; size?: number }) {
  return (
    <motion.span
      className="stamp shrink-0"
      style={{ color, fontSize: size }}
      initial={false}
      animate={{ opacity: on ? 1 : 0, y: on ? 0 : 5 }}
      transition={{ duration: DUR.beat, ease: EASE }}
      aria-hidden={!on}
    >
      +5
    </motion.span>
  );
}

// ── A. THE BOARD — the hero band (PRIMARY) ───────────────────
// The reserved footprints, measured rather than guessed. The stamp
// gutter and the block width are constant across all four states.

const STAMP_GUTTER = 40;
const BAND_CLOCK_W = 152;
const LABEL_ROW_H = 17;

function BandClock({ minutes, state, txt }: { minutes: number; state: ClockState; txt: string }) {
  const urgent = state === "threshold" || state === "time";
  const label = state === "time" ? "" : urgent ? `${minutes} min left` : "min left";
  return (
    <div className="text-right relative" style={{ minWidth: BAND_CLOCK_W }}>
      <div
        className="font-display leading-none tabular text-[52px]"
        style={{ color: txt, opacity: urgent ? 1 : 0.9, fontWeight: urgent ? 700 : 400 }}
      >
        {state === "time" ? "Time" : minutes}
      </div>
      <div
        className="flex items-center justify-end gap-2"
        style={{ minHeight: LABEL_ROW_H }}
      >
        <span className="flex justify-end shrink-0" style={{ width: STAMP_GUTTER }}>
          <GrantMark on={state === "granted"} color={txt} />
        </span>
        <span
          className="font-bold text-[13px] tracking-[3px] uppercase leading-none"
          style={{ color: txt, opacity: urgent ? 1 : 0.8 }}
        >
          {label}
        </span>
      </div>
      <BandRule on={urgent} color={txt} />
    </div>
  );
}

/**
 * The third lever, and the one that carries at distance. Weight and a
 * longer label are both real changes, but a 52px serif regular→bold step
 * is a squint apart across a breakout room. This is the system's OWN mark
 * for "this is the active one" — the Stage's 3px rule under active nav
 * (Round 7 item 1) — set in the band's full-strength ink. It marks WHICH
 * of the two facts matters right now, which is the entire message, and it
 * costs no colour, so it works identically on Touffou's red and
 * Baskerville's pewter.
 *
 * It sits IN FLOW, and the idea count carries the same slot permanently
 * transparent — so the pair stays baseline-aligned, the band's 108px never
 * changes, and nothing moves when the rule lands. It swaps once on DUR.cut
 * and then holds.
 */
function BandRule({ on, color }: { on: boolean; color: string }) {
  return (
    <motion.div
      className="mt-[6px] w-full"
      style={{ height: 3, background: color }}
      initial={false}
      animate={{ opacity: on ? 1 : 0 }}
      transition={{ duration: DUR.cut }}
      aria-hidden
    />
  );
}

/**
 * The band. The right cluster is the change: the activity names the
 * moment in the band's small caps, and beneath it the two facts sit
 * at identical scale, parted by a hairline in the band's own ink.
 * `activity = null` renders the cluster with the count alone — the
 * clock is not there, but its footprint is.
 */
function BoardHeroBand({
  teamSlug,
  platform,
  count,
  activity,
  minutes = 0,
  state = "running",
}: {
  teamSlug: keyof typeof GROUPS;
  platform: string;
  count: number;
  activity: string | null;
  minutes?: number;
  state?: ClockState;
}) {
  const group = GROUPS[teamSlug];
  const txt = bandText(group.color);
  return (
    <div
      className="halftone-band h-[108px] flex items-center justify-between px-12"
      style={{ background: group.color }}
    >
      <div className="relative z-10">
        <div
          className="text-[12px] font-bold tracking-[3px] uppercase mb-1.5"
          style={{ color: txt, opacity: 0.85 }}
        >
          Team {group.name}
        </div>
        <h3 className="font-display text-[52px] leading-none" style={{ color: txt }}>
          {platform}
        </h3>
      </div>

      <div className="relative z-10 text-right">
        {/* The activity, in the band's small caps, over the pair —
            the mirror of TEAM <name> on the left. It holds its
            height when nothing is running. */}
        <div
          className="text-[12px] font-bold tracking-[3px] uppercase mb-1.5"
          style={{ color: txt, opacity: 0.85, minHeight: 14 }}
        >
          {activity ?? ""}
        </div>
        <div className="flex items-center justify-end gap-7">
          <div className="text-right">
            <div
              className="font-display text-[52px] leading-none tabular"
              style={{ color: txt }}
            >
              {count}
            </div>
            <div
              className="font-bold text-[13px] tracking-[3px] uppercase leading-none flex items-center justify-end"
              style={{ color: txt, opacity: 0.8, minHeight: LABEL_ROW_H }}
            >
              Ideas
            </div>
            {/* The matching slot, permanently unlit — the pair stays aligned. */}
            <BandRule on={false} color={txt} />
          </div>
          <div className="w-px h-[62px]" style={{ background: txt, opacity: activity ? 0.3 : 0 }} />
          {activity ? (
            <BandClock minutes={minutes} state={state} txt={txt} />
          ) : (
            <div style={{ minWidth: BAND_CLOCK_W }} />
          )}
        </div>
      </div>
    </div>
  );
}

/** The nav strip the clock VACATED — shown so the relief is visible. */
function BoardHeader({ teamSlug }: { teamSlug: keyof typeof GROUPS }) {
  const group = GROUPS[teamSlug];
  return (
    <div
      className="flex items-center justify-between px-12 py-4"
      style={{ background: "#FFFFFF", borderBottom: `1px solid ${HAIR_I}` }}
    >
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/dove-logo-ink.svg" alt="Dove" className="h-[26px]" />
        <div className="w-px h-5" style={{ background: HAIR_I }} />
        <span
          className="px-3 py-1.5 rounded font-bold text-[12px] tracking-[2px] uppercase"
          style={{ border: `2px solid ${group.color}`, color: group.color }}
        >
          {group.name} ▾
        </span>
        <div className="w-px h-5" style={{ background: HAIR_I }} />
        <span className="font-display text-[28px]" style={{ color: INK }}>
          {PAGE_NAMES.teamBoard}
        </span>
      </div>
      <div className="flex items-center gap-6">
        {["Home", PAGE_NAMES.bigBoard, PAGE_NAMES.centerCourt].map((label) => (
          <span
            key={label}
            className="font-bold text-[13px] tracking-[2px] uppercase"
            style={{ color: NAV_I }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── B. THE STAGE — header right (SECONDARY) ──────────────────
// 48px serif, tabular, on the activity label's own baseline. The
// unit-word carries the state change here rather than a second
// line: "12 MIN" → "2 MIN LEFT" → "Time". Inline, a repeated
// numeral ("2 · 2 MIN LEFT") would read as two numbers.

const STAGE_CLOCK_W = 330;

function StageClock({
  activity,
  minutes,
  state,
}: {
  activity: string;
  minutes: number;
  state: ClockState;
}) {
  const urgent = state === "threshold" || state === "time";
  return (
    // A FIXED box: the whole clock occupies STAGE_CLOCK_W in every
    // state, so neither a grant landing, nor "Time" being wider than
    // "2 min", nor an activity starting from nothing can move the nav
    // beside it. Constraint on the phase machine: activity labels stay
    // around ten characters — "Generating", "Presenting", "Coaching".
    <div
      className="flex items-baseline justify-end gap-3 min-h-[48px]"
      style={{ width: STAGE_CLOCK_W }}
    >
      <span className="flex justify-end shrink-0" style={{ width: STAMP_GUTTER }}>
        <GrantMark on={state === "granted"} color="#fff" />
      </span>
      <span className="font-bold text-[13px] tracking-[2px] uppercase" style={{ color: DIM_W }}>
        {activity}
      </span>
      {state === "time" ? (
        <span className="font-display font-bold text-[48px] leading-none text-white">Time</span>
      ) : (
        <>
          {/* Ogilvy Serif carries tabular figures: every two-digit string
              sets to the same width with `.tabular` (without it, "11" is
              32px and "18" is 43px — an 11px jump per minute). Tabular
              pins the digits; the min-width pins the SLOT, so 10 → 9
              doesn't drag the unit sideways. No leading zero: "09" is a
              digital watch, and this isn't one. */}
          <span className="inline-flex justify-end min-w-[58px]">
            <span
              className="font-display text-[48px] leading-none tabular"
              style={{ color: "#FFFFFF", opacity: urgent ? 1 : 0.92, fontWeight: urgent ? 700 : 400 }}
            >
              {minutes}
            </span>
          </span>
          <span
            className="font-bold text-[15px] tracking-[2px] uppercase whitespace-nowrap"
            style={{ color: "#FFFFFF", opacity: urgent ? 1 : 0.55 }}
          >
            {urgent ? "min left" : "min"}
          </span>
        </>
      )}
    </div>
  );
}

function StageHeader({ clock }: { clock?: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-12 py-4 shrink-0"
      style={{ background: STAGE, borderBottom: `1px solid ${HAIR_W}` }}
    >
      <div className="flex items-center gap-4 min-h-[48px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logos/dove-logo-white.svg" alt="Dove" className="h-[34px]" />
        <div className="w-px h-6" style={{ background: HAIR_W }} />
        <span className="font-display text-[28px] text-white">{PAGE_NAMES.centerCourt}</span>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-[13px] font-bold tracking-[2px] uppercase" style={{ color: NAV_W }}>
          Home
        </span>
        <span className="text-[13px] font-bold tracking-[2px] uppercase" style={{ color: NAV_W }}>
          {PAGE_NAMES.bigBoard}
        </span>
        <div className="w-px h-7" style={{ background: HAIR_W }} />
        {/* The slot reserves even when empty — a phase starting must not
            move the room's screen. Same width as the populated clock. */}
        {clock ?? <div className="min-h-[48px]" style={{ width: STAGE_CLOCK_W }} />}
      </div>
    </div>
  );
}

// ── B2. The presenting-turn variant ──────────────────────────
// The turn clock on the team's own colour band, beside NOW
// PRESENTING. Identical grammar to the Board band, one size down to
// the serif floor. No chip: the band's own ink at full strength and
// bold IS the threshold, which is why Touffou now works.

function TurnClock({ minutes, state, txt }: { minutes: number; state: ClockState; txt: string }) {
  const urgent = state === "threshold" || state === "time";
  return (
    <span className="flex items-baseline gap-2.5">
      <span className="flex justify-end shrink-0" style={{ width: STAMP_GUTTER }}>
        <GrantMark on={state === "granted"} color={txt} />
      </span>
      {state === "time" ? (
        <span className="font-display font-bold text-[28px] leading-none" style={{ color: txt }}>
          Time
        </span>
      ) : (
        <>
          <span className="inline-flex justify-end min-w-[34px]">
            <span
              className="font-display text-[28px] leading-none tabular"
              style={{ color: txt, opacity: urgent ? 1 : 0.9, fontWeight: urgent ? 700 : 400 }}
            >
              {minutes}
            </span>
          </span>
          <span
            className="font-bold text-[12px] tracking-[2px] uppercase whitespace-nowrap"
            style={{ color: txt, opacity: urgent ? 1 : 0.75 }}
          >
            {urgent ? "min left" : "min"}
          </span>
        </>
      )}
    </span>
  );
}

function TurnBand({
  teamSlug,
  platform,
  ideas,
  minutes,
  state,
}: {
  teamSlug: keyof typeof GROUPS;
  platform: string;
  ideas: number;
  minutes: number;
  state: ClockState;
}) {
  const group = GROUPS[teamSlug];
  const txt = bandText(group.color);
  return (
    <div
      className="flex items-center gap-4 px-4 py-2 min-h-[52px]"
      style={{ background: group.color }}
    >
      <span className="font-bold text-[18px] tracking-[2px] uppercase" style={{ color: txt }}>
        {group.name}
      </span>
      <span className="text-[14px] tracking-[0.5px]" style={{ color: txt, opacity: 0.8 }}>
        {platform}
      </span>
      <span
        className="font-bold text-[12px] tracking-[2px] uppercase"
        style={{ color: txt, opacity: 0.7 }}
      >
        {ideas} ideas
      </span>
      <span className="ml-auto flex items-center gap-3">
        <span
          className="font-bold text-[15px] tracking-[3px] uppercase whitespace-nowrap"
          style={{ color: txt }}
        >
          Now presenting
        </span>
        <span className="w-px h-6" style={{ background: txt, opacity: 0.35 }} />
        <TurnClock minutes={minutes} state={state} txt={txt} />
      </span>
    </div>
  );
}

// ── The projector pass: the Stage, whole, at 1280×720 ────────

const WALL = [
  { t: "The Apprentice Reel", b: "Every junior ships one produced piece a quarter, reviewed by a partner in front of the floor." },
  { t: "Briefs That Argue Back", b: "The brief carries a written counter-case the team has to beat before the work starts." },
  { t: "The Standing Almanac", b: "One living document of what the agency learned this year, edited in public, cited in every pitch." },
  { t: "Studio Hours", b: "Two hours a week the floor makes something for nobody but itself, and shows it." },
  { t: "The Second Opinion", b: "Every brief gets a rival team's read before it leaves the building." },
  { t: "Proof Over Promise", b: "No deck ships a claim the agency has not already made once, somewhere, for real." },
] as const;

function StageTab({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="px-6 py-2.5 font-bold text-[16px] tracking-[1.5px] uppercase"
      style={{ color: active ? "#fff" : NAV_W, boxShadow: active ? "inset 0 -3px 0 #fff" : "none" }}
    >
      {label}
    </span>
  );
}

function ProjectorFrame() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ width: 1280, height: 720, background: STAGE, border: `1px solid ${HAIR_I}` }}
    >
      <StageHeader clock={<StageClock activity="Presenting" minutes={9} state="running" />} />
      <div
        className="flex items-center px-8 py-2 shrink-0 gap-1"
        style={{ borderBottom: `1px solid ${HAIR_W}` }}
      >
        {PILLAR_LIST.map((p, i) => (
          <StageTab key={p.slug} label={p.label} active={i === 0} />
        ))}
        <span className="ml-auto">
          <StageTab label="The Shortlist" active={false} />
        </span>
      </div>
      <div className="flex-1 px-8 py-6 flex flex-col gap-3 min-h-0">
        <TurnBand teamSlug="group-2" platform="The Well-Informed Unconscious" ideas={7} minutes={2} state="threshold" />
        <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1 min-h-0">
          {WALL.map((c) => (
            <div
              key={c.t}
              className="p-5 h-full"
              style={{ background: PANEL, border: `1px solid ${HAIR_W}`, borderLeftWidth: 4, borderLeftColor: GROUPS["group-2"].color }}
            >
              <h4 className="font-bold text-[22px] leading-[1.25] text-white mb-2">{c.t}</h4>
              <p className="text-[16px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.62)" }}>
                {c.b}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div
        className="h-[52px] flex items-center justify-between px-6 shrink-0"
        style={{ background: STAGE, borderTop: `1px solid ${HAIR_W}` }}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-[14px] tracking-[2px] uppercase text-white">NEW CRAFT</span>
          <span className="font-bold text-[14px] tracking-[2px] uppercase" style={{ color: "#F58E8F" }}>
            · TOUFFOU
          </span>
          <span className="text-[13px] tracking-[1px] uppercase" style={{ color: DIM_W }}>
            Presenting
          </span>
          <span className="text-[12px] tracking-[1px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            → Give them time, or rotate
          </span>
        </div>
        <div className="flex items-center gap-2">
          {["+5 minutes", "Next team"].map((l) => (
            <span
              key={l}
              className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase rounded"
              style={{ border: "1px solid rgba(255,255,255,0.35)", color: "#fff" }}
            >
              {l}
            </span>
          ))}
          <span
            className="px-4 py-2 text-[14px] font-bold tracking-[1px] uppercase rounded"
            style={{ background: RED, border: `1px solid ${RED}`, color: "#fff" }}
          >
            Open the ballot →
          </span>
        </div>
      </div>
    </div>
  );
}

// ── The +5 replay ────────────────────────────────────────────
// Threshold → grant → settle. The whole point is watching the
// emphasis LEAVE, so the replay starts heavy and ends at rest.

type GrantPhase = "threshold" | "granted" | "settled";

function usePlusFive() {
  const [phase, setPhase] = useState<GrantPhase>("granted");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clear, [clear]);

  const replay = useCallback(() => {
    clear();
    setPhase("threshold");
    timers.current.push(setTimeout(() => setPhase("granted"), 900));
    timers.current.push(setTimeout(() => setPhase("settled"), 4400));
  }, [clear]);

  return { phase, replay };
}

// ── The sheet's own chrome ───────────────────────────────────

function Frame({ caption, children, fit }: { caption: string; children: React.ReactNode; fit?: boolean }) {
  return (
    <div className={fit ? "w-fit" : undefined}>
      <p className="slug mb-1.5" style={{ color: SLUG_DIM }}>
        {caption}
      </p>
      <div style={{ border: `1px solid ${HAIR_I}` }}>{children}</div>
    </div>
  );
}

function Placement({
  letter,
  name,
  thesis,
  rules,
  children,
}: {
  letter: string;
  name: string;
  thesis: string;
  rules: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-4 mb-1">
        <span className="font-display font-bold text-[44px] leading-none" style={{ color: RED }}>
          {letter}
        </span>
        <h3 className="font-bold text-[20px]" style={{ color: INK }}>
          {name}
        </h3>
      </div>
      <p className="text-[15px] leading-[1.55] max-w-[860px]" style={{ color: BODY }}>
        {thesis}
      </p>
      <p className="slug mt-1.5 mb-5" style={{ color: SLUG_DIM }}>
        {rules}
      </p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** The four states, for one team, in order. */
function BandStates({
  teamSlug,
  platform,
  count,
  caption,
}: {
  teamSlug: keyof typeof GROUPS;
  platform: string;
  count: number;
  caption: string;
}) {
  const rows: Array<[string, number, ClockState]> = [
    ["RUNNING · 12 MIN", 12, "running"],
    ["THE THRESHOLD · FULL INK, BOLD, THE LABEL SPELLING IT OUT, AND THE RULE LIT UNDER IT", 2, "threshold"],
    ["ZERO · HELD ON “TIME” — NO ALARM, NO AUTO-ADVANCE", 0, "time"],
    ["THE +5 · THE EMPHASIS LEAVES, THE STAMP LANDS IN THE BAND’S OWN INK", 7, "granted"],
  ];
  return (
    <div>
      <p className="font-bold text-[15px] mb-2.5" style={{ color: INK }}>
        {caption}
      </p>
      <div className="flex flex-col gap-4">
        {rows.map(([cap, mins, state]) => (
          <Frame key={cap} caption={cap}>
            <BoardHeroBand
              teamSlug={teamSlug}
              platform={platform}
              count={count}
              activity="Generating"
              minutes={mins}
              state={state}
            />
          </Frame>
        ))}
      </div>
    </div>
  );
}

export default function ClockRound() {
  const { phase, replay } = usePlusFive();
  const liveState: ClockState = phase === "threshold" ? "threshold" : phase === "granted" ? "granted" : "running";
  const liveMinutes = phase === "threshold" ? 2 : 7;

  return (
    <section id="clock-round" className="pt-4">
      <div style={{ borderTop: `2px solid ${INK}` }} className="pt-8 mb-8">
        <p className="slug mb-2" style={{ color: RED }}>
          ROUND 7 (REVISED) · THE SHARED CLOCK · LAB ONLY — DO NOT SHIP
        </p>
        <h2 className="font-display font-bold text-[44px] leading-[1.1] mb-3" style={{ color: INK }}>
          The room&rsquo;s clock belongs on the room&rsquo;s&nbsp;wall.
        </h2>
        <p className="text-[16px] leading-[1.6] max-w-[860px] mb-3" style={{ color: BODY }}>
          The first pass put this in every header, where it was the fifth tenant of a strip already
          holding the wordmark, the team chip, the surface name and three nav items — and it went red
          at the threshold, which forced a white chip to carry the red onto a team colour. The
          correction that reorders everything comes from running the real thing: during generation
          the teams are in separate breakout rooms, each with <em>its own Board</em> on the screen.
          The Stage is dark then. So the clock leaves the chrome and lands on the hero band beside
          the idea count — two live facts about this moment at the same scale, under the activity
          that names it. It reads as the room&rsquo;s wall clock because it has the presence of one.
        </p>
        <p className="text-[16px] leading-[1.6] max-w-[860px] mb-6" style={{ color: BODY }}>
          And it is never red. Red is the platform&rsquo;s voice — the Kruger, the china-marker, the
          LIVE chip — and it marks the room&rsquo;s current <em>object</em>. Time running short is a
          condition. Three levers carry the threshold instead, none of them a hue: the numeral goes
          to full-strength band ink and bold, the label changes from <strong>MIN LEFT</strong> to{" "}
          <strong>2 MIN LEFT</strong>, and a 3px rule lights under the clock in that same ink — the
          Stage&rsquo;s own active-nav mark, saying which of the band&rsquo;s two numbers matters
          right now. All three work identically on Touffou&rsquo;s red and Baskerville&rsquo;s
          pewter, which is what red never could.
        </p>
        <div className="grid grid-cols-4 gap-5 max-w-[1180px]">
          {[
            ["On the band, not the nav", "Beside the idea count, at the same 52px. What the room made, and what it has left."],
            ["Threshold is weight", "Full-strength band ink, bold, the words spelling the number out, and the rule lighting under it. One swap on DUR.cut, then hold."],
            ["Time", "Zero holds on the word and the label empties. No alarm, no pulse, no auto-advance."],
            ["+5", "The emphasis leaves. The grant lands as a stamp in the band's own ink — the room watches time being given."],
          ].map(([h, b]) => (
            <div key={h} style={{ borderTop: `1px solid ${HAIR_I}` }} className="pt-3">
              <p className="font-bold text-[15px] mb-1" style={{ color: INK }}>
                {h}
              </p>
              <p className="text-[14px] leading-[1.5]" style={{ color: BODY }}>
                {b}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── A. THE BOARD BAND ──────────────────────────────── */}
      <Placement
        letter="A"
        name="The Board — on the hero band (the primary instance)"
        thesis="52px Ogilvy Serif with tabular figures, matching the idea count exactly, parted from it by a hairline in the band's own ink. The activity sits above the pair in the band's small caps, mirroring the TEAM name kicker on the left, so the band reads as one sentence about the moment: who this is, what they are doing, what they have made, what they have left. Because the two numbers are deliberately equals, the threshold needs a mark that says which one the room should be looking at — hence the rule, lit under the clock in the band's own ink, in the slot the idea count carries permanently unlit so the pair never shifts. Two hues below, because the treatment has to survive both ends of the luminance rule: Touffou's heritage red, where white is the band's ink and the old red numeral was invisible, and Baskerville's pewter, where the band's ink is #231F20 and 'full-white' correctly means full-strength BLACK."
        rules="52PX SERIF TABULAR · SAME SCALE AS THE COUNT · NO RED ANYWHERE · THRESHOLD = FULL INK + BOLD + LABEL CHANGE + THE RULE · GRANT AND RULE SLOTS RESERVED IN ALL FOUR STATES"
      >
        <BandStates
          teamSlug="group-2"
          platform="The Well-Informed Unconscious"
          count={7}
          caption="Touffou · #DA291C · the case that killed the old treatment"
        />
        <BandStates
          teamSlug="group-3"
          platform="The Red Thread"
          count={5}
          caption="Baskerville · pewter · the band whose own ink is black"
        />

        <div>
          <p className="font-bold text-[15px] mb-2.5" style={{ color: INK }}>
            Hathaway · cobalt · the threshold on the third hue, and the band with nothing running
          </p>
          <div className="flex flex-col gap-4">
            <Frame caption="HATHAWAY · THE THRESHOLD">
              <BoardHeroBand teamSlug="group-1" platform="Sell or Else" count={6} activity="Generating" minutes={2} state="threshold" />
            </Frame>
            <Frame caption="NO ACTIVITY RUNNING · THE CLOCK ISN’T THERE, THE FOOTPRINT STILL IS">
              <BoardHeroBand teamSlug="group-1" platform="Sell or Else" count={6} activity={null} />
            </Frame>
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={replay}
            className="px-4 py-2 text-[13px] font-bold tracking-[1.5px] uppercase cursor-pointer rounded"
            style={{ background: INK, border: `1px solid ${INK}`, color: "#fff" }}
          >
            Replay the +5
          </button>
          <p className="text-[14px]" style={{ color: BODY }}>
            Two minutes and heavy, then the grant lands and the weight goes. That departure is the
            message.
          </p>
        </div>
        <Frame caption="LIVE · THE GRANT AS THE ROOM RECEIVES IT">
          <BoardHeroBand
            teamSlug="group-2"
            platform="The Well-Informed Unconscious"
            count={7}
            activity="Generating"
            minutes={liveMinutes}
            state={liveState}
          />
        </Frame>

        <Frame caption="IN PLACE · THE NAV STRIP IS BACK TO FOUR TENANTS AND CARRIES NO NUMBER">
          <div>
            <BoardHeader teamSlug="group-2" />
            <BoardHeroBand teamSlug="group-2" platform="The Well-Informed Unconscious" count={7} activity="Generating" minutes={2} state="threshold" />
          </div>
        </Frame>
        <p className="slug" style={{ color: SLUG_DIM }}>
          SHIP NOTE · THE BOARD’S QR BUTTON IS ANCHORED bottom-4 right-[140px] AND NOW SITS UNDER THE
          CLOCK — MOVE IT TO THE BAND’S LEFT FOOT WHEN THIS LANDS
        </p>
      </Placement>

      {/* ── B. THE STAGE ───────────────────────────────────── */}
      <Placement
        letter="B"
        name="The Stage — header right (the secondary instance)"
        thesis="The Stage earns a clock in the plenary phases — presenting turns and the ballot — where the room is looking at one screen together. 48px serif on the activity label's own baseline, pinned right, holding a fixed 330×48 box in every state so the nav beside it is measured at the identical pixel. Inline there is no second line, so the unit-word carries the change: 12 MIN → 2 MIN LEFT → Time. The presenting-turn variant keeps its place on the team band and loses the paper chip; the band's own ink at full strength is the threshold, which is exactly why Touffou now works."
        rules="48PX SERIF TABULAR · FIXED 330PX BOX · NO RULE HERE — NO SECOND NUMBER TO CHOOSE BETWEEN · EMPHASIS IS SINGLE-TENANT: THE TURN GOES HEAVY, THE ACTIVITY ABOVE HOLDS"
      >
        <Frame caption="RUNNING · 12 MIN">
          <StageHeader clock={<StageClock activity="Generating" minutes={12} state="running" />} />
        </Frame>
        <Frame caption="THE THRESHOLD · 2 MIN">
          <StageHeader clock={<StageClock activity="Generating" minutes={2} state="threshold" />} />
        </Frame>
        <Frame caption="ZERO · HELD ON “TIME”">
          <StageHeader clock={<StageClock activity="Generating" minutes={0} state="time" />} />
        </Frame>
        <Frame caption="THE PRESENTING TURN · HATHAWAY, RUNNING">
          <TurnBand teamSlug="group-1" platform="Sell or Else" ideas={6} minutes={5} state="running" />
        </Frame>
        <Frame caption="THE PRESENTING TURN · TOUFFOU AT TWO — WHERE THE PAPER CHIP USED TO BE">
          <TurnBand teamSlug="group-2" platform="The Well-Informed Unconscious" ideas={7} minutes={2} state="threshold" />
        </Frame>
      </Placement>

      {/* ── C. DROPPED ─────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-baseline gap-4 mb-1">
          <span className="font-display font-bold text-[44px] leading-none" style={{ color: RED }}>
            C
          </span>
          <h3 className="font-bold text-[20px]" style={{ color: INK }}>
            The Newsroom — dropped
          </h3>
        </div>
        <p className="text-[15px] leading-[1.55] max-w-[860px]" style={{ color: BODY }}>
          The first pass gave the Newsroom a clock beside the LIVE chip. Nobody watches the Newsroom
          to learn the time — they watch it to learn who is winning. It was placement for its own
          sake, and it put a second red 16px from the LIVE dot for no one&rsquo;s benefit. Gone, with
          nothing in its place.
        </p>
      </section>

      {/* ── THE PROJECTOR PASS ─────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-baseline gap-4 mb-1">
          <span className="font-display font-bold text-[44px] leading-none" style={{ color: RED }}>
            ×
          </span>
          <h3 className="font-bold text-[20px]" style={{ color: INK }}>
            The projector pass — 1280&thinsp;×&thinsp;720, one to one
          </h3>
        </div>
        <p className="text-[15px] leading-[1.55] max-w-[860px]" style={{ color: BODY }}>
          The Stage whole, at the size a 720p projector actually paints it, and the case that decides
          the design: Touffou&rsquo;s turn is at two minutes and heavy while the activity clock above
          it holds at rest. Only one thing on a surface can be the thing that matters right now, and
          the emphasis says which. Nothing on this screen is moving.
        </p>
        <p className="slug mt-1.5 mb-5" style={{ color: SLUG_DIM }}>
          NOTE THE CONTROL STRIP: &ldquo;+5 MINUTES&rdquo; IS A SECONDARY ACTION, NEVER THE RED ONE
        </p>
        <Frame fit caption="1280 × 720 · TOUFFOU PRESENTING, TWO MINUTES LEFT ON THE TURN">
          <ProjectorFrame />
        </Frame>
      </section>
    </section>
  );
}
