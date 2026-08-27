"use client";

// ============================================================
// THE STAGE LAB — queue placement study, DO NOT SHIP
// ============================================================
// U1 of docs/plans/2026-08-02-001-refactor-board-stage-newsroom-
// hierarchy-plan.md. The deciding room for ONE question: where do
// the inactive teams go once the active team owns the viewport?
//
//   A · STACKED  — a compact queue band beneath the active field
//   B · SIDE RAIL — a narrow queue column beside it
//
// Same content, same hierarchy, same components in both: only the
// placement changes. Everything around the candidate is the REAL
// shared screen — the Stage header proportions, the live category
// tabs, and the production ControlStrip — so each candidate is
// judged as a whole room-facing screen, never as a detached comp.
//
// RECORDED DIRECTION (2026-08-02, U1 review) — A · THE STACKED QUEUE
// goes to U3. The rail buys a bigger card by deleting a column and
// the room pays in ideas: at 1920×1080 with twelve on the wall the
// stacked field holds nine before the fold and the rail holds six,
// because the 300px it takes off the widest dimension never comes
// back — and that column stands two-thirds empty while two teams
// wait. B is kept here as the rejected option, per the plan.
// Full argument and captures: docs/stage-lab-queue.png.
//
// No Supabase read or write. No production Stage component is
// modified by this route; PillarView is untouched until U3.
//
// Laws observed (docs/ogilvy-showcase-direction.md):
// - ONE Kruger per screen, and it marks the room's CURRENT OBJECT.
//   Proposal on the table here: the overview carries NO Kruger —
//   the active team already owns the whole viewport, so a red bar
//   on its header would mark a team, which Round 7 forbids. The
//   Kruger appears only in idea focus, on the idea the room has
//   opened. (The control strip's red primary is an ACTION, not a
//   Kruger — Round 7 item 2 governs it, unchanged.)
// - Team hue lives in spines, tints and swatches. Room-facing
//   display type is white (projector rule, Round 7 item 5).
// - Motion is an event: cards arrive once, focus enters once.
//   Nothing loops while the room is reading (Round 4, Round 13).
// - Round 9 format law: every print mounts as a FULL 16:9 frame,
//   never cropped, at every size on this screen.
// - Round 4 serif law: serif only as a named numeral moment (the
//   plate's frame number); every idea title is Sans Bold.
//
// FIXTURES: real showcase copy, pooled onto the active team to hit
// the density targets the plan names (5 / 6 mixed / 10+). Prints
// come from the seeded print pool the showcase's own darkroom
// serves. Nothing here is fabricated decorative imagery — the
// text-only ideas get a TYPOGRAPHIC PLATE composed from data the
// idea already carries (U4's first look).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SHOWCASE_IDEAS } from "@/lib/showcase-data";
import { BRAND, GROUPS, GROUP_LIST, PILLARS, PILLAR_LIST, PAGE_NAMES, STATUS_LABELS, type GroupSlug, type PillarSlug } from "@/lib/config";
import { EASE, DUR, BEAT, STAGGER_DENSE } from "@/lib/motion";
import type { Idea } from "@/lib/types";
import PrintReveal from "@/components/PrintReveal";
import ControlStrip from "../center-court/components/ControlStrip";
import type { WorkshopState } from "@/lib/workshop-phase";

// ── Tokens (the Stage's dark register) ───────────────────────
const GROUND = BRAND.colors.surface0;   // #0A0A0C
const CARD = BRAND.colors.surface1;     // #1B1A1D
const HAIRLINE = "rgba(255,255,255,0.14)";
const MUTED = "#a8a5a6";
const QUIET = "#6e6a6c";
const RED = BRAND.colors.primary;

// ── Fixtures ─────────────────────────────────────────────────
// A fresh workshop ships with zero seeded ideas, so the lab builds its
// own fixture rows (same shape the engine produces) instead of reading
// the live store. `withPrint` hangs a pool print on a fixture clone —
// the same pool lib/darkroom serves in showcase mode — so the
// mixed-media cases are real files, never invented art.
const FIXTURE_POOL: Array<Record<string, unknown>> = [
  "Mirror Check", "Receipt Label", "Detox Week", "Filter Decoder",
  "Texture Census", "Parents' Console", "Hundred Skins", "Provenance",
  "Skin Truth", "Confidence Club", "Model Card", "Real Feed",
].map((name, i) => ({
  id: `lab-${String(i + 1).padStart(2, "0")}`,
  team_id: `team-${(i % 3) + 1}`,
  category: ["category_1", "category_2", "category_3"][i % 3],
  name,
  description: `${name} — a lab fixture for layout studies. Not part of any live workshop.`,
  status: i % 3 === 0 ? "starting_lineup" : "coached",
  source: "team", wave: null, bbei_connection: null, key_partners: null,
  link_group: null, gifted_from_team_id: null,
  presenting: false, print_status: null, print_url: null,
  print_options: null, print_source: null, print_note: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}));
const row = (id: string): Idea => {
  const live = SHOWCASE_IDEAS.find((r) => r.id === id);
  if (live) return live as unknown as Idea;
  const idx = parseInt(id.replace(/[^0-9]/g, ""), 10) || 1;
  return FIXTURE_POOL[(idx - 1) % FIXTURE_POOL.length] as unknown as Idea;
};
const withPrint = (id: string, src: string): Idea => ({
  ...row(id),
  print_status: "developed",
  print_url: src,
});

type FixtureKey = "five" | "mixed6" | "dense12";

const FIXTURES: Record<FixtureKey, { label: string; note: string; ideas: Idea[] }> = {
  five: {
    label: "Five ideas",
    note: "The composed case — the density a team usually brings",
    ideas: [
      withPrint("idea-02", "/prints/print-01.png"),
      withPrint("idea-04", "/prints/print-02.png"),
      row("idea-01"),
      row("idea-03"),
      row("idea-05"),
    ],
  },
  mixed6: {
    label: "Six · mixed",
    note: "Three prints, three text-only — the 1280×720 readability bar",
    ideas: [
      withPrint("idea-02", "/prints/print-01.png"),
      withPrint("idea-04", "/prints/print-02.png"),
      withPrint("idea-06", "/prints/print-03.png"),
      row("idea-01"),
      row("idea-03"),
      row("idea-05"),
    ],
  },
  dense12: {
    label: "Twelve",
    note: "The overflow case — the field scrolls, the chrome never moves",
    ideas: [
      withPrint("idea-02", "/prints/print-01.png"),
      withPrint("idea-04", "/prints/print-02.png"),
      withPrint("idea-06", "/prints/print-03.png"),
      withPrint("idea-16", "/prints/print-05.png"),
      withPrint("idea-18", "/prints/print-07.png"),
      row("idea-01"),
      row("idea-03"),
      row("idea-05"),
      row("idea-14"),
      row("idea-13"),
      row("idea-17"),
      row("idea-20"),
    ],
  },
};

// Each team's real board size, for the queue rows.
const TEAM_META: Record<GroupSlug, { platform: string; count: number }> = {
  "group-1": { platform: "Sell or Else", count: 6 },
  "group-2": { platform: "The Well-Informed Unconscious", count: 7 },
  "group-3": { platform: "The Red Thread", count: 6 },
};

// ── The typographic plate (U4's first look) ──────────────────
// An idea with no developed image still has a picture: its own name,
// set. The plate composes only what the idea already carries — frame
// number, title, team, platform, category — and nothing invented.
//
// USER RULING (2026-08-02) — THE TITLE IS THE SAME SIZE ON EVERY STAGE
// CARD, printed or not. The first cut of this plate scaled its type
// with the cell (6.4cqw), so a text-only card's title printed larger
// than a printed card's beside it and larger again in focus. Across a
// wall that reads as an importance ranking that does not exist. Type
// is now a fixed scale the caller passes in; only the GRAPHIC field
// mark — the oversized frame numeral — still sizes itself from the
// cell. What varies is what fills the rest of the cell, never the type.
function StagePlate({
  idea,
  frameNo,
  teamColor,
  teamName,
  platform,
  stamps,
  titlePx = 22,
  slugPx = 12,
}: {
  idea: Idea;
  frameNo: number;
  teamColor: string;
  teamName: string;
  platform: string;
  stamps?: React.ReactNode;
  /** The wall's ONE title size — identical on printed and unprinted cards. */
  titlePx?: number;
  slugPx?: number;
}) {
  const category = PILLARS[idea.category as PillarSlug]?.label ?? "";
  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ containerType: "size", background: "#131215" }}
    >
      {/* Team hue as a tint field — hue tints and spines, never display type */}
      <div className="absolute inset-0" style={{ background: teamColor, opacity: 0.06 }} />

      {/* The named numeral moment — Ogilvy Serif at poster scale, held
          back to a field mark. The one serif on the plate (Round 4). */}
      <span
        className="font-display absolute pointer-events-none select-none tabular"
        style={{ right: "2.5cqw", bottom: "-14cqh", fontSize: "78cqh", lineHeight: 1, color: "#fff", opacity: 0.08 }}
      >
        {String(frameNo).padStart(2, "0")}
      </span>

      <div className="relative h-full flex flex-col px-5 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="slug" style={{ color: QUIET, fontSize: slugPx }}>№</span>
          <span className="font-bold tabular" style={{ color: "rgba(255,255,255,0.7)", fontSize: slugPx + 2, lineHeight: 1 }}>
            {String(frameNo).padStart(2, "0")}
          </span>
          <span
            className="font-bold uppercase"
            style={{ color: "rgba(255,255,255,0.45)", fontSize: slugPx, letterSpacing: "0.16em", marginLeft: 8 }}
          >
            {category}
          </span>
          {stamps && <span className="ml-auto shrink-0">{stamps}</span>}
        </div>

        <h3
          className="font-bold text-white line-clamp-2 mt-2"
          style={{ fontSize: titlePx, lineHeight: 1.15, letterSpacing: "-0.015em", textWrap: "balance" }}
        >
          {idea.name}
        </h3>

        <div className="mt-auto flex items-center gap-2.5 pt-3">
          <span className="shrink-0" style={{ width: 10, height: 10, background: teamColor }} />
          <span className="slug truncate" style={{ color: "rgba(255,255,255,0.6)", fontSize: slugPx }}>
            {teamName} · {platform}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── The Stage card ───────────────────────────────────────────
// Every card in the field is the same footprint, printed or not, so
// the wall reads as one sequence. A printed idea splits into a content
// well and its FULL 16:9 frame; an unprinted idea gives the whole cell
// to the plate — its name IS the picture, so nothing is repeated and
// no card ever shows an empty media hole (R10).
// One card height for the whole field, derived so the 16:9 frame takes
// ~49% of the card and the content well keeps ~196px at the narrowest
// column the grid will build (380px) — above the ~170px floor where
// the card lab recorded titles breaking mid-word.
const CARD_ASPECT = "3.6 / 1";

function StageStamps({ idea }: { idea: Idea }) {
  return (
    <span className="flex items-center gap-2">
      {idea.status === "starting_lineup" && (
        <span className="stamp" style={{ color: RED }}>{STATUS_LABELS.starting_lineup}</span>
      )}
      {idea.status === "coached" && (
        <span className="stamp" style={{ color: "rgba(255,255,255,0.72)" }}>{STATUS_LABELS.coached}</span>
      )}
    </span>
  );
}

function StageCard({
  idea,
  frameNo,
  teamColor,
  teamName,
  platform,
  onOpen,
}: {
  idea: Idea;
  frameNo: number;
  teamColor: string;
  teamName: string;
  platform: string;
  onOpen: () => void;
}) {
  const hasPrint = idea.print_status === "developed" && !!idea.print_url;
  const shortlisted = idea.status === "starting_lineup";

  return (
    <div
      onClick={onOpen}
      className="group flex rounded-md overflow-hidden cursor-pointer"
      style={{
        aspectRatio: CARD_ASPECT,
        background: CARD,
        // The select is the frame — a shortlisted card's own border
        // turns red, printed or not (the shipped rule, unchanged).
        border: shortlisted ? `2px solid ${RED}` : `1px solid ${HAIRLINE}`,
      }}
    >
      <div className="shrink-0 w-1" style={{ background: teamColor }} />

      {hasPrint ? (
        <>
          {/* The content well — what the room reads while it looks */}
          <div className="flex-1 min-w-0 flex flex-col px-4 py-2.5">
            <div className="flex items-baseline gap-1.5">
              <span className="slug" style={{ color: QUIET }}>№</span>
              <span className="font-bold text-[14px] leading-none tabular" style={{ color: "rgba(255,255,255,0.66)" }}>
                {String(frameNo).padStart(2, "0")}
              </span>
              <span className="ml-auto">
                <StageStamps idea={idea} />
              </span>
            </div>
            <h3 className="font-bold text-[22px] leading-[1.15] text-white tracking-[-0.015em] line-clamp-2 mt-2">
              {idea.name}
            </h3>
          </div>
          {/* The picture — height-driven so the 16:9 frame is exact and
              can never be cropped by the column beside it (Round 9). */}
          <div className="shrink-0 h-full relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
            <PrintReveal src={idea.print_url!} alt={`Image — ${idea.name}`} />
          </div>
        </>
      ) : (
        <div className="flex-1 min-w-0 h-full">
          {/* 22px — the SAME title size the printed card above uses. The
              plate changes what fills the cell, never the type scale. */}
          <StagePlate
            idea={idea}
            frameNo={frameNo}
            teamColor={teamColor}
            teamName={teamName}
            platform={platform}
            stamps={<StageStamps idea={idea} />}
            titlePx={22}
          />
        </div>
      )}
    </div>
  );
}

// ── The queue row ────────────────────────────────────────────
// ONE component, two placements. Same content and the same hierarchy
// in both: team name first, creative platform second, idea count
// third, and an always-visible "present next" affordance — the
// operator must never have to hover to find the handoff.
function QueueRow({
  slug,
  layout,
  onSelect,
}: {
  slug: GroupSlug;
  layout: "stacked" | "rail";
  onSelect: () => void;
}) {
  const group = GROUPS[slug];
  const meta = TEAM_META[slug];
  const rail = layout === "rail";

  return (
    <button
      onClick={onSelect}
      data-qa="queue-row"
      className={`group/q w-full flex text-left transition-colors cursor-pointer ${rail ? "flex-col gap-1.5 px-3.5 py-3" : "items-center gap-4 px-4 py-2"}`}
      style={{ background: "transparent", border: `1px solid ${HAIRLINE}`, borderLeft: `4px solid ${group.color}` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span className={`flex items-baseline gap-3 min-w-0 ${rail ? "" : "shrink-0"}`}>
        <span className="font-bold text-[16px] tracking-[2px] uppercase text-white whitespace-nowrap">
          {group.name}
        </span>
        <span className="font-bold text-[13px] tabular whitespace-nowrap" style={{ color: QUIET }}>
          {meta.count} ideas
        </span>
      </span>
      <span
        className={`text-[14px] truncate ${rail ? "" : "min-w-0 flex-1"}`}
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {meta.platform}
      </span>
      <span
        className={`font-bold text-[12px] tracking-[2px] uppercase whitespace-nowrap px-2.5 py-1 rounded ${rail ? "self-start mt-0.5" : "ml-auto"}`}
        style={{ color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.28)" }}
      >
        Present next →
      </span>
    </button>
  );
}

function QueueHeading({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-baseline gap-3 ${className}`}>
      <span className="font-bold text-[12px] tracking-[3px] uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>
        Waiting to present
      </span>
      <span className="slug" style={{ color: QUIET }}>
        select a team to give it the floor
      </span>
    </div>
  );
}

// ── The idea focus state ─────────────────────────────────────
// Temporary and local: it opens OVER the active-team overview and
// closes back onto the same overview. The Kruger lives here — this
// idea is the room's current object — and the control strip stays
// live beneath it, so the operator never loses the room.
function FocusLayer({
  idea,
  frameNo,
  total,
  teamColor,
  teamName,
  platform,
  onPrev,
  onNext,
  onClose,
}: {
  idea: Idea;
  frameNo: number;
  total: number;
  teamColor: string;
  teamName: string;
  platform: string;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const hasPrint = idea.print_status === "developed" && !!idea.print_url;
  const category = PILLARS[idea.category as PillarSlug]?.label ?? "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.cut, ease: EASE }}
      data-qa="focus"
      className="absolute inset-0 z-20 flex flex-col"
      style={{ background: "rgba(10,10,12,0.94)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DUR.beat, ease: EASE }}
        className="flex-1 min-h-0 flex items-center gap-8 px-10 py-6"
      >
        {/* The picture — the full frame, contained, never cropped. With
            no developed image the plate takes the same frame and carries
            the name, so the reading column drops the title rather than
            printing it twice. */}
        <div className="flex-[0_0_56%] min-w-0 relative overflow-hidden" style={{ aspectRatio: "16 / 9", border: `1px solid ${HAIRLINE}` }}>
          {hasPrint ? (
            <PrintReveal src={idea.print_url!} alt={`Image — ${idea.name}`} />
          ) : (
            /* Focus is one object, not a wall: the plate's title matches
               the printed focus headline beside it, not the card scale. */
            <StagePlate idea={idea} frameNo={frameNo} teamColor={teamColor} teamName={teamName} platform={platform} titlePx={44} slugPx={14} />
          )}
        </div>

        {/* The reading column */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* THE ONE KRUGER — it marks the idea the room has open */}
          <div className="kruger-bar inline-flex self-start items-center gap-3 px-3 py-1.5 mb-4">
            <span className="text-[13px] tracking-[3px] uppercase">On the Stage</span>
            <span className="text-[13px] tabular" style={{ color: "rgba(255,255,255,0.85)" }}>
              № {String(frameNo).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>

          {hasPrint && (
            <h2
              className="font-bold text-white leading-[1.05] tracking-[-0.015em]"
              style={{ fontSize: "clamp(34px, 2.9vw, 56px)", textWrap: "balance" }}
            >
              {idea.name}
            </h2>
          )}
          {idea.description && (
            <p
              className={hasPrint ? "mt-4" : ""}
              style={{ color: "rgba(255,255,255,0.78)", fontSize: hasPrint ? "clamp(15px, 1.1vw, 21px)" : "clamp(17px, 1.25vw, 24px)", lineHeight: 1.5, maxWidth: "58ch", textWrap: "pretty" }}
            >
              {idea.description}
            </p>
          )}

          <div className="flex items-center gap-3 mt-5">
            <span style={{ width: 12, height: 12, background: teamColor }} />
            <span className="slug" style={{ color: "rgba(255,255,255,0.62)", fontSize: 12 }}>
              {teamName} · {platform} · {category}
            </span>
          </div>

          <div className="flex items-center gap-2.5 mt-auto pt-6">
            <button
              className="px-4 py-2 text-[13px] font-bold tracking-[1px] uppercase rounded cursor-pointer"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.45)", color: "#fff" }}
            >
              ☆ Shortlist
            </button>
            <button
              className="px-4 py-2 text-[13px] font-bold tracking-[1px] uppercase rounded cursor-pointer"
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.28)", color: MUTED }}
            >
              Set aside
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onPrev}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-none text-[22px]"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
              >
                ‹
              </button>
              <button
                onClick={onNext}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer border-none text-[22px]"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
              >
                ›
              </button>
              <button
                onClick={onClose}
                className="ml-1 px-4 py-2 text-[13px] font-bold tracking-[1px] uppercase rounded cursor-pointer"
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.28)", color: "#fff" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── The lab ──────────────────────────────────────────────────
type QueueKey = "stacked" | "rail";

const NOOP = () => {};

export default function StageLabPage() {
  const [queue, setQueue] = useState<QueueKey>("stacked"); // default: stacked keeps the width for mixed 16:9 cards
  const [fixture, setFixture] = useState<FixtureKey>("mixed6");
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [activeTeam, setActiveTeam] = useState<GroupSlug>("group-1");
  const [chrome, setChrome] = useState(true);

  // URL params drive the lab so the review script can capture named
  // states deterministically: ?queue=&fixture=&state=&team=&chrome=0
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get("queue");
    if (q === "stacked" || q === "rail") setQueue(q);
    const f = p.get("fixture");
    if (f === "five" || f === "mixed6" || f === "dense12") setFixture(f);
    const t = p.get("team");
    if (t === "group-1" || t === "group-2" || t === "group-3") setActiveTeam(t);
    if (p.get("state") === "focus") setFocusIndex(Number(p.get("idea") ?? 0));
    if (p.get("chrome") === "0") setChrome(false);
  }, []);

  // Keyboard, in the /atmosphere-lab convention
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1") setQueue("stacked");
      if (e.key === "2") setQueue("rail");
      if (e.key === "5") setFixture("five");
      if (e.key === "6") setFixture("mixed6");
      if (e.key === "0") setFixture("dense12");
      if (e.key === "h") setChrome((c) => !c);
      if (e.key === "Escape") setFocusIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ideas = FIXTURES[fixture].ideas;
  const group = GROUPS[activeTeam];
  const meta = TEAM_META[activeTeam];
  const inactive = GROUP_LIST.filter((g) => g.slug !== activeTeam);
  const pillarLabel = PILLARS[PILLAR_LIST[0].slug].label;

  const workshopState = useMemo<WorkshopState>(
    () => ({ pillar: PILLAR_LIST[0].slug, team: activeTeam, view: "pillar", voting_open: false, show_counts: false }),
    [activeTeam],
  );

  const move = useCallback(
    (dir: -1 | 1) => setFocusIndex((i) => (i == null ? i : (i + dir + ideas.length) % ideas.length)),
    [ideas.length],
  );

  const field = (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col">
      {/* Active-team header — the section header of the room's own
          screen. NO Kruger: the viewport itself is the mark. Hue is
          the spine; the name is white (projector rule). */}
      <div className="shrink-0 flex items-center gap-5 px-8 pt-4 pb-3">
        <div className="shrink-0 self-stretch w-[6px]" style={{ background: group.color }} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-4">
            <h2 className="font-bold text-white text-[26px] tracking-[2px] uppercase leading-none">{group.name}</h2>
            <span className="text-[17px] truncate" style={{ color: "rgba(255,255,255,0.62)" }}>
              {meta.platform}
            </span>
          </div>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="font-bold text-[13px] tracking-[2px] uppercase tabular" style={{ color: MUTED }}>
              {ideas.length} {ideas.length === 1 ? "idea" : "ideas"} on the stage
            </span>
            <span className="slug" style={{ color: QUIET }}>
              showing all — none selected yet
            </span>
          </div>
        </div>
        <span className="ml-auto font-bold text-[14px] tracking-[3px] uppercase" style={{ color: "rgba(255,255,255,0.75)" }}>
          Now presenting
        </span>
      </div>

      {/* The work area — the ONLY thing that scrolls. The grid is
          width-driven, not count-driven: one card floor (380px) that
          keeps the content well above the truncation threshold, and
          the column count falls out of whatever width the candidate
          queue leaves behind. */}
      <div data-qa="stage-field" className="flex-1 min-h-0 overflow-y-auto px-8 pb-5">
        <div
          className="grid gap-3.5"
          // The floor is a card that still reads (380px); above that the
          // column grows with the room's screen, so a projector gets
          // bigger frames rather than more empty ground.
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(max(380px, 30vw), 1fr))" }}
        >
          {ideas.map((idea, i) => (
            <motion.div
              key={`${idea.id}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.beat, ease: EASE, delay: BEAT.content + i * STAGGER_DENSE }}
            >
              <StageCard
                idea={idea}
                frameNo={i + 1}
                teamColor={group.color}
                teamName={group.name}
                platform={meta.platform}
                onOpen={() => setFocusIndex(i)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const queueRows = inactive.map((g) => (
    <QueueRow key={g.slug} slug={g.slug} layout={queue} onSelect={() => setActiveTeam(g.slug)} />
  ));

  return (
    <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: GROUND }}>
      {/* ── Header — the real Stage proportions ── */}
      <header
        className="flex items-center justify-between px-12 py-4 shrink-0"
        style={{ background: "#0A0A0C", borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div className="flex items-center gap-4">
          <img src="/logos/dove-logo-white.svg" alt="Dove" className="h-[34px]" />
          <div className="w-px h-6" style={{ background: HAIRLINE }} />
          <span className="font-display text-[28px] text-white">{PAGE_NAMES.centerCourt}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="slug" style={{ color: RED }}>
            Stage Lab · {queue === "stacked" ? "A · Stacked queue" : "B · Side rail"} · Mock — do not ship
          </span>
        </div>
      </header>

      {/* ── Category tabs — the real navigation, real proportions ── */}
      <div className="flex items-center px-8 py-2 shrink-0 gap-1" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        {PILLAR_LIST.map((p, i) => {
          const isActive = i === 0;
          return (
            <span
              key={p.slug}
              className="px-6 py-2.5 font-bold text-[16px] tracking-[1.5px] uppercase"
              style={{
                color: isActive ? "#fff" : "rgba(255,255,255,0.45)",
                boxShadow: isActive ? "inset 0 -3px 0 #fff" : "none",
              }}
            >
              {p.label}
            </span>
          );
        })}
        <span className="px-5 py-2.5 font-bold text-[16px] tracking-[1.5px] uppercase ml-auto" style={{ color: "rgba(255,255,255,0.45)" }}>
          ★ The full shortlist
        </span>
      </div>

      {/* ── The candidate ── */}
      <div className="flex-1 min-h-0 relative">
        {queue === "stacked" ? (
          <div className="absolute inset-0 flex flex-col">
            {field}
            {/* A · THE STACKED QUEUE — a compact band beneath the field.
                Fixed: it never scrolls with the ideas. */}
            <div
              data-qa="queue"
              className="shrink-0 px-8 py-2.5"
              style={{ background: "#0E0D10", borderTop: `1px solid ${HAIRLINE}` }}
            >
              <QueueHeading className="mb-1.5" />
              <div className="flex flex-col gap-1">{queueRows}</div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex">
            {field}
            {/* B · THE SIDE RAIL — a narrow queue column beside the field */}
            <aside
              data-qa="queue"
              className="shrink-0 w-[300px] px-4 py-4 flex flex-col gap-3"
              style={{ background: "#0E0D10", borderLeft: `1px solid ${HAIRLINE}` }}
            >
              <QueueHeading className="flex-col !items-start gap-1" />
              <div className="flex flex-col gap-2">{queueRows}</div>
            </aside>
          </div>
        )}

        <AnimatePresence>
          {focusIndex != null && ideas[focusIndex] && (
            <FocusLayer
              idea={ideas[focusIndex]}
              frameNo={focusIndex + 1}
              total={ideas.length}
              teamColor={group.color}
              teamName={group.name}
              platform={meta.platform}
              onPrev={() => move(-1)}
              onNext={() => move(1)}
              onClose={() => setFocusIndex(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── The production Control Strip, unmodified ── */}
      <div data-qa="control-strip" className="shrink-0">
      <ControlStrip
        workshopState={workshopState}
        pillarLabel={pillarLabel}
        teamName={group.name}
        teamColor={group.color}
        votingEnabled
        selectedCount={0}
        totalVoters={0}
        totalParticipants={12}
        onOpenVoting={NOOP}
        onCloseVoting={NOOP}
        onShowCounts={NOOP}
        onAdvanceToLineup={NOOP}
        onNextTeam={NOOP}
        onNextPillar={NOOP}
        onShowFullLineup={NOOP}
        onBenchSelected={NOOP}
        onCombineSelected={NOOP}
        onLinkSelected={NOOP}
        combining={false}
        onBackToPresenting={NOOP}
        isLastPillar={false}
      />
      </div>

      {/* ── Lab chrome (never part of the candidate) ── */}
      {chrome && (
        <aside
          className="fixed right-5 top-1/2 -translate-y-1/2 z-[300] w-[228px] p-2"
          style={{ background: "rgba(10,10,12,0.92)", border: "1px solid rgba(255,255,255,0.22)" }}
        >
          <div className="px-2 pt-1.5 pb-2.5">
            <div className="text-[9px] font-bold uppercase tracking-[0.28em]" style={{ color: RED }}>
              Stage Lab — do not ship
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
              1 / 2 · 5 / 6 / 0 · H hides
            </div>
          </div>

          <LabGroup label="Queue placement">
            <LabButton on={queue === "stacked"} onClick={() => setQueue("stacked")} name="A · Stacked" note="Recorded direction for U3" k="1" />
            <LabButton on={queue === "rail"} onClick={() => setQueue("rail")} name="B · Side rail" note="Rejected — kept on record" k="2" />
          </LabGroup>

          <LabGroup label="Density">
            {(Object.keys(FIXTURES) as FixtureKey[]).map((k) => (
              <LabButton
                key={k}
                on={fixture === k}
                onClick={() => { setFixture(k); setFocusIndex(null); }}
                name={FIXTURES[k].label}
                note={FIXTURES[k].note}
                k={k === "five" ? "5" : k === "mixed6" ? "6" : "0"}
              />
            ))}
          </LabGroup>

          <LabGroup label="State">
            <LabButton on={focusIndex == null} onClick={() => setFocusIndex(null)} name="Overview" note="The active team's field" />
            <LabButton on={focusIndex != null} onClick={() => setFocusIndex(0)} name="Idea focus" note="One idea, temporary" />
          </LabGroup>

          <p className="px-2 pt-2 pb-1 text-[9px] leading-[1.5]" style={{ color: "rgba(255,255,255,0.38)" }}>
            Fixtures pool real showcase copy onto the active team; prints come from the seeded pool. No Supabase, no
            workshop state, no production Stage component touched.
          </p>
        </aside>
      )}
    </div>
  );
}

function LabGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.34)" }}>
        {label}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function LabButton({
  on,
  onClick,
  name,
  note,
  k,
}: {
  on: boolean;
  onClick: () => void;
  name: string;
  note: string;
  k?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex items-center gap-2.5 border px-2.5 py-2 text-left cursor-pointer transition-colors"
      style={{
        borderColor: on ? "rgba(235,63,67,0.86)" : "rgba(255,255,255,0.08)",
        background: on ? "rgba(235,63,67,0.16)" : "rgba(255,255,255,0.025)",
      }}
    >
      {k && (
        <span
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full border text-[9px] font-bold"
          style={{ borderColor: on ? "rgba(235,63,67,0.82)" : "rgba(255,255,255,0.18)", color: on ? "#F5BAC5" : "rgba(255,255,255,0.42)" }}
        >
          {k}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white">{name}</span>
        <span className="mt-0.5 block truncate text-[9px]" style={{ color: "rgba(255,255,255,0.46)" }}>
          {note}
        </span>
      </span>
    </button>
  );
}
