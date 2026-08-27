"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { GROUP_LIST } from "@/lib/config";

// ============================================================
// THE CONSTELLATION — Dove Real Intelligence team select
// ============================================================
// A fresh mechanic for this engagement: the three teams hang in a
// deep-navy field as luminous orbs — "stars of the real" — joined by
// slow-drawn constellation lines into the shape of the Dove mark's
// spirit: three points, one sky.
//
// MECHANICS (deliberately different from any previous edition):
//   · Keyboard: ← → move focus between stars; Enter confirms.
//   · Mouse/touch: hover or tap focuses a star; a second tap (or the
//     revealed CTA) confirms and launches.
//   · Focus is VISIBLE state, not just scale: the focused star blooms
//     (ring + halo + platform name), the other two dim and drift back.
//   · The animated gold dove travels along the constellation line from
//     the previously-focused star to the newly-focused one — the room
//     watches the choice travel.
//
// Reduced motion: all drift/flight stops; focus becomes opacity only.
// ============================================================

export type ConstellationTeam = {
  slug: string;
  name: string;
  color: string;
  platformName: string | null;
  platformBrief: string | null;
};

type Props = {
  headline: string;
  ctaLabel: string;
  onLaunch: (slug: string) => void;
  launching: string | null;
  platforms: Record<string, { name?: string | null; brief?: string | null }>;
};

// Star positions as fractions of the stage box — a wide triangle,
// slightly asymmetric so it reads composed rather than diagrammatic.
const STARS = [
  { x: 0.26, y: 0.30 }, // group-1
  { x: 0.74, y: 0.26 }, // group-2
  { x: 0.50, y: 0.62 }, // group-3 — kept clear of the detail plate
];

function starText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + (n & 255) * 114) / 1000;
  return yiq > 140 ? "#101623" : "#FFFFFF";
}

/** The traveling dove: an SVG bird gliding a straight path between two
    star anchors. `flightKey` changes restart the animation. */
function TravelingDove({
  from, to, flightKey, reduced,
}: { from: { x: number; y: number }; to: { x: number; y: number }; flightKey: number; reduced: boolean }) {
  if (reduced) return null;
  return (
    <motion.svg
      key={flightKey}
      viewBox="0 0 32 32"
      className="absolute z-[6] pointer-events-none"
      style={{ width: 44, height: 44, marginLeft: -22, marginTop: -22 }}
      initial={{ left: `${from.x * 100}%`, top: `${from.y * 100}%`, opacity: 0 }}
      animate={{
        left: `${to.x * 100}%`,
        top: `${to.y * 100}%`,
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1], times: [0, 0.15, 0.8, 1] }}
    >
      {/* Gold dove silhouette in flight */}
      <path
        d="M3 18c3-5 7-8 12-9l4-5 2 4 6 1-5 3c1 4-1 8-5 10l3 5-6-3-6 2 2-5c-3-1-5-2-7-3z"
        fill="#DABF80"
      />
    </motion.svg>
  );
}

export default function TeamConstellation({ headline, ctaLabel, onLaunch, launching, platforms }: Props) {
  const reduced = !!useReducedMotion();
  const [focus, setFocus] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [doveFlight, setDoveFlight] = useState(0);
  const prevFocus = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const teams: ConstellationTeam[] = GROUP_LIST.map((g) => ({
    slug: g.slug,
    name: g.name,
    color: g.color,
    platformName: platforms[g.slug]?.name ?? null,
    platformBrief: platforms[g.slug]?.brief ?? null,
  }));

  const moveFocus = useCallback((dir: 1 | -1) => {
    setFocus((f) => {
      const next = (f + dir + teams.length) % teams.length;
      prevFocus.current = f;
      setDoveFlight((k) => k + 1);
      return next;
    });
  }, [teams.length]);

  const focusStar = useCallback((i: number) => {
    if (i === focus) return;
    prevFocus.current = focus;
    setFocus(i);
    setDoveFlight((k) => k + 1);
  }, [focus]);

  const confirm = useCallback((i: number) => {
    if (launching || confirmed) return;
    if (i !== focus) { focusStar(i); return; }
    setConfirmed(true);
    onLaunch(teams[i].slug);
  }, [launching, confirmed, focus, focusStar, onLaunch, teams]);

  // Keyboard: arrows move, enter confirms, tab is left native.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveFocus(1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveFocus(-1); }
      else if (e.key === "Enter") { e.preventDefault(); confirm(focus); }
    };
    el.addEventListener("keydown", onKey);
    el.tabIndex = 0;
    return () => el.removeEventListener("keydown", onKey);
  }, [moveFocus, confirm, focus]);

  const launchColor = teams[focus].color;

  return (
    <div
      ref={containerRef}
      className="relative w-full outline-none"
      style={{ height: "min(58vh, 520px)" }}
      role="radiogroup"
      aria-label="Choose your team"
    >
      {/* The sky: slow nebula drift behind everything */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 55% 45% at ${STARS[focus].x * 100}% ${STARS[focus].y * 100}%, ${teams[focus].color}26, transparent 70%),
            radial-gradient(ellipse 40% 35% at 20% 80%, #366AA51a, transparent 70%),
            radial-gradient(ellipse 40% 35% at 85% 15%, #B7893814, transparent 70%)`,
          transition: "background 1.2s ease",
        }}
      />

      {/* Constellation lines: drawn between all three stars; the two
          lines touching the focused star brighten */}
      <svg aria-hidden className="absolute inset-0 w-full h-full z-[1] pointer-events-none">
        {STARS.map((a, i) =>
          STARS.slice(i + 1).map((b, j) => {
            const k = i + j + 1;
            const touchesFocus = i === focus || k === focus;
            return (
              <line
                key={`${i}-${k}`}
                x1={`${a.x * 100}%`} y1={`${a.y * 100}%`}
                x2={`${b.x * 100}%`} y2={`${b.y * 100}%`}
                stroke={touchesFocus ? "#DABF80" : "#366AA5"}
                strokeOpacity={touchesFocus ? 0.55 : 0.14}
                strokeWidth={touchesFocus ? 1.6 : 1}
                strokeDasharray={reduced ? undefined : "6 10"}
                style={{ transition: "stroke 0.8s ease, stroke-opacity 0.8s ease" }}
              />
            );
          }),
        )}
      </svg>

      {/* The dove flying the focused edge */}
      <TravelingDove
        from={STARS[prevFocus.current]}
        to={STARS[focus]}
        flightKey={doveFlight}
        reduced={reduced}
      />

      {/* Stars */}
      {teams.map((team, i) => {
        const isFocused = i === focus;
        const dimmed = !isFocused && focus !== -1;
        return (
          <motion.button
            key={team.slug}
            role="radio"
            aria-checked={isFocused}
            aria-label={`${team.name}${team.platformName ? ` — ${team.platformName}` : ""}`}
            className="absolute z-[5] rounded-full cursor-pointer border-0 bg-transparent p-0 -translate-x-1/2 -translate-y-1/2 focus-visible:outline-none"
            style={{ left: `${STARS[i].x * 100}%`, top: `${STARS[i].y * 100}%` }}
            initial={false}
            animate={
              launching
                ? confirmed && isFocused
                  ? { scale: [1, 1.18, 0.0], opacity: [1, 1, 0] }
                  : { scale: 0.6, opacity: 0.25 }
                : { scale: isFocused ? 1 : 0.82, opacity: dimmed ? 0.75 : 1 }
            }
            transition={{ duration: launching ? 0.9 : 0.5, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => focusStar(i)}
            onClick={() => confirm(i)}
          >
            {/* Halo */}
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: 300, height: 300,
                background: `radial-gradient(circle, ${team.color}40 0%, ${team.color}00 65%)`,
                opacity: isFocused ? 1 : 0,
                transition: "opacity 0.7s ease",
              }}
            />
            {/* Breathing ring (focused only, unless reduced motion) */}
            {!reduced && isFocused && !launching && (
              <motion.span
                aria-hidden
                className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
                style={{
                  width: 190, height: 190, marginLeft: -95, marginTop: -95,
                  border: `1.5px solid ${team.color}`,
                }}
                animate={{ scale: [1, 1.28], opacity: [0.7, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            {/* The orb */}
            <span
              className="relative block rounded-full flex items-center justify-center"
              style={{
                width: isFocused ? 168 : 132,
                height: isFocused ? 168 : 132,
                background: `radial-gradient(circle at 34% 30%, ${team.color}F2 0%, ${team.color} 46%, #061024 130%)`,
                boxShadow: isFocused
                  ? `0 0 60px ${team.color}66, inset 0 0 34px rgba(255,255,255,0.14)`
                  : `0 0 22px ${team.color}33`,
                border: `1px solid ${isFocused ? "#DABF80AA" : "rgba(218,191,128,0.25)"}`,
                transition: "width 0.55s cubic-bezier(0.22,1,0.36,1), height 0.55s cubic-bezier(0.22,1,0.36,1), box-shadow 0.55s ease",
              }}
            >
              <span
                className="font-bold uppercase text-center px-3"
                style={{
                  fontSize: isFocused ? 21 : 15,
                  letterSpacing: 2,
                  color: starText(team.color),
                  textShadow: "0 1px 12px rgba(0,0,0,0.45)",
                  transition: "font-size 0.55s cubic-bezier(0.22,1,0.36,1)",
                }}
              >
                {team.name}
              </span>
            </span>
          </motion.button>
        );
      })}

      {/* Focus detail plate — the focused star's platform, bottom center */}
      <AnimatePresence mode="wait">
        {!launching && (
          <motion.div
            key={teams[focus].slug}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-1/2 -translate-x-1/2 z-[8] text-center"
            style={{ bottom: "-20px", width: "min(92%, 720px)", background: "radial-gradient(ellipse at center, rgba(6,8,15,0.88) 0%, rgba(6,8,15,0.55) 60%, transparent 100%)" }}
          >
            {teams[focus].platformName && (
              <div className="font-display italic text-[22px]" style={{ color: "#FFFFFF" }}>
                {teams[focus].platformName}
              </div>
            )}
            {teams[focus].platformBrief && (
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
                {teams[focus].platformBrief}
              </p>
            )}
            <button
              onClick={() => confirm(focus)}
              disabled={!!launching}
              className="mt-4 px-8 py-3 rounded-full font-bold text-[13px] tracking-[2px] uppercase cursor-pointer border transition-all duration-300"
              style={{
                background: launchColor,
                borderColor: "#DABF80",
                color: starText(launchColor),
                boxShadow: "0 6px 30px rgba(0,38,99,0.5)",
              }}
            >
              {ctaLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launch flash: the whole sky washes in the chosen team's light */}
      <AnimatePresence>
        {launching && confirmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 1] }}
            className="absolute inset-0 z-[20] pointer-events-none rounded-[inherit]"
            style={{ background: `radial-gradient(circle at ${STARS[focus].x * 100}% ${STARS[focus].y * 100}%, ${launchColor} 0%, #0A1220 78%)` }}
            transition={{ duration: 0.9, times: [0, 0.55, 1] }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
