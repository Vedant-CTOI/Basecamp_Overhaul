"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { GROUP_LIST } from "@/lib/config";

// ============================================================
// TEAM PODS — the v2 team-select mechanic ("The Weighing")
// ============================================================
// Completely different from v1's orbital constellation: three
// tactile neumorphic pods rest in a row like scales on a soft
// tray. Hovering a pod makes it RISE and the other two SINK and
// blur — the row physically weighs your attention. Confirming
// presses the pod DOWN into the tray with a satisfying inset,
// then the room drops away in that team's color.
//
//   Keyboard: ← → cycle, Enter confirms. Tab-native too.
//   Mouse: hover to weigh, click to confirm (or click the CTA).
//   Reduced motion: opacity-only, no tilt/travel.
// ============================================================

export type PodTeam = {
  slug: string;
  name: string;
  color: string;
  platformName: string | null;
  platformBrief: string | null;
};

type Props = {
  ctaLabel: string;
  onLaunch: (slug: string) => void;
  launching: string | null;
  platforms: Record<string, { name?: string | null; brief?: string | null }>;
};

function podInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const yiq = (((n >> 16) & 255) * 299 + (((n >> 8) & 255) * 587) + (n & 255) * 114) / 1000;
  return yiq > 150 ? "#2C2419" : "#FFFFFF";
}

export default function TeamPods({ ctaLabel, onLaunch, launching, platforms }: Props) {
  const reduced = !!useReducedMotion();
  const [focus, setFocus] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const teams: PodTeam[] = GROUP_LIST.map((g) => ({
    slug: g.slug,
    name: g.name,
    color: g.color,
    platformName: platforms[g.slug]?.name ?? null,
    platformBrief: platforms[g.slug]?.brief ?? null,
  }));

  const moveFocus = useCallback((dir: 1 | -1) => {
    setFocus((f) => (f + dir + teams.length) % teams.length);
  }, [teams.length]);

  const confirm = useCallback((i: number) => {
    if (launching || confirmed) return;
    setFocus(i);
    setConfirmed(true);
    onLaunch(teams[i].slug);
  }, [launching, confirmed, onLaunch, teams]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); moveFocus(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); moveFocus(-1); }
      else if (e.key === "Enter") { e.preventDefault(); confirm(focus); }
    };
    el.addEventListener("keydown", onKey);
    el.tabIndex = 0;
    return () => el.removeEventListener("keydown", onKey);
  }, [moveFocus, confirm, focus]);

  const focused = teams[focus];

  return (
    <div
      ref={containerRef}
      className="relative w-full outline-none"
      role="radiogroup"
      aria-label="Choose your team"
    >
      {/* The tray: a soft inset the pods rest in */}
      <div
        className="rounded-[36px] px-8 py-10"
        style={{ background: "var(--g1)", boxShadow: "var(--neo-inset)" }}
      >
        <div className="flex items-stretch justify-center gap-6 flex-wrap">
          {teams.map((team, i) => {
            const isFocused = i === focus;
            const isChoosing = launching && confirmed && isFocused;
            const sink = focus !== i;
            return (
              <motion.button
                key={team.slug}
                role="radio"
                aria-checked={isFocused}
                aria-label={`${team.name}${team.platformName ? ` — ${team.platformName}` : ""}`}
                onClick={() => confirm(i)}
                onMouseEnter={() => setFocus(i)}
                className="pod relative text-left cursor-pointer border-none p-0 bg-transparent focus-visible:outline-none"
                initial={false}
                animate={
                  launching
                    ? isChoosing
                      ? { scale: [1, 0.96, 1.04], opacity: [1, 1, 0] }
                      : { scale: 0.9, opacity: 0.3 }
                    : {
                        y: isFocused ? -14 : 4,
                        scale: isFocused ? 1.03 : 0.97,
                        filter: sink && !reduced ? "blur(1px)" : "blur(0px)",
                        opacity: sink ? 0.75 : 1,
                      }
                }
                transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
              >
                {/* Pod face: raised neumorphic card with the team color as a soft wash */}
                <div
                  className="pod-face relative overflow-hidden"
                  style={{
                    width: 280,
                    borderRadius: 28,
                    background: "var(--card)",
                    boxShadow: isFocused ? "var(--neo-raised)" : "var(--neo-raised-sm)",
                  }}
                >
                  {/* Team color header band — liquid, soft */}
                  <div
                    className="h-[104px] relative"
                    style={{
                      background: `linear-gradient(135deg, ${team.color} 0%, ${team.color}CC 60%, ${team.color}88 100%)`,
                    }}
                  >
                    <motion.div
                      aria-hidden
                      className="absolute rounded-full"
                      style={{ width: 180, height: 180, right: -50, top: -60, background: "rgba(255,255,255,0.14)" }}
                      animate={reduced ? undefined : { y: [0, 8, 0] }}
                      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      aria-hidden
                      className="absolute rounded-full"
                      style={{ width: 100, height: 100, left: -30, bottom: -40, background: "rgba(255,255,255,0.1)" }}
                      animate={reduced ? undefined : { y: [0, -6, 0] }}
                      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <div
                      className="absolute bottom-3 left-5 font-bold text-[26px] tracking-[1px]"
                      style={{ color: podInk(team.color) }}
                    >
                      {team.name}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="px-5 py-5 min-h-[130px]">
                    {team.platformName && (
                      <div className="font-display italic text-[19px] mb-2" style={{ color: "var(--ink)" }}>
                        {team.platformName}
                      </div>
                    )}
                    {team.platformBrief && (
                      <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                        {team.platformBrief}
                      </p>
                    )}
                  </div>

                  {/* Focus ring: gold underline bar */}
                  <motion.div
                    aria-hidden
                    className="absolute left-5 right-5 bottom-0 h-[4px] rounded-t-full"
                    style={{ background: "linear-gradient(90deg,#B78938,#DABF80)" }}
                    animate={{ opacity: isFocused ? 1 : 0, scaleX: isFocused ? 1 : 0.4 }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* The focused CTA below the tray */}
      <AnimatePresence mode="wait">
        {!launching && (
          <motion.div
            key={focused.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="text-center mt-10"
          >
            <motion.button
              onClick={() => confirm(focus)}
              className="soft-btn"
              style={{ padding: "14px 44px", fontSize: 13 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              {ctaLabel} — {focused.name}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launch: tray tips toward the chosen pod, screen washes */}
      <AnimatePresence>
        {launching && confirmed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1] }}
            exit={{ opacity: 1 }}
            className="fixed inset-0 z-[40] pointer-events-none"
            style={{ background: `radial-gradient(circle at 50% 40%, ${focused.color} 0%, #EDE6DC 85%)` }}
            transition={{ duration: 0.7 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
