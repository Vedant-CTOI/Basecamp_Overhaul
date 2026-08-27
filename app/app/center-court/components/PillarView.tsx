"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Idea, Team } from "@/lib/types";
import { GROUPS, GROUP_LIST, PILLARS, BRAND, IMAGE_VOCAB as V, withAlpha, heldBackTint, type PillarSlug, type Wave } from "@/lib/config";
import { type WorkshopState } from "@/lib/workshop-phase";
import { ideaNumbers, ideaNo, qualifiedIdeaNo } from "@/lib/idea-number";
import { teamStageIdeas, presentedInCategory } from "@/lib/present-gate";

/** The Stage card's own ground — named because the held-back hue tint
    is solved AGAINST it, so the two must never drift apart. */
const CARD_GROUND = "#1B1A1D";
import type { VoteCounts } from "../hooks/useCenterCourtData";
import PrintReveal from "@/components/PrintReveal";
import StageIdeaPlate from "@/components/StageIdeaPlate";

interface PillarViewProps {
  pillarSlug: PillarSlug;
  ideas: Idea[];                       // already scoped to this pillar, all teams
  teams: Team[];
  spotlightTeam: string | null;        // the presenting turn
  onSpotlightTeam: (teamSlug: string) => void;
  workshopState: WorkshopState;
  voteCounts: VoteCounts;
  totalVoters: number;
  totalParticipants: number;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onBench: (id: string) => void;
  onUnbench: (id: string) => void;
  onPromote: (id: string) => void;
  onDemote: (id: string) => void;
  onSetWave: (id: string, wave: Wave | null) => void;
  onOpenIdea: (idea: Idea) => void;
  onAddIdea?: (teamSlug: string, name: string, description: string) => void;
  combining?: boolean;
  newlyCreatedId?: string | null;
}

// Projector-optimized transitions (tween, not spring — springs look glitchy on projectors)
const EASE_STANDARD = [0.2, 0, 0, 1] as [number, number, number, number]; // MD3 standard
const EASE_ENTER = [0.05, 0.7, 0.1, 1] as [number, number, number, number]; // MD3 emphasized decelerate
const TWEEN_STANDARD = { type: "tween" as const, duration: 0.4, ease: EASE_STANDARD };
const TWEEN_ENTER = { type: "tween" as const, duration: 0.35, ease: EASE_ENTER };
const TWEEN_EXIT = { type: "tween" as const, duration: 0.25, ease: [0.3, 0, 0.8, 0.15] as [number, number, number, number] };
const STAGGER_DELAY = 0.04;

// ═══════════════════════════════════════════════════════════════
// THE ACTIVE-TEAM FIELD (U3 — the stacked queue composition)
// ═══════════════════════════════════════════════════════════════
// The presenting Stage gives the whole viewport to the team that is
// speaking; the teams waiting collapse into a compact selectable band
// beneath it (the U1 deciding room chose stacked over a side rail —
// the rail permanently spends ~300px of the widest dimension on a
// mostly-empty column). Everything below serves that one branch;
// voting, the returns, the bench and the shortlist views are untouched.
//
// THE FIELD PLANS ITSELF. U1 left one problem open: a five- or six-idea
// grid built from a fixed card size leaves the lower third of a 1080p
// wall empty. So the field does not lay out from a fixed card — it
// measures its own box and picks the (columns × row height) pair that
// FILLS the wall with the fewest, biggest cards the anatomy allows.
// The card's height is the row's height; the 16:9 print is height-driven
// off it and the content well takes what is left. Two guards keep the
// anatomy honest at every size: the well never drops below WELL_MIN,
// and the print never takes more than PRINT_SHARE_MAX of the card. When
// nothing fits — ten-plus ideas at laptop size — the plan takes the
// least overflow and the work area scrolls.
const FIELD_GAP = 14;
/** The content well's floor. Below ~170px the card lab recorded titles breaking mid-word. */
const WELL_MIN = 200;
/** The print is the loudest thing on the card, never the whole card. */
const PRINT_SHARE_MAX = 0.6;
const PRINT_AR = 16 / 9;
/** A column narrower than this cannot hold a well AND a print worth projecting. */
const CARD_MIN_W = 360;
/** Absolute floor: padding + slug line + two title lines. */
const CARD_H_MIN = 96;
/** …and a card never runs flatter than this share of its own width. */
const CARD_FLAT = 5.2;
const CARD_TALL = 2.5;
const MAX_COLS = 4;

export interface FieldPlan {
  columns: number;
  cardHeight: number;
  /** THE wall's one title size. Every card wears it — printed or not. */
  titlePx: number;
  descPx: number;
  descLines: number;
  slugPx: number;
  fits: boolean;
}

export function planField(width: number, height: number, count: number): FieldPlan {
  let pick: { columns: number; cardHeight: number; used: number; fits: boolean } | null = null;

  if (width > 0 && height > 0 && count > 0) {
    for (let c = 1; c <= MAX_COLS; c++) {
      const w = (width - (c - 1) * FIELD_GAP) / c;
      if (c > 1 && w < CARD_MIN_W) break;
      const rows = Math.ceil(count / c);
      const hMin = Math.max(CARD_H_MIN, w / CARD_FLAT);
      const hMax = Math.min(w / CARD_TALL, (w - WELL_MIN) / PRINT_AR, (w * PRINT_SHARE_MAX) / PRINT_AR);
      if (hMax < hMin) continue;
      // The height that would fill the box exactly, clamped into the
      // band the anatomy allows.
      const h = Math.max(hMin, Math.min(hMax, (height - (rows - 1) * FIELD_GAP) / rows));
      const used = rows * h + (rows - 1) * FIELD_GAP;
      const cand = { columns: c, cardHeight: h, used, fits: used <= height + 1 };
      if (!pick) { pick = cand; continue; }
      // A layout that fits always beats one that does not. Among those
      // that fit, take the one that fills the most wall (fewest columns,
      // biggest cards); among those that do not, the least overflow.
      if (cand.fits !== pick.fits) { if (cand.fits) pick = cand; continue; }
      if (cand.fits ? cand.used > pick.used : cand.used < pick.used) pick = cand;
    }
  }

  const columns = pick?.columns ?? 3;
  const cardHeight = pick?.cardHeight ?? 150;

  // Type is derived ONCE for the whole field, so every card carries the
  // same title size. USER RULING 2026-08-02: a title that scales to fill
  // its own cell reads as an importance ranking across the wall, and no
  // such ranking exists. What varies between a printed card and a plate
  // is what fills the cell — never the type scale.
  const titlePx = Math.max(20, Math.min(40, Math.round(cardHeight * 0.17)));
  const descPx = Math.max(13, Math.min(20, Math.round(titlePx * 0.55)));
  const slugPx = Math.max(11, Math.min(15, Math.round(titlePx * 0.42)));
  // Whatever the title and slug leave is the description's — measured,
  // not guessed, so a line is never sliced through the middle.
  const spare = cardHeight - 22 - (slugPx + 8) - (titlePx * 1.15 * 2 + 8);
  const descLines = Math.max(0, Math.min(4, Math.floor(spare / (descPx * 1.45))));

  return { columns, cardHeight, titlePx, descPx, descLines, slugPx, fits: pick?.fits ?? true };
}

// ── The Stage card — ONE anatomy, two fills ──────────────────
// Every card on the wall is the same footprint and carries the same
// furniture: frame number, stamps, title, description. A PRINTED idea
// splits into a content well and its full, uncropped 16:9 frame. An
// UNPRINTED idea gives the whole cell to the typographic plate —
// composed only from data the idea already carries, with its own frame
// numeral enlarged into a field mark behind the type. No card is ever
// an empty media hole, and nothing decorative is invented (R10).
//
// U4: the plate is no longer written here. It is the shared
// `components/StageIdeaPlate` — one implementation, mounted identically
// on this wall, on the full shortlist, and in the picture region of the
// open card in presentation mode. The wall passes it the field's ONE
// title size, and no team line: the active-team header already names
// whose wall this is.
function StageCard({
  idea,
  plan,
  frameNo,
  teamColor,
  isSelected,
  isCombining,
  isNewlyCombined,
  onToggleSelect,
  onPromote,
  onDemote,
  onOpen,
}: {
  idea: Idea;
  plan: FieldPlan;
  /** The idea's stable №. The active-team wall is one team's, so it prints bare. */
  frameNo?: number;
  teamColor: string;
  isSelected: boolean;
  isCombining?: boolean;
  isNewlyCombined?: boolean;
  onToggleSelect: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onOpen: () => void;
}) {
  const isStartingLineup = idea.status === "starting_lineup";
  const isDeveloping = idea.print_status === "developing";
  const hasPrint = idea.print_status === "developed" && !!idea.print_url;
  const sheetReady = idea.print_status === "developed" && !!idea.print_options?.length && !idea.print_url;
  const { titlePx, descPx, descLines, slugPx } = plan;

  // The stamps and flags a card carries — one set, whichever fill the
  // card wears, so a shortlisted plate and a shortlisted print say the
  // same thing in the same place.
  const stamps = (
    <>
      {isNewlyCombined && (
        <span className="stamp ml-2" style={{ color: BRAND.colors.primary, fontSize: slugPx }}>✦ COMBINED</span>
      )}
      {!isNewlyCombined && isStartingLineup && (
        <span className="stamp ml-2" style={{ color: BRAND.colors.primary, fontSize: slugPx }}>SHORTLISTED</span>
      )}
      {/* Darkroom process facts stay quiet flags, never second stamps */}
      {(isDeveloping || sheetReady) && (
        <span
          className="inline-flex items-center gap-1.5 ml-2 font-bold uppercase tracking-[0.14em] whitespace-nowrap"
          style={{ color: "#6B5D4A", fontSize: slugPx }}
        >
          {isDeveloping ? (
            <span className="w-2.5 h-2.5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#8A7A62" }} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
          )}
          {isDeveloping ? V.workingFlag : V.readyFlag}
        </span>
      )}
    </>
  );

  // The two controls the operator needs on a card, compacted into the
  // corner so they cost the field no height: the shortlist toggle
  // (always visible — it is the Stage's verb) and the multi-select box
  // (on hover, feeding the Control Strip). They are chrome ON the fill,
  // so they mount identically over a well and over a plate.
  const controls = (
    <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
      <button
        onClick={(e) => { e.stopPropagation(); isStartingLineup ? onDemote() : onPromote(); }}
        title={isStartingLineup ? "Shortlisted — click to remove" : "Shortlist this idea"}
        aria-label={isStartingLineup ? "Remove from the shortlist" : "Shortlist this idea"}
        aria-pressed={isStartingLineup}
        className="w-6 h-6 flex items-center justify-center rounded cursor-pointer leading-none transition-colors"
        style={{
          background: isStartingLineup ? BRAND.colors.primary : "transparent",
          border: isStartingLineup ? `1px solid ${BRAND.colors.primary}` : "1px solid rgba(255,255,255,0.24)",
          color: isStartingLineup ? "#fff" : "rgba(255,255,255,0.62)",
          fontSize: 13,
        }}
      >
        {isStartingLineup ? "★" : "☆"}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        aria-label="Select for a Control Strip action"
        className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        style={{
          borderColor: isSelected ? teamColor : "rgba(107,93,74,0.25)",
          background: isSelected ? teamColor : "transparent",
          opacity: isSelected ? 1 : undefined,
        }}
      >
        {isSelected && (
          <svg width="10" height="10" viewBox="0 0 20 20"><path d="M4 10l4 4 8-8" fill="none" stroke="#fff" strokeWidth={3} /></svg>
        )}
      </button>
    </div>
  );

  const well = (
    // Centred, not top-set: when the plan gives the card more height
    // than the type needs, the block sits in the middle of its own cell
    // rather than stranding the spare under it.
    <div className="relative flex-1 min-w-0 h-full flex flex-col justify-center px-4 py-2.5">
      <div className="flex items-baseline gap-1.5 pr-14">
        {/* USER RULING 2026-08-03 — the numbers come down one step. The
            numeral sat at slugPx + 2, a size above every stamp beside it;
            it now rides AT the slug register (glyph one under), so the
            wall's hierarchy is title → stamps → number, not the reverse. */}
        {frameNo != null && (
          <span data-qa="idea-no" className="flex items-baseline gap-1.5">
            <span className="slug" style={{ color: "#8A7A62", fontSize: slugPx - 1 }}>№</span>
            <span className="font-bold tabular" style={{ color: "rgba(255,255,255,0.66)", fontSize: slugPx, lineHeight: 1 }}>
              {ideaNo(frameNo)}
            </span>
          </span>
        )}
        {stamps}
      </div>

      {/* THE wall's one title size — identical on every card, printed or not */}
      <h3
        className="font-bold text-[#2C2419] line-clamp-2 mt-2"
        style={{ fontSize: titlePx, lineHeight: 1.15, letterSpacing: "-0.015em", textWrap: "balance" }}
      >
        {idea.name}
      </h3>

      {descLines > 0 && idea.description && (
        <p
          className="mt-1.5 overflow-hidden"
          style={{
            color: "#6B5D4A",
            fontSize: descPx,
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: descLines,
          }}
        >
          {idea.description}
        </p>
      )}

      {controls}
    </div>
  );

  return (
    <motion.div
      onClick={onOpen}
      // The card is the room's own button: opening an idea has to be
      // reachable from the keyboard, or focus can never return to it
      // when the focus state closes.
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
      aria-label={`Open ${idea.name}`}
      exit={{ opacity: 0, scale: 0.95, transition: TWEEN_EXIT }}
      data-qa="stage-card"
      data-fill={hasPrint ? "print" : "plate"}
      className="group h-full flex rounded-md overflow-hidden cursor-pointer relative"
      style={{
        background: isNewlyCombined ? withAlpha(BRAND.colors.primary, 0.08) : CARD_GROUND,
        // THE SELECT IS THE FRAME — a shortlisted card's own border turns red
        border: isNewlyCombined
          ? `2px solid ${BRAND.colors.primary}`
          : isSelected && isCombining
          ? `2px dashed ${teamColor}`
          : isSelected
          ? `2px solid ${teamColor}`
          : isStartingLineup
          ? `2px solid ${BRAND.colors.primary}`
          : "1px solid rgba(107,93,74,0.22)",
        animation: isSelected && isCombining ? "pulse 1.5s ease-in-out infinite" : undefined,
      }}
    >
      {/* The hue marker, held back. Every card on the active-team field
          belongs to the SAME team, so this stroke identifies nothing the
          header has not already said — it is a tint, not a signal. At
          full strength six to twelve of them turned the wall into
          wallpaper. The header spine, the queue spines and the shortlist
          team bands keep full strength — those DO distinguish one team
          from another.

          HELD BACK EQUALLY, NOT IDENTICALLY (settled 2026-08-05, user
          ruling). This was a flat 0.55, set when Touffou was a
          brand-adjacent red that out-shouted the things red is for here.
          The heritage palette retired that hue and with it that reason —
          but the wallpaper reason above is independent of hue and still
          stands, so the tint stays and only its FAIRNESS was wrong. Flat
          opacity is not fairness: at 0.55 on this ground cobalt measured
          1.43:1, oxblood 1.40:1 and the warm stone 3.17:1, so one team's
          cards read as marked while the other two read as plain.
          heldBackTint solves each hue to the SAME contrast instead, and
          keeps solving it when an engagement swaps a colour. */}
      <div
        className="shrink-0 w-1"
        style={{ background: teamColor, opacity: heldBackTint(teamColor, CARD_GROUND) }}
      />
      {hasPrint ? (
        <>
          {well}
          {/* Height-driven, so the frame is exactly 16:9 and can never be
              cropped by the column beside it (Round 9 format law). */}
          <div className="shrink-0 h-full relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
            <PrintReveal src={idea.print_url!} alt={`${V.artifact} — ${idea.name}`} />
          </div>
        </>
      ) : (
        // The shared plate takes the whole cell. It carries no team line
        // here: the active-team header above the field already names
        // whose wall this is, and a line the printed cards beside it do
        // not carry would break the one-anatomy rule.
        <div className="relative flex-1 min-w-0 h-full">
          <StageIdeaPlate
            idea={idea}
            frameNo={frameNo}
            teamColor={teamColor}
            showCategory={false}
            titlePx={titlePx}
            descPx={descPx}
            descLines={descLines}
            slugPx={slugPx}
            gutterRight={56}
            stamps={stamps}
          />
          {controls}
        </div>
      )}
    </motion.div>
  );
}

// NOTE: `IdeaCard` below now serves the RETURNS (show_counts) view. Its
// presenting branches are kept intact rather than pruned — the returns
// path shares the component and the plan's scope is the presenting
// composition only.
function IdeaCard({
  idea,
  teamColor,
  teamName,
  ideaTag,
  isSelected,
  onToggleSelect,
  voteCount,
  showCounts,
  rank,
  showPromoteControls,
  onPromote,
  onDemote,
  onSetWave,
  onOpen,
  isCombining,
  isNewlyCombined,
  revealDelay = 0,
}: {
  idea: Idea;
  teamColor: string;
  teamName?: string;
  /** The QUALIFIED number — `TOUFFOU 03`. The returns mix teams, so the
   *  number cannot stand alone here (three teams each own a №01). */
  ideaTag?: string | null;
  isSelected: boolean;
  onToggleSelect: () => void;
  voteCount?: number;
  showCounts: boolean;
  rank?: number;
  showPromoteControls: boolean;
  onOpen: () => void;
  isCombining?: boolean;
  isNewlyCombined?: boolean;
  /** Entrance delay of this card in the returns reveal — the leader's china-mark draws after it. */
  revealDelay?: number;
  onPromote: () => void;
  onDemote: () => void;
  onSetWave: (wave: Wave | null) => void;
}) {
  const isStartingLineup = idea.status === "starting_lineup";
  const isLeading = showCounts && rank === 1 && (voteCount || 0) > 0;
  const isDeveloping = idea.print_status === "developing";
  const hasPrint = idea.print_status === "developed" && !!idea.print_url;
  // A developed sheet with no frame chosen yet — the room still owes
  // this idea a decision, so the Stage card says so (the board card's
  // SHEET READY flag, carried onto the dark register).
  const sheetReady =
    idea.print_status === "developed" && !!idea.print_options?.length && !idea.print_url;

  // THE SLIDE CARD (card-lab Round 4, V1 — shipped): a printed
  // presenting card recomposes as a concept slide — content column
  // left (~1/3), the FULL 16:9 print right (~2/3), the card's height
  // derived from the print so the frame is never cropped. The old
  // stacked card (168px filmstrip) is retired for printed ideas;
  // unprinted ideas keep the text card. The slide opens into its
  // bigger self: slide → spread → lightbox, one visual grammar.
  const isSlide = !showCounts && hasPrint;

  return (
    <motion.div
      onClick={onOpen}
      data-qa={showCounts ? "returns-card" : undefined}
      exit={{ opacity: 0, scale: 0.95, transition: TWEEN_EXIT }}
      // In the returns the card fills its row: two cards side by side,
      // one printed and one not, must share one bottom edge or the
      // timing tower reads ragged.
      // The card fills its row — in the returns, and on the presenting
      // wall where a text card sits beside a printed one. Half-height
      // cards left a hole under the short one and a ragged bottom edge;
      // filling puts every shortlist control on one baseline.
      className={`group rounded-md overflow-hidden cursor-pointer transition-all duration-150 relative flex ${showCounts ? "h-full min-h-[140px]" : isSlide ? "" : "h-full min-h-[180px]"}`}
      style={{
        background: isNewlyCombined ? withAlpha(BRAND.colors.primary, 0.08) : CARD_GROUND,
        // THE SELECT IS THE FRAME (one signal across the system): a
        // shortlisted card's own border turns red and thickens, printed
        // or not, on paper or on the dark register.
        border: isNewlyCombined
          ? `2px solid ${BRAND.colors.primary}`
          : isSelected && isCombining
          ? `2px dashed ${teamColor}`
          : isSelected
          ? `2px solid ${teamColor}`
          : isStartingLineup
          ? `2px solid ${BRAND.colors.primary}`
          : "1px solid rgba(107,93,74,0.22)",
        animation: isSelected && isCombining ? "pulse 1.5s ease-in-out infinite" : undefined,
      }}
    >
      {/* Left: returns column — only in results mode; the leader carries the red bar */}
      {showCounts && (
        <div
          className="shrink-0 w-[90px] flex flex-col items-center justify-center py-4"
          style={{
            background: isLeading ? BRAND.colors.primary : "transparent",
            borderRight: isLeading ? "none" : "1px solid rgba(107,93,74,0.22)",
          }}
        >
          {rank != null && (
            <div className="font-bold text-[16px] tracking-[2px] uppercase mb-1" style={{ color: isLeading ? "#2C2419" : "#6B5D4A" }}>
              #{rank}
            </div>
          )}
          <div
            key={voteCount || 0}
            className="font-display text-[52px] leading-none tabular flip-number"
            style={{ color: isLeading ? "#fff" : (voteCount || 0) > 0 ? "#fff" : "#4a4749" }}
          >
            {voteCount || 0}
          </div>
          <div className="font-bold text-[11px] tracking-[2px] uppercase mt-1" style={{ color: isLeading ? "#2C2419" : "#8A7A62" }}>
            {(voteCount || 0) === 1 ? "vote" : "votes"}
          </div>
        </div>
      )}

      {/* Left accent bar — only in non-results mode */}
      {!showCounts && (
        <div className="shrink-0 w-1" style={{ background: teamColor }} />
      )}

      {/* ── The slide card (presenting + printed) ── */}
      {isSlide ? (
        <>
          {/* Content column — the slide's one-third. It stays a share of
              the card, never a floor: a min-width here steals height from
              the print and the 16:9 frame starts cropping (format law). */}
          <div
            className="relative w-[34%] shrink-0 min-w-0 flex flex-col px-5 py-4"
            style={{ borderRight: "1px solid rgba(255,255,255,0.1)" }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              className="absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10 opacity-0 group-hover:opacity-100"
              style={{
                borderColor: isSelected ? teamColor : "rgba(107,93,74,0.25)",
                background: isSelected ? teamColor : "transparent",
                opacity: isSelected ? 1 : undefined,
              }}
            >
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 20 20"><path d="M4 10l4 4 8-8" fill="none" stroke="#fff" strokeWidth={3} /></svg>
              )}
            </button>
            {isNewlyCombined && (
              <div className="mb-1.5">
                <span className="stamp" style={{ color: BRAND.colors.primary }}>
                  ✦ COMBINED
                </span>
              </div>
            )}
            {isDeveloping && (
              <div className="mb-1.5">
                <span
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "#6B5D4A" }}
                >
                  <span
                    className="w-3 h-3 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#8A7A62" }}
                  />
                  {V.workingFlag}
                </span>
              </div>
            )}
            {/* The title takes three lines here where the text card takes
                two: the slide's well is a third of a half row, so a long
                name needs the extra line rather than an ellipsis. The
                description gives the line back. */}
            <h3 className="font-bold leading-tight text-[#2C2419] line-clamp-3 text-[26px] tracking-[-0.01em]">
              {idea.name}
            </h3>
            {idea.description && (
              <p className="mt-2 line-clamp-2 leading-relaxed text-[15px]" style={{ color: "#6B5D4A" }}>
                {idea.description}
              </p>
            )}
            {showPromoteControls && (
              <div className="mt-auto pt-3">
                <button
                  onClick={(e) => { e.stopPropagation(); isStartingLineup ? onDemote() : onPromote(); }}
                  className="px-3 py-1 text-[11px] font-bold tracking-[1px] uppercase rounded cursor-pointer transition-colors"
                  style={{
                    background: isStartingLineup ? "rgba(255,255,255,0.1)" : "transparent",
                    border: isStartingLineup ? "1px solid rgba(255,255,255,0.45)" : "1px solid rgba(107,93,74,0.25)",
                    color: isStartingLineup ? "#fff" : "#6B5D4A",
                  }}
                >
                  {isStartingLineup ? "★ Shortlisted" : "☆ Shortlist"}
                </button>
              </div>
            )}
          </div>
          {/* The print — the slide's two-thirds, the FULL 16:9 frame;
              the card's height follows it (format law: no crop on
              Stage cards). `self-center` is the guard: a flex item
              stretches by default, and a stretched box overrides its
              aspect ratio, so a content column that runs a line long
              would silently crop the frame. */}
          <div className="flex-1 self-center min-w-0 relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
            <PrintReveal
              src={idea.print_url!}
              alt={`${V.artifact} — ${idea.name}`}
            />
          </div>
        </>
      ) : (
      /* Everything right of the spine/slab stacks vertically so the
          footer strip spans the FULL remaining width — print column
          included. One clean bottom edge, printed or not. */
      <div className="flex-1 min-w-0 flex flex-col">
      <div className="flex-1 min-h-0 flex">

      {/* Right: content */}
      <div className="flex-1 min-w-0 px-5 py-4 relative">
        {/* Checkbox — top right (only in presenting mode, not results) */}
        {!showCounts && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            className="absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10 opacity-0 group-hover:opacity-100"
            style={{
              borderColor: isSelected ? teamColor : "rgba(107,93,74,0.25)",
              background: isSelected ? teamColor : "transparent",
              opacity: isSelected ? 1 : undefined,
            }}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 20 20"><path d="M4 10l4 4 8-8" fill="none" stroke="#fff" strokeWidth={3} /></svg>
            )}
          </button>
        )}

        {/* Team attribution — results mode mixes teams, so every card
            names its team. It now names the IDEA too: the qualified
            number `TOUFFOU 03`, which is how the room refers to it out
            loud and the only form that is unambiguous once three teams
            each own a №01. Hue lives in the swatch; the type stays
            high-contrast (projector rule). */}
        {showCounts && (ideaTag || teamName) && (
          <div className="flex items-center gap-2 mb-1">
            <span className="w-[12px] h-[12px] shrink-0" style={{ background: teamColor }} />
            <span data-qa="idea-no" className="font-bold text-[12px] tracking-[1.5px] uppercase" style={{ color: "#2C2419" }}>
              {ideaTag || teamName}
            </span>
          </div>
        )}

        {/* Newly combined stamp — transient callout */}
        {isNewlyCombined && (
          <div className="mb-1.5">
            <span className="stamp" style={{ color: BRAND.colors.primary }}>
              ✦ COMBINED
            </span>
          </div>
        )}

        {/* Darkroom process facts — quiet flags, not second stamps
            (stamp discipline: COMBINED keeps the card's one stamp).
            A developed sheet awaiting its frame says so: choosing is a
            room conversation, so the room has to see the ask. */}
        {!showCounts && (isDeveloping || sheetReady) && (
          <div className="mb-1.5">
            <span
              className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "#6B5D4A" }}
            >
              {isDeveloping ? (
                <span
                  className="w-3 h-3 rounded-full border-2 animate-spin"
                  style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "#8A7A62" }}
                />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />
              )}
              {isDeveloping ? V.workingFlag : V.readyFlag}
            </span>
          </div>
        )}

        {/* Idea name — Sans Bold, one voice with the Board's idea titles; ★ marks shortlisted.
            NO circling (user ruling 2026-08-03: "no more circling at all"). The
            returns leader is already declared by the red slab and the rank; a
            third red on the same card was one too many. */}
        <h3 className="font-bold leading-tight text-[#2C2419] line-clamp-2 text-[26px] tracking-[-0.01em]">
          {idea.name}
        </h3>

        {/* Description */}
        {idea.description && (
          <p className={`mt-2 line-clamp-2 leading-relaxed ${showCounts ? "text-[17px]" : "text-[14px]"}`} style={{ color: "#6B5D4A" }}>
            {idea.description}
          </p>
        )}

      </div>

      {/* The returns' picture — the slide grammar carried into the
          timing tower: the FULL 16:9 frame mounted flush right, sized
          so the tower keeps its density (format law: no crop). */}
      {showCounts && hasPrint && (
        <div
          className="shrink-0 self-stretch flex items-center"
          style={{ width: 236, borderLeft: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="w-full relative overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
            <PrintReveal
              src={idea.print_url!}
              alt={`${V.artifact} — ${idea.name}`}
            />
          </div>
        </div>
      )}
      </div>

      {/* Shortlist controls — a full-width strip; the card bottom is one clean edge */}
      {showPromoteControls && (
        <div className="shrink-0 flex items-center px-4 py-2" style={{ background: "#0A0A0C", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={(e) => { e.stopPropagation(); isStartingLineup ? onDemote() : onPromote(); }}
            className="px-3 py-1 text-[11px] font-bold tracking-[1px] uppercase rounded cursor-pointer transition-colors"
            style={{
              background: isStartingLineup ? "rgba(255,255,255,0.1)" : "transparent",
              border: isStartingLineup ? "1px solid rgba(255,255,255,0.45)" : "1px solid rgba(107,93,74,0.25)",
              color: isStartingLineup ? "#fff" : "#6B5D4A",
            }}
          >
            {isStartingLineup ? "★ Shortlisted" : "☆ Shortlist"}
          </button>
        </div>
      )}
      </div>
      )}
    </motion.div>
  );
}

export default function PillarView({
  pillarSlug,
  ideas,
  teams,
  spotlightTeam,
  onSpotlightTeam,
  workshopState,
  voteCounts,
  totalVoters,
  totalParticipants,
  selectedIds,
  onToggleSelect,
  onBench,
  onUnbench,
  onPromote,
  onDemote,
  onSetWave,
  onOpenIdea,
  onAddIdea,
  combining,
  newlyCreatedId,
}: PillarViewProps) {
  const pillarDef = PILLARS[pillarSlug];
  // Motion is an event, and an event can be declined: with reduced
  // motion the wall simply IS there — no arrival travel, no stagger.
  // Nothing in the composition depends on the movement to be readable.
  const reduceMotion = useReducedMotion();
  const [quickAdd, setQuickAdd] = useState<{ teamSlug: string; name: string; desc: string } | null>(null);
  const showCounts = workshopState.show_counts;
  const votingOpen = workshopState.voting_open;
  const [baseUrl, setBaseUrl] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setBaseUrl(window.location.origin); }, []);

  // Scroll to top when view changes (presenting ↔ results, pillar switch)
  useEffect(() => {
    scrollContainerRef.current?.scrollTo(0, 0);
  }, [showCounts, pillarSlug]);

  // Split ideas into active + benched
  const activeIdeas = useMemo(() => ideas.filter((i) => i.status !== "bench"), [ideas]);
  const benchedIdeas = ideas.filter((i) => i.status === "bench");
  const [benchExpanded, setBenchExpanded] = useState(false);

  // THE STABLE № for every idea in this category, derived from the WHOLE
  // category — all teams, all statuses, set-aside included — so nothing
  // the wall does to its order can move a number (lib/idea-number).
  const stableNo = useMemo(() => ideaNumbers(ideas), [ideas]);

  // THE RETURNS RANK WHAT THE ROOM SAW. Same present gate as the wall
  // and the phone ballot (lib/present-gate), so the returns can no
  // longer carry a column of 0-vote entries nobody was shown.
  //
  // U4: when the gate is UNREADABLE the returns REFUSE — ranking every
  // active idea would present a wider set than the room saw, as a
  // result. `rankedIdeas` stays null and the refusal standing below
  // says why (`returnsUnreadable`).
  const returnsGate = useMemo(() => {
    if (!showCounts) return null;
    return presentedInCategory(ideas);
  }, [showCounts, ideas]);
  const returnsUnreadable = !!returnsGate?.unreadable;
  const rankedIdeas = useMemo(() => {
    if (!returnsGate || returnsGate.unreadable) return null;
    return [...returnsGate.ideas].sort((a, b) => {
      const voteDiff = (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0);
      if (voteDiff !== 0) return voteDiff;
      // Stable tiebreaker: created_at then id — guarantees identical order on every recompute
      const timeDiff = a.created_at.localeCompare(b.created_at);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });
  }, [returnsGate, voteCounts]);

  // Group by team (presenting mode — ideas are already scoped to this pillar).
  // THE PRESENT GATE (lib/present-gate, the one implementation the phone
  // ballot and the returns also read): each team's Stage section carries
  // only the ideas the team brought to the Stage (`presenting`). A team
  // with no selections in this pillar falls back to its full active list
  // — the Stage never looks empty — with a quiet slug note saying so.
  const ideasByTeam = useMemo(() => {
    if (showCounts) return null;
    return GROUP_LIST.map((g) => {
      const teamRecord = teams.find((t) => t.slug === g.slug);
      const teamIdeas = teamRecord
        ? activeIdeas
            .filter((i) => i.team_id === teamRecord.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
        : [];
      const gated = teamStageIdeas(teamIdeas);
      return {
        group: g,
        teamRecord,
        ideas: gated.ideas,
        showingAllFallback: gated.showingAllFallback,
        // U4 — the store could not read this bucket's selections at
        // all. The wall stays up (the active board), but the header
        // says the truth instead of the fallback's "showing all".
        unreadable: gated.unreadable,
      };
    });
  }, [showCounts, activeIdeas, teams]);

  // Helper to get team color/name for an idea
  const getTeamForIdea = (idea: Idea) => {
    const team = teams.find((t) => t.id === idea.team_id);
    const group = team ? Object.values(GROUPS).find((g) => g.slug === team.slug) : null;
    return { color: group?.color || "#555", name: group?.name };
  };

  // ── The presenting composition ──────────────────────────────
  // One branch only: not voting, not showing returns. The active team
  // takes the viewport; every other team collapses into the queue band.
  const presentingView = !showCounts && !votingOpen;

  const activeEntry = useMemo(() => {
    if (!ideasByTeam) return null;
    return ideasByTeam.find((e) => e.group.slug === spotlightTeam) ?? ideasByTeam[0] ?? null;
  }, [ideasByTeam, spotlightTeam]);

  const queueEntries = useMemo(
    () => (ideasByTeam ? ideasByTeam.filter((e) => e.group.slug !== activeEntry?.group.slug) : []),
    [ideasByTeam, activeEntry],
  );

  const stageIdeas = activeEntry?.ideas ?? [];

  // The work area measures itself so the field can plan to the wall it
  // actually has — a projector and a laptop get different compositions
  // of the same anatomy, and neither ships an empty lower third.
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const fieldObserver = useRef<ResizeObserver | null>(null);
  const [fieldBox, setFieldBox] = useState({ w: 0, h: 0 });
  const attachField = useCallback((el: HTMLDivElement | null) => {
    fieldRef.current = el;
    fieldObserver.current?.disconnect();
    fieldObserver.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFieldBox((prev) =>
        Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1 ? prev : { w: width, h: height },
      );
    });
    ro.observe(el);
    fieldObserver.current = ro;
  }, []);
  useEffect(() => () => fieldObserver.current?.disconnect(), []);

  const plan = useMemo(
    () => planField(fieldBox.w, fieldBox.h, stageIdeas.length),
    [fieldBox.w, fieldBox.h, stageIdeas.length],
  );

  // A handoff is a new wall: it starts at the top, like a new slide.
  useEffect(() => { fieldRef.current?.scrollTo(0, 0); }, [spotlightTeam, pillarSlug]);

  // The bench is shared by both branches — the same disclosure, mounted
  // where each composition has room for it.
  const benchSection = benchedIdeas.length > 0 ? (
    <>
      <button
        onClick={() => setBenchExpanded(!benchExpanded)}
        className="font-bold text-[13px] tracking-[2px] uppercase cursor-pointer bg-transparent border-none transition-colors"
        style={{ color: "#8A7A62" }}
      >
        {benchExpanded ? "▾" : "▸"} Set Aside ({benchedIdeas.length})
      </button>
      {benchExpanded && (
        <div className="grid grid-cols-3 gap-2 mt-3 opacity-60 max-h-[26vh] overflow-y-auto">
          {benchedIdeas.map((idea) => {
            const { color } = getTeamForIdea(idea);
            return (
              <div
                key={idea.id}
                className="px-4 py-3 rounded cursor-pointer transition-all hover:opacity-100 group"
                style={{ background: "transparent", border: "1px solid rgba(107,93,74,0.22)", borderLeft: `3px solid ${color}` }}
                onClick={() => onOpenIdea(idea)}
              >
                <div className="text-[16px] font-bold text-[#2C2419]">{idea.name}</div>
                {idea.description && (
                  <div className="text-[12px] mt-1 line-clamp-1" style={{ color: "#6B5D4A" }}>
                    {idea.description}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onUnbench(idea.id); }}
                  className="mt-2 font-bold text-[10px] tracking-[2px] uppercase px-2 py-1 rounded cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                  style={{ background: "transparent", color: "#6B5D4A", border: "1px solid rgba(107,93,74,0.25)" }}
                >
                  Bring back
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  ) : null;

  // Empty state
  if (activeIdeas.length === 0 && benchedIdeas.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="font-display text-[64px] text-[#2C2419]">
          The wall is ready.
        </h2>
        <p className="text-[24px] mt-3" style={{ color: "#8A7A62" }}>
          Ideas appear here as teams file them.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* ═══ THE ACTIVE-TEAM VIEWPORT (presenting) ═══════════════ */}
      {presentingView && activeEntry && (
        <>
          {/* The section header of the room's own screen. NO Kruger: the
              viewport IS the mark, and a red bar here would mark a team,
              which Round 7 forbids. Hue is the spine; the name is white
              (projector rule, Round 7 item 5). */}
          <div data-qa="active-team" className="shrink-0 flex items-center gap-5 px-8 pt-4 pb-3">
            <div className="shrink-0 self-stretch w-[6px]" style={{ background: activeEntry.group.color }} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-4">
                <h2 className="font-bold text-[#2C2419] text-[26px] tracking-[2px] uppercase leading-none whitespace-nowrap">
                  {activeEntry.group.name}
                </h2>
                {activeEntry.teamRecord?.creative_platform_name && (
                  <span className="text-[17px] truncate" style={{ color: "rgba(255,255,255,0.62)" }}>
                    {activeEntry.teamRecord.creative_platform_name}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="font-bold text-[13px] tracking-[2px] uppercase tabular" style={{ color: "#6B5D4A" }}>
                  {stageIdeas.length} {stageIdeas.length === 1 ? "idea" : "ideas"} on the stage
                </span>
                {activeEntry.unreadable ? (
                  // U4 — a schema fault, said plainly where the
                  // facilitator is standing. The wall keeps the active
                  // board (a room mid-session must not lose its
                  // screen), but this must not read as the fallback:
                  // "none selected yet" would be a claim about the
                  // team, and the truth is about the deployment.
                  <span data-qa="gate-unreadable" className="slug" style={{ color: "#8A7A62", fontSize: 12 }}>
                    selections could not be read — showing the active board
                  </span>
                ) : activeEntry.showingAllFallback ? (
                  <span className="slug" style={{ color: "#8A7A62", fontSize: 12 }}>
                    showing all — none selected yet
                  </span>
                ) : null}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-5 shrink-0">
              {onAddIdea && (
                <button
                  onClick={() => setQuickAdd({ teamSlug: activeEntry.group.slug, name: "", desc: "" })}
                  className="px-2.5 py-1 text-[12px] font-bold tracking-[1px] uppercase rounded cursor-pointer transition-colors"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.24)", color: "#6B5D4A" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#6B5D4A"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.24)"; }}
                >
                  + Add
                </button>
              )}
              <span className="font-bold text-[14px] tracking-[3px] uppercase" style={{ color: "rgba(255,255,255,0.75)" }}>
                Now presenting
              </span>
            </div>
          </div>

          {/* The work area — the ONLY thing that scrolls. The grid is
              planned from this box, so five ideas compose and ten-plus
              overflow inside it; the header, queue and Control Strip
              never move. */}
          <div ref={attachField} data-qa="stage-field" className="flex-1 min-h-0 overflow-y-auto px-8 pb-4">
            {stageIdeas.length > 0 ? (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${plan.columns}, minmax(0, 1fr))`,
                  gridAutoRows: `${Math.round(plan.cardHeight)}px`,
                  gap: FIELD_GAP,
                  minHeight: "100%",
                  // When the plan fits, the rows sit in the middle of the
                  // wall rather than stranding a band of dead ground under
                  // them; when it overflows they start at the top and the
                  // half-row on the fold reads as "there is more".
                  alignContent: plan.fits ? "center" : "start",
                }}
              >
                <AnimatePresence mode="popLayout">
                  {stageIdeas.map((idea, idx) => (
                    <motion.div
                      key={idea.id}
                      className="min-h-0"
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                      transition={reduceMotion ? { duration: 0 } : { ...TWEEN_ENTER, delay: Math.min(idx, 11) * STAGGER_DELAY }}
                    >
                      <StageCard
                        idea={idea}
                        plan={plan}
                        // The idea's own number, not its seat on this
                        // wall: the same 03 the Board shows, and it
                        // does not change when the wall re-sorts.
                        frameNo={stableNo.get(idea.id)}
                        teamColor={activeEntry.group.color}
                        isSelected={selectedIds.has(idea.id)}
                        isCombining={combining}
                        isNewlyCombined={idea.id === newlyCreatedId}
                        onToggleSelect={() => onToggleSelect(idea.id)}
                        onPromote={() => onPromote(idea.id)}
                        onDemote={() => onDemote(idea.id)}
                        onOpen={() => onOpenIdea(idea)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div data-qa="stage-empty" className="h-full flex flex-col items-center justify-center text-center">
                <h3 className="font-display text-[44px] leading-tight text-[#2C2419]">
                  Nothing filed under this brief yet.
                </h3>
                <p className="text-[18px] mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {activeEntry.group.name} can add one here, or another team can take the floor.
                </p>
              </div>
            )}
          </div>

          {/* z-1 lifts the fixed furniture clear of the page's horizon
              bloom — the warmth is stage light on the ground, never a
              red wash behind body text (Round 2 item 4). */}
          {benchSection && <div className="relative z-[1] shrink-0 px-8 pb-2">{benchSection}</div>}

          {/* THE QUEUE — every team that is not presenting, once each,
              compact and selectable. It sits directly above the Control
              Strip so the operator's whole vocabulary is one horizontal
              zone at the foot of the screen, and it never scrolls with
              the ideas. */}
          {queueEntries.length > 0 && (
            <div
              data-qa="queue"
              className="relative z-[1] shrink-0 px-8 py-2.5"
              style={{ background: "#0E0D10", borderTop: "1px solid rgba(107,93,74,0.22)" }}
            >
              <div className="flex items-baseline gap-3 mb-1.5">
                <span className="font-bold text-[12px] tracking-[3px] uppercase" style={{ color: "#8A7A62" }}>
                  Waiting to present
                </span>
                <span className="slug" style={{ color: "#8A7A62" }}>
                  select a team to give it the floor
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {queueEntries.map(({ group, teamRecord, ideas: queuedIdeas }) => (
                  <button
                    key={group.slug}
                    data-qa="queue-row"
                    onClick={() => onSpotlightTeam(group.slug)}
                    className="group/q w-full flex items-center gap-4 px-4 py-2 text-left cursor-pointer transition-colors"
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(107,93,74,0.22)",
                      borderLeft: `4px solid ${group.color}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <span className="flex items-baseline gap-3 shrink-0">
                      <span className="font-bold text-[16px] tracking-[2px] uppercase text-[#2C2419] whitespace-nowrap">
                        {group.name}
                      </span>
                      <span className="font-bold text-[13px] tabular whitespace-nowrap" style={{ color: "#8A7A62" }}>
                        {queuedIdeas.length} {queuedIdeas.length === 1 ? "idea" : "ideas"}
                      </span>
                    </span>
                    <span className="text-[14px] truncate min-w-0 flex-1" style={{ color: "#8A7A62" }}>
                      {teamRecord?.creative_platform_name || ""}
                    </span>
                    <span
                      className="ml-auto font-bold text-[12px] tracking-[2px] uppercase whitespace-nowrap px-2.5 py-1 rounded"
                      style={{ color: "#6B5D4A", border: "1px solid rgba(255,255,255,0.28)" }}
                    >
                      Present next →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ VOTING + THE RETURNS — one scrolling work area ══════ */}
      {!(presentingView && activeEntry) && (
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
      {/* Voting overlay — ring progress counter */}
      <AnimatePresence>
        {votingOpen && (() => {
          const progress = totalParticipants > 0 ? totalVoters / totalParticipants : 0;
          const allIn = totalVoters >= totalParticipants;
          const ringSize = 240;
          const strokeWidth = 6;
          const radius = (ringSize - strokeWidth) / 2;
          const circumference = 2 * Math.PI * radius;
          const dashOffset = circumference * (1 - progress);

          return (
            // THE BALLOT IS A LANDSCAPE COMPOSITION. Stacked — ring, then
            // the ballots line, then the QR — the block ran 614px, and the
            // Stage's work area is only 532px tall at 1280×720 (R8's
            // projector target): the QR clipped on the Control Strip and
            // "SCAN TO VOTE" fell entirely below the fold, so the one room
            // that most needs the instruction was the one that could not
            // read it. The room's screen is short and WIDE, so the count
            // and the way in stand side by side across a hairline seam:
            // both are whole at 720p, and neither moves at 900 or 1080.
            <motion.div
              data-qa="ballot"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="min-h-full flex flex-col items-center justify-center py-8"
            >
              <div className="flex items-center justify-center gap-14">
                {/* The count — the room's returns instrument */}
                <div data-qa="ballot-count" className="flex flex-col items-center gap-6">
                  {/* Ring + number */}
                  <div className="relative" style={{ width: ringSize, height: ringSize }}>
                    {/* Background ring */}
                    <svg width={ringSize} height={ringSize} className="absolute inset-0 -rotate-90">
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(107,93,74,0.22)"
                        strokeWidth={strokeWidth}
                      />
                      {/* Progress arc */}
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke={BRAND.colors.primary}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
                      />
                    </svg>

                    {/* Center number */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <motion.div
                        key={totalVoters}
                        initial={{ scale: 1.1, opacity: 0.7 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="font-display text-[96px] leading-none tabular text-[#2C2419]"
                      >
                        {totalVoters}
                      </motion.div>
                    </div>
                  </div>

                  {/* Ballots-in line */}
                  <div className="text-center">
                    {allIn ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="font-display text-[52px] leading-none text-[#2C2419] whitespace-nowrap"
                      >
                        ALL BALLOTS IN
                      </motion.div>
                    ) : (
                      <div className="font-display text-[52px] leading-none tabular text-[#2C2419] whitespace-nowrap">
                        {totalVoters} of {totalParticipants} ballots in
                      </div>
                    )}
                  </div>
                </div>

                {/* The seam — the house hairline, not a divider rule */}
                {baseUrl && (
                  <div className="self-stretch w-px shrink-0" style={{ background: "rgba(255,255,255,0.25)" }} />
                )}

                {/* The way in — QR and its instruction, a peer of the count */}
                {baseUrl && (
                  <div data-qa="ballot-scan" className="flex flex-col items-center gap-3">
                    <div data-qa="ballot-qr" className="p-3 rounded-lg" style={{ background: "#fff" }}>
                      <QRCodeSVG value={`${baseUrl}/vote`} size={160} level="M" fgColor="#000" bgColor="#fff" />
                    </div>
                    <span
                      data-qa="ballot-caption"
                      className="font-bold text-[16px] tracking-[2px] uppercase whitespace-nowrap"
                      style={{ color: "rgba(255,255,255,0.75)" }}
                    >
                      Scan to vote
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* U4 — the returns refuse on an unreadable gate, the same
          refusal the phones make: ranking every active idea would put
          a wider set in front of the room than the room was shown.
          Contents swap for a standing; the structure holds (Round 19
          item 5). */}
      {returnsUnreadable && (
        <div data-qa="returns-unreadable" className="min-h-full flex flex-col items-center justify-center text-center py-8">
          <h3 className="font-display text-[44px] leading-tight text-[#2C2419]">
            The returns can&rsquo;t open.
          </h3>
          <p className="text-[18px] mt-2 max-w-[680px]" style={{ color: "#8A7A62", textWrap: "pretty" }}>
            Which ideas the room was shown could not be read, and the returns must never rank more
            than the room saw. The deployment is not carrying the present-gate field
            (&ldquo;presenting&rdquo; on ideas) — apply the schema fix, then reload.
          </p>
        </div>
      )}

      {/* Ranked list (after showing counts) — all teams of this pillar, together */}
      {rankedIdeas && (
          <div>
            <h2 className="font-display text-[48px] text-center mb-4 text-[#2C2419]">
              The returns — {pillarDef?.label}
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mx-auto w-full max-w-[1200px]" style={{ position: "relative" }}>
              <AnimatePresence mode="popLayout">
              {rankedIdeas.map((idea, i) => {
                const { color, name } = getTeamForIdea(idea);
                // Election-desk reveal: returns land from the bottom of the field,
                // the leader arrives last (capped so long fields stay under ~1.2s).
                const revealDelay = Math.min(rankedIdeas.length - 1 - i, 8) * 0.15;
                return (
                  <motion.div
                    key={idea.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ ...TWEEN_ENTER, delay: revealDelay }}
                  >
                    <IdeaCard
                      idea={idea}
                      teamColor={color}
                      teamName={name}
                      ideaTag={qualifiedIdeaNo(stableNo.get(idea.id), name)}
                      isSelected={selectedIds.has(idea.id)}
                      onToggleSelect={() => onToggleSelect(idea.id)}
                      voteCount={voteCounts[idea.id]}
                      showCounts={true}
                      rank={i + 1}
                      showPromoteControls={true}
                      onPromote={() => onPromote(idea.id)}
                      onDemote={() => onDemote(idea.id)}
                      onSetWave={(w) => onSetWave(idea.id, w)}
                      onOpen={() => onOpenIdea(idea)}
                      isCombining={combining}
                      isNewlyCombined={idea.id === newlyCreatedId}
                      revealDelay={revealDelay}
                    />
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </div>
          </div>
      )}

      {/* The Bench (collapsed) — the same disclosure the presenting
          composition mounts above its queue band. */}
      {benchSection && <div className="mt-6">{benchSection}</div>}
      </div>
      )}

      {/* Quick-add modal */}
      <AnimatePresence>
        {quickAdd && onAddIdea && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.8)" }}
            onClick={() => setQuickAdd(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] p-8"
              style={{ background: BRAND.colors.surface3, border: "1px solid rgba(107,93,74,0.22)" }}
            >
              <h3 className="font-display text-[28px] text-[#2C2419] mb-1">Add an idea</h3>
              <div className="font-bold text-[12px] tracking-[3px] uppercase mb-6" style={{ color: "#6B5D4A" }}>
                {GROUPS[quickAdd.teamSlug as keyof typeof GROUPS]?.name || quickAdd.teamSlug} · {pillarDef?.label || pillarSlug}
              </div>
              <input
                type="text"
                value={quickAdd.name}
                onChange={(e) => setQuickAdd({ ...quickAdd, name: e.target.value })}
                placeholder="Idea name..."
                autoFocus
                className="w-full px-4 py-3 text-[18px] mb-3 focus:outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(107,93,74,0.22)", color: "#2C2419" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && quickAdd.name.trim()) {
                    onAddIdea(quickAdd.teamSlug, quickAdd.name.trim(), quickAdd.desc.trim());
                    setQuickAdd(null);
                  }
                }}
              />
              <textarea
                value={quickAdd.desc}
                onChange={(e) => setQuickAdd({ ...quickAdd, desc: e.target.value })}
                placeholder="Quick description..."
                rows={3}
                className="w-full px-4 py-3 text-[16px] mb-5 focus:outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(107,93,74,0.22)", color: "#ccc" }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && quickAdd.name.trim()) {
                    onAddIdea(quickAdd.teamSlug, quickAdd.name.trim(), quickAdd.desc.trim());
                    setQuickAdd(null);
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setQuickAdd(null)}
                  className="flex-1 py-3 font-bold text-[12px] tracking-[3px] uppercase cursor-pointer"
                  style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.35)", color: "#2C2419" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (quickAdd.name.trim()) {
                      onAddIdea(quickAdd.teamSlug, quickAdd.name.trim(), quickAdd.desc.trim());
                      setQuickAdd(null);
                    }
                  }}
                  disabled={!quickAdd.name.trim()}
                  className="flex-1 py-3 font-bold text-[12px] tracking-[3px] uppercase cursor-pointer disabled:opacity-30"
                  style={{ background: BRAND.colors.primary, color: "#2C2419" }}
                >
                  Add idea
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
