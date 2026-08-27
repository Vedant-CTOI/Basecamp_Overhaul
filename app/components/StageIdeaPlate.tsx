"use client";

import type React from "react";
import { PILLARS, type PillarSlug } from "@/lib/config";
import { ideaNo } from "@/lib/idea-number";
import type { Idea } from "@/lib/types";

// ── THE STAGE PLATE ──────────────────────────────────────────
// An idea with no developed print still has a picture: its own name,
// set. The plate is that picture — ONE composition, mounted wherever a
// room-facing Stage surface would otherwise show an empty media hole:
// the active-team field (PillarView), the full shortlist
// (FullLineupView), and the picture region of the open card in
// presentation mode (ExpandedCard). It lives in `components/` so all
// three can consume it without importing across route directories.
//
// IT COMPOSES ONLY WHAT THE IDEA ALREADY CARRIES — frame number, title,
// description excerpt, team, creative platform, category. Nothing is
// invented, nothing decorative is drawn, and no image-generation call
// is ever made on its behalf (R10). A surface passes the facts it does
// not already state elsewhere: the active-team field names the team in
// its own header, so its plates carry no team line; the shortlist and
// the focus card mix teams, so theirs do.
//
// USER RULING 2026-08-02 — THE TITLE IS THE SAME SIZE ON EVERY STAGE
// CARD AND PLATE, printed or not. Type scale is passed IN by the
// surface, never derived from the cell: a title that grows to fill its
// own box reads as an importance ranking that does not exist. What
// varies between a printed card and a plate is what fills the cell.
// The one exception is the FIELD MARK — the idea's own frame numeral at
// poster scale, held back to ~7% — which is a graphic, not type, and is
// the plate's single serif moment (Round 4's named-numeral rule).
//
// Nothing here animates. The plate is what the room reads, and nothing
// moves while type is being read on stage.

export interface StageIdeaPlateProps {
  idea: Idea;
  /**
   * The idea's STABLE № (lib/idea-number) — assigned at creation within
   * its team + category, never re-derived from this surface's order.
   * Drives the field mark.
   */
  frameNo?: number;
  /**
   * Qualification. Three teams each own a №01, so a surface that shows
   * MORE THAN ONE TEAM names the team beside the number: `TOUFFOU 03`,
   * the way the room already says it. Left unset, the plate prints the
   * bare `№ 03` a single-team surface can afford.
   */
  teamTag?: string;
  teamColor: string;
  /** Named only where the surface does not already say whose idea this is. */
  teamName?: string;
  platform?: string | null;
  /** Off where every card on the surface shares one category. */
  showCategory?: boolean;
  /** THE surface's one title size — identical on its printed cards. */
  titlePx: number;
  titleLines?: number;
  descPx?: number;
  /** 0 keeps the plate silent; the surface decides what its cell affords. */
  descLines?: number;
  slugPx?: number;
  /** Room for chrome the surface anchors over the plate's top-right. */
  gutterRight?: number;
  /** Transparent by default so a card's own ground shows through — a
      plate must never read as a differently-lit card beside a print. */
  ground?: string;
  stamps?: React.ReactNode;
}

export default function StageIdeaPlate({
  idea,
  frameNo,
  teamTag,
  teamColor,
  teamName,
  platform,
  showCategory = true,
  titlePx,
  titleLines = 2,
  descPx,
  descLines = 0,
  slugPx = 12,
  gutterRight = 0,
  ground = "transparent",
  stamps,
}: StageIdeaPlateProps) {
  const category = showCategory ? PILLARS[idea.category as PillarSlug]?.label ?? "" : "";
  const padX = Math.round(Math.max(16, titlePx * 0.6));
  const padY = Math.round(Math.max(10, titlePx * 0.42));
  const footer = teamName || platform ? [teamName, platform].filter(Boolean).join(" · ") : null;
  const frame = ideaNo(frameNo);

  return (
    <div
      data-qa="stage-plate"
      className="relative w-full h-full overflow-hidden"
      style={{ containerType: "size", background: ground }}
    >
      {/* A whisper of team hue, not a field. At 0.05 a red-hued team gave
          its plates a visibly warmer ground than its printed cards
          beside them, and one anatomy stopped reading as one. */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: teamColor, opacity: 0.03 }} />

      {/* The field mark — this idea's own frame numeral at poster scale.
          The one thing on the plate that still sizes itself from the
          cell, because it is a graphic and not something the room reads. */}
      {frame && (
        <span
          className="font-display absolute pointer-events-none select-none tabular"
          style={{ right: "2.5cqw", bottom: "-16cqh", fontSize: "82cqh", lineHeight: 1, color: "#2C2419", opacity: 0.07 }}
        >
          {frame}
        </span>
      )}

      <div className="relative h-full flex flex-col justify-center" style={{ padding: `${padY}px ${padX}px` }}>
        {(frame || category || stamps) && (
          <div className="flex items-baseline gap-1.5" style={{ paddingRight: gutterRight }}>
            {/* Bare on a single-team surface, qualified where teams sit
                together: `№ 03` against `TOUFFOU 03`. The № glyph is the
                bare form's own mark — the team name does its job on the
                qualified one. */}
            {/* USER RULING 2026-08-03 — one step down, both forms. The
                number rides AT the surface's slug register instead of two
                points above it, so on a plate the title is the only thing
                that reads as headline. */}
            {frame && (
              teamTag ? (
                <span
                  data-qa="idea-no"
                  className="font-bold uppercase whitespace-nowrap"
                  style={{
                    color: "rgba(255,255,255,0.66)",
                    fontSize: slugPx,
                    lineHeight: 1,
                    letterSpacing: "0.1em",
                  }}
                >
                  {teamTag} <span className="tabular">{frame}</span>
                </span>
              ) : (
                <span data-qa="idea-no" className="flex items-baseline gap-1.5">
                  <span className="slug" style={{ color: "#8A7A62", fontSize: slugPx - 1 }}>№</span>
                  <span
                    className="font-bold tabular"
                    style={{ color: "rgba(255,255,255,0.66)", fontSize: slugPx, lineHeight: 1 }}
                  >
                    {frame}
                  </span>
                </span>
              )
            )}
            {category && (
              <span
                className="font-bold uppercase whitespace-nowrap"
                style={{ color: "rgba(255,255,255,0.45)", fontSize: slugPx, letterSpacing: "0.16em", marginLeft: frame ? 8 : 0 }}
              >
                {category}
              </span>
            )}
            {stamps}
          </div>
        )}

        {/* The plate's headline — the surface's one title size */}
        <h3
          className="font-bold text-[#2C2419] overflow-hidden"
          style={{
            fontSize: titlePx,
            lineHeight: 1.15,
            letterSpacing: "-0.015em",
            textWrap: "balance",
            marginTop: Math.round(padY * 0.8),
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: titleLines,
          }}
        >
          {idea.name}
        </h3>

        {descLines > 0 && idea.description && (
          <p
            className="overflow-hidden"
            style={{
              color: "#6B5D4A",
              fontSize: descPx ?? Math.max(13, Math.round(titlePx * 0.55)),
              lineHeight: 1.45,
              marginTop: 6,
              // The plate has the whole cell, which at 1920 is a
              // ~110-character line. Running text holds a measure
              // (Round 8 item 2); the field mark takes the rest.
              // 62ch resolved to ~94 CHARACTERS on this face — `ch` is
              // the width of a zero, and a proportional sans averages
              // well under that — so the plate's lines ran two and a
              // half times the printed card's well beside it and one
              // anatomy stopped reading as one. 42ch lands at ~60.
              maxWidth: "42ch",
              textWrap: "pretty",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: descLines,
            }}
          >
            {idea.description}
          </p>
        )}

        {footer && (
          <div className="mt-auto flex items-center gap-2.5" style={{ paddingTop: padY }}>
            <span className="shrink-0" style={{ width: 10, height: 10, background: teamColor }} />
            <span className="slug truncate" style={{ color: "rgba(255,255,255,0.6)", fontSize: slugPx }}>
              {footer}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
