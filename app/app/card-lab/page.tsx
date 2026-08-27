"use client";

// ============================================================
// THE CARD LAB — option study, DO NOT SHIP
// ============================================================
// Four candidate treatments for how an idea card transforms when
// it has a Darkroom print. The brief (user, verbatim): "how do you
// take the card that's all text and incorporate the idea image so
// it's not just background but front and center somehow?"
//
// Each candidate renders with 2 real printed ideas + 1 unprinted
// sibling (the sibling ships exactly as today's 240px text card).
// The shipping IdeaCard default is unchanged — this route is the
// deciding room, like /atmosphere-lab.
//
// Laws observed (docs/ogilvy-showcase-direction.md):
// - Scrims are legible tools, not gradient decoration (candidate A
//   carries the one sanctioned scrim; nothing else gets a gradient).
// - The china-marker is wax on light registers (multiply, ≤0.65);
//   on A's ink scrim multiply would vanish, so the mark renders
//   plain at 0.8 — red mark on dark is the LIVE-chip family.
// - Stamps only when the state is real. On A's scrim the ink-family
//   stamps go white; SHORTLISTED keeps red (small red element on
//   dark is sanctioned; red running text is not).
// - Room readability: every title ≥22px, body 16px.
// ============================================================

import { useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { SHOWCASE_IDEAS } from "@/lib/showcase-data";
import { STATUS_LABELS, PILLARS, FRAMEWORK_FIELDS, GROUPS } from "@/lib/config";
import { ideaNumbers } from "@/lib/idea-number";
import type { Idea } from "@/lib/types";
import ChinaMark from "@/components/ChinaMark";
import PrintReveal from "@/components/PrintReveal";
import IdeaCard from "@/components/IdeaCard";
import { MarkCoach, MarkKill, MarkGenerate } from "@/components/Marks";
import ArrivalRound from "./arrival-round";
import ClockRound from "./clock-round";

const INK = "#231F20";
const RED = "#002663";
const BODY = "#4a4749";
const HAIRLINE = "rgba(35,31,32,0.24)";

// The lab's cast is SELF-CONTAINED: a fresh workshop ships with zero
// seeded ideas, so the study renders against local fixture rows rather
// than reaching into the live store. Same shape the engine produces —
// only the ids differ from anything participants could reference.
const FIXTURE_IDEAS: Array<Record<string, unknown>> = [
  {
    id: "lab-08", team_id: "team-one", category: "category_2",
    name: "The Mirror Check",
    description: "A five-second in-app pause before any selfie edit saves: the original beside the edited frame and one question, co-designed with teens.",
    status: "coached", source: "team", wave: null, bbei_connection: null,
    key_partners: null, link_group: null, gifted_from_team_id: null,
    presenting: true,
    print_status: "developed",
    print_url: "/prints/print-01.png",
    print_options: ["/prints/print-01.png", "/prints/print-02.png", "/prints/print-03.png"],
    print_source: "The Mirror Check\nA five-second pause before any selfie edit saves.",
    print_note: "Show the moment, not the UI.",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "lab-10", team_id: "team-two", category: "category_1",
    name: "Label It or Lose It",
    description: "A browser extension that flags unlabeled synthetic faces in the feed in real time, moving pressure from the audience to the platforms.",
    status: "starting_lineup", source: "ai_scouted", wave: "wave_1",
    bbei_connection: "Transparency as infrastructure.", key_partners: null,
    link_group: null, gifted_from_team_id: null,
    presenting: true,
    print_status: "developed",
    print_url: "/prints/print-04.png",
    print_options: ["/prints/print-04.png", "/prints/print-05.png", "/prints/print-06.png"],
    print_source: "Label It or Lose It\nReal-time synthetic-face flagging.",
    print_note: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: "lab-11", team_id: "team-three", category: "category_3",
    name: "One Hundred Skins",
    description: "One core range tested across one hundred documented skin profiles and published, results and failures included.",
    status: "coached", source: "team", wave: null, bbei_connection: null,
    key_partners: null, link_group: null, gifted_from_team_id: null,
    presenting: false, print_status: null, print_url: null, print_options: null,
    print_source: null, print_note: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
];

const byId = (id: string): Idea => {
  const row = SHOWCASE_IDEAS.find((r) => r.id === id);
  if (row) return row as unknown as Idea;
  // Fresh-room fallback: map the historical lab ids onto local fixtures.
  const alias: Record<string, string> = { "idea-08": "lab-08", "idea-10": "lab-10", "idea-11": "lab-11" };
  return FIXTURE_IDEAS.find((r) => r.id === (alias[id] ?? id)) as unknown as Idea;
};

// The cast: two printed studies + one unprinted sibling.
const HOMEWORK = byId("idea-08"); // coached · presenting · print-03
const ALMANAC = byId("idea-10"); // shortlisted · presenting · print-04
const SECOND = byId("idea-11"); // coached · scouted · no print

// The lab prints the REAL №, derived the way production derives it:
// creation order inside the idea's own team + category, never the row
// it happens to occupy here (lib/idea-number).
const LAB_NO = ideaNumbers(SHOWCASE_IDEAS as unknown as Idea[]);

// ── Shared pieces (the card's real grammar) ──────────────────

function FrameNo({ n, chip }: { n: number; chip?: boolean }) {
  return (
    <span
      className="absolute top-3.5 right-5 flex items-baseline gap-1 z-[3]"
      style={chip ? { background: "rgba(255,255,255,0.9)", padding: "2px 7px" } : undefined}
    >
      <span className="slug" style={{ color: "#8A8689", fontSize: 12 }}>№</span>
      <span className="font-bold text-[21px] leading-none tabular" style={{ color: INK }}>
        {String(n).padStart(2, "0")}
      </span>
    </span>
  );
}

// Stamp row per the shipping rules; `onScrim` moves the ink family
// to white for the poster's dark ground (SHORTLISTED stays red).
function StampRow({ idea, onScrim }: { idea: Idea; onScrim?: boolean }) {
  const inkColor = onScrim ? "#FFFFFF" : INK;
  return (
    <div className="flex gap-2 items-center flex-wrap">
      {idea.status === "starting_lineup" && (
        <span className="stamp" style={{ color: RED }}>{STATUS_LABELS.starting_lineup}</span>
      )}
      {idea.presenting && (
        <span className="stamp" style={{ color: inkColor, transform: "rotate(-1.8deg)" }}>On the Stage</span>
      )}
      {idea.status === "coached" && (
        <span className="stamp" style={{ color: inkColor }}>{STATUS_LABELS.coached}</span>
      )}
      {idea.source === "ai_scouted" && (
        <span className="stamp" style={{ color: onScrim ? "#FFFFFF" : "#24298F", transform: "rotate(1deg)" }}>Scouted</span>
      )}
    </div>
  );
}

// The unprinted sibling — exactly the shipping 240px text card.
function UnprintedCard({ idea, n }: { idea: Idea; n: number }) {
  return (
    <div className="relative cursor-pointer bg-white h-[240px] p-5 border" style={{ borderColor: HAIRLINE }}>
      <FrameNo n={n} />
      <h3 className="font-bold text-[22px] leading-[1.25] line-clamp-2 pr-14" style={{ color: INK }}>
        {idea.name}
      </h3>
      {idea.description && (
        <p className="text-[16px] leading-[1.55] mt-2.5 line-clamp-4" style={{ color: BODY }}>
          {idea.description}
        </p>
      )}
      <div className="absolute left-5 right-5 bottom-4">
        <StampRow idea={idea} />
      </div>
    </div>
  );
}

// ── A. THE POSTER ────────────────────────────────────────────
// Print full-bleed on the whole card; ink scrim rises from the
// bottom; the title sets ON the image in white. The description
// lives only in the expanded card. SELECT: the china-marker
// circles the title on the scrim (the scrim is the card's one
// calm field — the print's own strokes stay unfought). STAMPS:
// on the scrim, pinned to the bottom edge.
function PosterCard({ idea, n }: { idea: Idea; n: number }) {
  const shortlisted = idea.status === "starting_lineup";
  return (
    <div className="relative cursor-pointer bg-white h-[344px] border overflow-hidden" style={{ borderColor: HAIRLINE }}>
      <div className="absolute inset-0">
        <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
      </div>
      {/* The legible scrim — ink, rising from the bottom. A tool, not decoration. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[64%]"
        style={{
          background:
            "linear-gradient(to top, rgba(35,31,32,0.97) 0%, rgba(35,31,32,0.9) 34%, rgba(35,31,32,0.55) 62%, rgba(35,31,32,0) 100%)",
        }}
      />
      <FrameNo n={n} chip />
      <div className="absolute left-5 right-5 bottom-4">
        <span className="relative inline-block max-w-full mb-2.5">
          <h3 className="font-bold text-[24px] leading-[1.2] line-clamp-2" style={{ color: "#FFFFFF" }}>
            {idea.name}
          </h3>
          {shortlisted && (
            <span className="absolute -inset-x-3 -inset-y-1.5 pointer-events-none">
              {/* On the ink scrim multiply would vanish — plain red at 0.8. */}
              <ChinaMark variant="circle" animate={false} strokeWidth={2.6} opacity={0.8} />
            </span>
          )}
        </span>
        <StampRow idea={idea} onScrim />
      </div>
    </div>
  );
}

// ── B. THE PROOF PRINT ───────────────────────────────────────
// Contact-sheet vocabulary: the print sits with generous paper
// margins inside the frame — a print pinned on the card. Title is
// the caption line beneath; description holds 2 lines. № is the
// frame number it already is, on the mat. SELECT: the china-marker
// circles the matted frame — the authentic grease-pencil gesture
// on a proof sheet — as wax (multiply, 0.55) so the print stays
// legible under it. STAMPS: on the mat, pinned to the bottom edge.
function ProofPrintCard({ idea, n }: { idea: Idea; n: number }) {
  const shortlisted = idea.status === "starting_lineup";
  return (
    <div className="relative cursor-pointer bg-white h-[436px] p-[18px] border" style={{ borderColor: HAIRLINE }}>
      <FrameNo n={n} />
      <div className="mt-[34px]">
        <div className="relative">
          <div className="aspect-video overflow-hidden" style={{ border: "1px solid rgba(35,31,32,0.12)" }}>
            <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
          </div>
          {shortlisted && (
            <span className="absolute -inset-1.5 pointer-events-none">
              <ChinaMark
                variant="circle"
                animate={false}
                strokeWidth={2}
                opacity={0.55}
                className="mix-blend-multiply"
              />
            </span>
          )}
        </div>
        <h3 className="font-bold text-[22px] leading-[1.25] line-clamp-1 mt-3" style={{ color: INK }}>
          {idea.name}
        </h3>
      </div>
      {idea.description && (
        <p className="text-[16px] leading-[1.55] mt-2 line-clamp-2" style={{ color: BODY }}>
          {idea.description}
        </p>
      )}
      <div className="absolute left-[18px] right-[18px] bottom-4">
        <StampRow idea={idea} />
      </div>
    </div>
  );
}

// ── C. THE SPLIT FRAME ───────────────────────────────────────
// Landscape: the card spans 2 grid columns; print left ~45% at
// real size, text right. SELECT: the china-marker circles the
// text panel (the shipping law — the mark circles TEXT; prints
// carry drawn strokes of their own), wax multiply. STAMPS: bottom
// of the text panel.
function SplitFrameCard({ idea, n }: { idea: Idea; n: number }) {
  const shortlisted = idea.status === "starting_lineup";
  return (
    <div className="relative col-span-2 cursor-pointer bg-white h-[264px] border flex overflow-hidden" style={{ borderColor: HAIRLINE }}>
      <div className="w-[45%] shrink-0 overflow-hidden" style={{ borderRight: "1px solid rgba(35,31,32,0.12)" }}>
        <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
      </div>
      <div className="relative flex-1 p-5">
        <FrameNo n={n} />
        <span className="relative inline-block max-w-full pr-14">
          <h3 className="font-bold text-[22px] leading-[1.25] line-clamp-2" style={{ color: INK }}>
            {idea.name}
          </h3>
          {shortlisted && (
            <span className="absolute -inset-x-3 -inset-y-1.5 pointer-events-none">
              <ChinaMark
                variant="circle"
                animate={false}
                strokeWidth={2.4}
                opacity={0.65}
                className="mix-blend-multiply"
              />
            </span>
          )}
        </span>
        {idea.description && (
          <p className="text-[16px] leading-[1.55] mt-2.5 line-clamp-3" style={{ color: BODY }}>
            {idea.description}
          </p>
        )}
        <div className="absolute left-5 right-5 bottom-4">
          <StampRow idea={idea} />
        </div>
      </div>
    </div>
  );
}

// ── D. THE TALL COVER ────────────────────────────────────────
// Evolution of the shipping strip: the image takes ~65% of a
// taller card; the title overlaps the image's bottom edge on a
// paper chip; the text block compresses below. SELECT: the
// china-marker circles the text block below the print (shipping
// law), wax multiply. STAMPS: bottom edge, on paper.
function TallCoverCard({ idea, n }: { idea: Idea; n: number }) {
  const shortlisted = idea.status === "starting_lineup";
  const IMG_H = 273; // ~65% of 420
  return (
    <div className="relative cursor-pointer bg-white h-[420px] border overflow-hidden" style={{ borderColor: HAIRLINE }}>
      <div className="overflow-hidden" style={{ height: IMG_H, borderBottom: "1px solid rgba(35,31,32,0.12)" }}>
        <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
      </div>
      <FrameNo n={n} chip />
      <div className="px-5">
        <h3
          className="relative z-[2] inline-block font-bold text-[22px] leading-[1.25] line-clamp-2 -mt-[18px] bg-white"
          style={{ color: INK, padding: "5px 10px 2px", maxWidth: "100%" }}
        >
          {idea.name}
        </h3>
        {idea.description && (
          <p className="text-[16px] leading-[1.55] mt-1.5 line-clamp-2" style={{ color: BODY }}>
            {idea.description}
          </p>
        )}
      </div>
      <div className="absolute left-5 right-5 bottom-4">
        <StampRow idea={idea} />
      </div>
      {shortlisted && (
        <span className="absolute left-0 right-0 pointer-events-none" style={{ top: IMG_H, bottom: 0 }}>
          <ChinaMark
            variant="circle"
            animate={false}
            strokeWidth={2.4}
            opacity={0.65}
            className="mix-blend-multiply"
          />
        </span>
      )}
    </div>
  );
}

// ============================================================
// ROUND 2 — THE OPEN CARD
// ============================================================
// The user: "i need to see what it looks like when it opens
// though, that's more of the design challenge i think."
// Four static compositions of the ExpandedCard (the white paper
// modal) with the print given real presence — real anatomy: team
// edge, header row, serif title, framework fields (live
// textareas — this is a working manuscript), action row. The
// shipping ExpandedCard is untouched; today it shows the print
// only as the small "In print" chip in the action row.
// All four use The Category Almanac (Touffou · shortlisted ·
// presenting · print-04) so the comparison is apples to apples.
// ============================================================

const TOUFFOU = GROUPS["group-2"]; // #8E2740 oxblood (Round 17)
const FIELD_BG = "rgba(35,31,32,0.02)";
const FIELD_BORDER = "rgba(35,31,32,0.2)";
const HEADER_BORDER = "rgba(35,31,32,0.12)";

// The modal overlay is rgba(20,19,22,0.7) over the light board —
// this solid is that blend, so the mocks sit on the true dim.
const DIM_GROUND = "#5A595C";

function OpenHeader() {
  return (
    <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: `1px solid ${HEADER_BORDER}` }}>
      <div className="flex items-center gap-4">
        <span className="font-bold text-[13px] tracking-[3px] uppercase" style={{ color: INK }}>
          Idea Framework
        </span>
        <span
          className="font-bold text-[12px] tracking-[3px] uppercase px-2 py-1"
          style={{ color: PILLARS.category_2.color, background: `${PILLARS.category_2.color}15` }}
        >
          {PILLARS.category_2.label} ▾
        </span>
        <span className="stamp" style={{ color: RED }}>{STATUS_LABELS.starting_lineup}</span>
        <span className="stamp" style={{ color: INK, transform: "rotate(-1.8deg)" }}>On the Stage</span>
      </div>
      <span className="text-2xl leading-none p-2 opacity-40" style={{ color: INK }}>×</span>
    </div>
  );
}

function OpenTitle({ idea }: { idea: Idea }) {
  return (
    <input
      type="text"
      defaultValue={idea.name}
      className="w-full bg-transparent font-display tracking-[1px] focus:outline-none pb-2 text-[34px]"
      style={{ color: INK, borderBottom: `1px solid ${FIELD_BORDER}` }}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="font-bold text-[12px] tracking-[2px] uppercase block mb-2 pt-4 px-4" style={{ color: INK }}>
      {children}
    </label>
  );
}

const FIELD_STYLE: React.CSSProperties = {
  background: FIELD_BG,
  border: `1px solid ${FIELD_BORDER}`,
  color: INK,
  borderRadius: 0,
};

function IdeaField({ idea, rows = 4, style }: { idea: Idea; rows?: number; style?: React.CSSProperties }) {
  return (
    <div className="flex flex-col" style={{ ...FIELD_STYLE, ...style }}>
      <FieldLabel>Idea</FieldLabel>
      <textarea
        defaultValue={idea.description || ""}
        rows={rows}
        className="flex-1 w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none text-[18px]"
        style={{ color: INK }}
      />
    </div>
  );
}

function ConnectionField({ idea, rows = 4, style }: { idea: Idea; rows?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ ...FIELD_STYLE, ...style }}>
      <FieldLabel>Connection to The Well-Informed Unconscious</FieldLabel>
      <textarea
        defaultValue={(idea.bbei_connection as string) || ""}
        rows={rows}
        className="w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none text-[18px]"
        style={{ color: INK }}
      />
    </div>
  );
}

function PartnersField({ idea, rows = 4, style }: { idea: Idea; rows?: number; style?: React.CSSProperties }) {
  return (
    <div style={{ ...FIELD_STYLE, ...style }}>
      <FieldLabel>{FRAMEWORK_FIELDS.find((f) => f.key === "key_partners")!.label}</FieldLabel>
      <textarea
        defaultValue={(idea.key_partners as string) || ""}
        rows={rows}
        className="w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none text-[18px]"
        style={{ color: INK }}
      />
    </div>
  );
}

// The shipping action row. `withPrintChip` keeps today's thumbnail
// chip (only candidate D retains it — everywhere else the print is
// in the layout and the chip retires).
function OpenActions({ idea, withPrintChip }: { idea: Idea; withPrintChip?: boolean }) {
  return (
    <div className="flex gap-3 px-8 py-5" style={{ borderTop: `1px solid ${HEADER_BORDER}` }}>
      <button className="flex-1 flex items-center justify-center h-12 font-bold text-[13px] tracking-[1px]" style={{ background: INK, color: "#fff" }}>
        Save
      </button>
      <button
        className="flex items-center justify-center h-12 font-bold text-[12px] tracking-[0.14em] uppercase px-5"
        style={{ background: "transparent", border: "1.5px solid #231F20", borderRadius: 2, color: INK, transform: "rotate(-1.2deg)" }}
      >
        ★ On the Stage
      </button>
      {withPrintChip && (
        <div className="flex items-center gap-2.5 h-12 px-4" style={{ border: "1px solid rgba(35,31,32,0.15)", color: "#6e6a6c" }}>
          <img
            src={idea.print_url!}
            alt="The developed print"
            className="h-[30px] w-[53px] object-cover"
            style={{ border: "1px solid rgba(35,31,32,0.2)" }}
          />
          <span className="font-bold text-[12px] tracking-[1px] uppercase">In print</span>
        </div>
      )}
      <button
        className="flex-1 flex items-center justify-center gap-2.5 h-12 font-bold text-[13px] tracking-[1px]"
        style={{ background: "transparent", border: "1px solid rgba(35,31,32,0.3)", color: INK }}
      >
        <MarkCoach size={18} />
        Coach this idea
      </button>
      <button className="ml-auto flex items-center justify-center w-10 h-12" style={{ color: "rgba(35,31,32,0.35)", background: "transparent", border: "none" }}>
        <MarkKill size={20} />
      </button>
    </div>
  );
}

// Paper card shell on the true modal dim, with the team color edge.
function OpenShell({ children, maxWidth = 1200 }: { children: React.ReactNode; maxWidth?: number }) {
  return (
    <div className="py-12 px-10 flex justify-center" style={{ background: DIM_GROUND }}>
      <div
        className="w-full"
        style={{
          maxWidth,
          background: "#FFFFFF",
          color: INK,
          border: "1px solid rgba(35,31,32,0.25)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="h-[4px]" style={{ background: TOUFFOU.color }} />
        {children}
      </div>
    </div>
  );
}

// ── OPEN A. THE FRONTISPIECE ─────────────────────────────────
// Book-plate structure: the print runs full-width and generous at
// the top of the paper card; the title and manuscript read below
// it. No scrim — nothing overlaps the image. The action row's
// "In print" chip retires; the print speaks for itself.
function OpenFrontispiece({ idea }: { idea: Idea }) {
  return (
    <OpenShell>
      <OpenHeader />
      <div className="h-[340px] overflow-hidden" style={{ borderBottom: `1px solid ${HEADER_BORDER}` }}>
        <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
      </div>
      <div className="px-8 py-4">
        <div className="mb-3">
          <OpenTitle idea={idea} />
        </div>
        <div className="grid grid-cols-[2fr_1fr] gap-0">
          <IdeaField idea={idea} rows={4} style={{ borderRight: "none" }} />
          <div className="flex flex-col">
            <ConnectionField idea={idea} rows={2} style={{ borderBottom: "none" }} />
            <PartnersField idea={idea} rows={2} />
          </div>
        </div>
      </div>
      <OpenActions idea={idea} />
    </OpenShell>
  );
}

// ── OPEN B. THE PLATE ────────────────────────────────────────
// Editorial page: the print sits at ~40% width beside the
// manuscript with its caption slug beneath (№ + idea name — true
// data), and the framework fields stack under the plate. One page,
// magazine grammar.
function OpenPlate({ idea }: { idea: Idea }) {
  return (
    <OpenShell>
      <OpenHeader />
      <div className="px-8 py-4">
        <div className="mb-4">
          <OpenTitle idea={idea} />
        </div>
        <div className="grid grid-cols-[3fr_2fr] gap-6 items-start">
          <IdeaField idea={idea} rows={9} />
          <div>
            <div className="overflow-hidden" style={{ border: "1px solid rgba(35,31,32,0.12)" }}>
              <div className="aspect-video">
                <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
              </div>
            </div>
            <p className="slug mt-2 mb-4" style={{ color: "#8A8689" }}>
              № 03 · {idea.name} · Developed in the Darkroom
            </p>
            <ConnectionField idea={idea} rows={2} style={{ borderBottom: "none" }} />
            <PartnersField idea={idea} rows={2} />
          </div>
        </div>
      </div>
      <OpenActions idea={idea} />
    </OpenShell>
  );
}

// ── OPEN C. THE FACING SPREAD ────────────────────────────────
// The open card widens into a two-page spread: the manuscript
// (editable) is the left page, the print is the full right page
// with a caption strip — the coach takeover's 50/50 grammar.
function OpenSpread({ idea }: { idea: Idea }) {
  return (
    <OpenShell maxWidth={1440}>
      <OpenHeader />
      <div className="grid grid-cols-2">
        {/* Left page — the manuscript */}
        <div className="px-8 py-4">
          <div className="mb-3">
            <OpenTitle idea={idea} />
          </div>
          <IdeaField idea={idea} rows={6} />
          <div className="grid grid-cols-2 gap-0 mt-0">
            <ConnectionField idea={idea} rows={3} style={{ borderTop: "none" }} />
            <PartnersField idea={idea} rows={3} style={{ borderTop: "none", borderLeft: "none" }} />
          </div>
        </div>
        {/* Right page — the print, full page, spine hairline */}
        <div className="relative flex flex-col" style={{ borderLeft: `1px solid ${HEADER_BORDER}` }}>
          <div className="flex-1 overflow-hidden">
            <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
          </div>
          <p className="slug px-6 py-3" style={{ color: "#8A8689", borderTop: `1px solid ${HEADER_BORDER}` }}>
            № 03 · Developed in the Darkroom · Touffou
          </p>
        </div>
      </div>
      <OpenActions idea={idea} />
    </OpenShell>
  );
}

// ── OPEN D. THE BACKDROP LIFT ────────────────────────────────
// The print becomes the theater: full-bleed behind the modal,
// dimmed under an ink scrim, while the paper card ships exactly
// as today — clean manuscript, "In print" chip and all. The room
// sees the image large; the reader keeps the manuscript.
function OpenBackdrop({ idea }: { idea: Idea }) {
  return (
    <div className="relative py-14 px-10 flex justify-center overflow-hidden">
      <div className="absolute inset-0">
        <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
      </div>
      <div className="absolute inset-0" style={{ background: "rgba(20,19,22,0.62)" }} />
      <div
        className="relative w-full"
        style={{
          maxWidth: 1200,
          background: "#FFFFFF",
          color: INK,
          border: "1px solid rgba(35,31,32,0.25)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div className="h-[4px]" style={{ background: TOUFFOU.color }} />
        <OpenHeader />
        <div className="px-8 py-4">
          <div className="mb-3">
            <OpenTitle idea={idea} />
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-0">
            <IdeaField idea={idea} rows={4} style={{ borderRight: "none" }} />
            <div className="flex flex-col">
              <ConnectionField idea={idea} rows={2} style={{ borderBottom: "none" }} />
              <PartnersField idea={idea} rows={2} />
            </div>
          </div>
        </div>
        <OpenActions idea={idea} withPrintChip />
      </div>
    </div>
  );
}

// ============================================================
// ROUND 3 — THE SEAM BRIDGE — RULED 2026-08-05: REJECTED, KEPT AS
// EVIDENCE. DO NOT REVIVE. (ledger Round 9 item 3)
// ============================================================
// The study: the shipping poster reads as image-block-atop-ink-panel,
// two stacked rectangles, so this dissolved the print's bottom 40px
// into the panel ground on a ten-stop eased gradient (Letterboxd,
// research P3 — docs/research-hero-image-patterns.md Rec 3) to make
// the poster read as ONE printed object.
//
// THE RULING WAS A, THE HARD SEAM. Reasons, in the order that
// decided it:
//   a) The bridge is a SOFT CROP. It does not blend two surfaces, it
//      destroys the bottom 40px of the photograph — against Round 9's
//      own law that every mount shows the full frame. A crop with no
//      visible edge is worse than one you can see, because nothing
//      signals what was lost.
//   b) Its cost is UNPREDICTABLE on unknown input. Dark lower band,
//      nearly invisible; bright one (a sky, a lit floor, a white
//      table), a grey smear over real content. The Darkroom GENERATES
//      these pictures, so the input is unknowable by definition, and
//      no dial rescues it — every setting is wrong for half the
//      photographs.
//   c) The crisp edge is the idiom the system already speaks. Contact
//      sheets, selects, mats, proof prints: a printed photograph has
//      an edge, and the mat's hairline has been load-bearing since
//      Round 8. The dissolve is a screen convention borrowed from the
//      web and makes the card read as a hero banner.
//
// AND THE MOCK ITSELF CARRIES THE WIDER LESSON. BRIDGE_GRADIENT below
// terminates on a BAKED "#0A0A0C", but the real panel in
// components/ExpandedCard.tsx is rgba(10,10,12,0.92) — so this would
// have shipped a visible band, the bridge ending up more opaque than
// the panel it bridged into. It looked correct here only because the
// lab hardcodes both sides. A PRIMITIVE THAT COMPOSITES AGAINST A
// TOKEN MUST READ THAT TOKEN, NEVER BAKE IT.
//
// Left rendering so the comparison stays inspectable. Nothing outside
// this lab imports it.

const PANEL_INK = "#0A0A0C";
const BRIDGE_GRADIENT = `linear-gradient(to bottom, rgba(10,10,12,0) 0%, rgba(10,10,12,0.04) 11%, rgba(10,10,12,0.13) 22%, rgba(10,10,12,0.26) 33%, rgba(10,10,12,0.42) 44%, rgba(10,10,12,0.57) 56%, rgba(10,10,12,0.74) 67%, rgba(10,10,12,0.87) 78%, rgba(10,10,12,0.96) 89%, ${PANEL_INK} 100%)`;

// The poster's real grammar (ExpandedCard poster state), mocked
// static: full 16:9 print over the content-height ink panel. `bridge`
// adds the dissolve; nothing else differs between the pair.
function SeamPoster({ idea, teamLabel, bridge }: { idea: Idea; teamLabel: string; bridge?: boolean }) {
  return (
    <div style={{ border: "1px solid rgba(35,31,32,0.25)", boxShadow: "0 25px 60px rgba(0,0,0,0.35)" }}>
      <div className="h-[4px]" style={{ background: TOUFFOU.color }} />
      <div className="relative">
        <div className="aspect-video overflow-hidden">
          <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
        </div>
        {bridge && (
          <div
            className="absolute inset-x-0 bottom-0 pointer-events-none"
            style={{ height: 40, background: BRIDGE_GRADIENT }}
          />
        )}
      </div>
      <div className="px-10 py-7" style={{ background: PANEL_INK }}>
        <h2
          className="font-display text-white text-[40px] leading-[1.08] tracking-[0.5px]"
          style={{ textWrap: "balance" }}
        >
          {idea.name}
        </h2>
        {idea.description && (
          <p
            className="text-[19px] leading-[1.6] mt-3 max-w-[52ch]"
            style={{
              color: "rgba(255,255,255,0.92)",
              textWrap: "pretty",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
              overflow: "hidden",
            }}
          >
            {idea.description}
          </p>
        )}
        <p className="slug mt-4" style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
          {teamLabel}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ROUND 4 — THE STAGE SLIDE CARD (MOCK — DO NOT SHIP)
// ============================================================
// The user: does a printed Stage card read better as a concept
// presentation slide? Two-thirds print — the FULL 16:9 frame,
// uncropped (Round 9 law) — beside a one-third content column,
// split left/right, the card deliberately narrower than the row.
// Both orientations, static, beside the shipping stacked Stage
// card. Real Stage anatomy throughout: team spine, Sans-bold
// 26px title, 2-line description, shortlist control, and the
// returns (vote-count) variant with the timing-tower column.
// Dark ground, NO halftone — working surfaces carry no texture.

const STAGE_CARD_BG = "#1B1A1D";
const STAGE_HAIRLINE = "rgba(255,255,255,0.14)";
const STAGE_MUTED = "#a8a5a6";

function StageShortlistControl({ shortlisted }: { shortlisted: boolean }) {
  return (
    <span
      className="inline-block px-3 py-1 text-[11px] font-bold tracking-[1px] uppercase rounded"
      style={{
        background: shortlisted ? "rgba(255,255,255,0.1)" : "transparent",
        border: shortlisted ? "1px solid rgba(255,255,255,0.45)" : "1px solid rgba(255,255,255,0.2)",
        color: shortlisted ? "#fff" : STAGE_MUTED,
      }}
    >
      {shortlisted ? "★ Shortlisted" : "☆ Shortlist"}
    </span>
  );
}

function StageVotesColumn({ rank, count, leading }: { rank: number; count: number; leading: boolean }) {
  return (
    <div
      className="shrink-0 w-[90px] flex flex-col items-center justify-center py-4"
      style={{
        background: leading ? RED : "transparent",
        borderRight: leading ? "none" : `1px solid ${STAGE_HAIRLINE}`,
      }}
    >
      <div className="font-bold text-[16px] tracking-[2px] uppercase mb-1" style={{ color: leading ? "rgba(255,255,255,0.85)" : STAGE_MUTED }}>
        #{rank}
      </div>
      <div className="font-display text-[52px] leading-none tabular" style={{ color: "#fff" }}>
        {count}
      </div>
      <div className="font-bold text-[11px] tracking-[2px] uppercase mt-1" style={{ color: leading ? "rgba(255,255,255,0.85)" : "#6e6a6c" }}>
        votes
      </div>
    </div>
  );
}

function StageTitle({ idea, leading }: { idea: Idea; leading?: boolean }) {
  const shortlisted = idea.status === "starting_lineup";
  return (
    <div className="relative w-fit max-w-full">
      <h3 className="font-bold leading-tight text-white line-clamp-2 text-[26px] tracking-[-0.01em]">
        {shortlisted && <span className="text-[16px] mr-1.5">★</span>}
        {idea.name}
      </h3>
      {leading && (
        <span className="absolute -inset-x-4 -inset-y-2 pointer-events-none">
          <ChinaMark variant="circle" animate={false} strokeWidth={4} />
        </span>
      )}
    </div>
  );
}

function StageTeamRow({ teamColor, teamName }: { teamColor: string; teamName: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="w-[12px] h-[12px] shrink-0" style={{ background: teamColor }} />
      <span className="font-bold text-[14px] tracking-[1.5px] uppercase" style={{ color: "rgba(255,255,255,0.8)" }}>
        {teamName}
      </span>
    </div>
  );
}

function stageCardBorder(shortlisted: boolean): string {
  return shortlisted ? "2px solid rgba(255,255,255,0.45)" : `1px solid ${STAGE_HAIRLINE}`;
}

// The shipping Stage card, static replica — presenting state
// (spine · 168px filmstrip thumbnail · text · full-width footer).
function StageStackedPresenting({ idea, teamColor, width = 470 }: { idea: Idea; teamColor: string; width?: number }) {
  const shortlisted = idea.status === "starting_lineup";
  return (
    <div className="flex h-[180px] rounded-md overflow-hidden" style={{ width, background: STAGE_CARD_BG, border: stageCardBorder(shortlisted) }}>
      <div className="shrink-0 w-1" style={{ background: teamColor }} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 flex">
          <div className="shrink-0 w-[168px] flex items-center px-2" style={{ borderRight: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="w-full overflow-hidden" style={{ aspectRatio: "16 / 9", border: `1px solid ${STAGE_HAIRLINE}` }}>
              <PrintReveal src={idea.print_url!} alt={`Print — ${idea.name}`} />
            </div>
          </div>
          <div className="flex-1 min-w-0 px-5 py-4">
            <StageTitle idea={idea} />
            {idea.description && (
              <p className="mt-2 line-clamp-2 leading-relaxed text-[14px]" style={{ color: STAGE_MUTED }}>
                {idea.description}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center px-4 py-2" style={{ background: "#0A0A0C", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <StageShortlistControl shortlisted={shortlisted} />
        </div>
      </div>
    </div>
  );
}

// The shipping Stage card, static replica — returns state
// (timing-tower column · text · full-width footer; no print).
function StageStackedResults({
  idea, teamColor, teamName, rank, count, leading, width = 590,
}: {
  idea: Idea; teamColor: string; teamName: string; rank: number; count: number; leading: boolean; width?: number;
}) {
  const shortlisted = idea.status === "starting_lineup";
  return (
    <div className="flex min-h-[140px] rounded-md overflow-hidden" style={{ width, background: STAGE_CARD_BG, border: stageCardBorder(shortlisted) }}>
      <StageVotesColumn rank={rank} count={count} leading={leading} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 px-5 py-4">
          <StageTeamRow teamColor={teamColor} teamName={teamName} />
          <StageTitle idea={idea} leading={leading} />
          {idea.description && (
            <p className="mt-2 line-clamp-2 leading-relaxed text-[17px]" style={{ color: STAGE_MUTED }}>
              {idea.description}
            </p>
          )}
        </div>
        <div className="shrink-0 flex items-center px-4 py-2" style={{ background: "#0A0A0C", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <StageShortlistControl shortlisted={shortlisted} />
        </div>
      </div>
    </div>
  );
}

// THE SLIDE CARD — 2/3 full-frame 16:9 print, 1/3 content column.
// Card height derives from the print (aspect-video), so the frame
// is never cropped; the content column bottom-anchors its control.
function StageSlideCard({
  idea, teamColor, teamName, orientation, votes, printSrc,
}: {
  idea: Idea;
  teamColor: string;
  teamName?: string;
  orientation: "content-left" | "picture-left";
  votes?: { rank: number; count: number; leading: boolean };
  /** ALMANAC is seeded mid-ritual (sheet developed, no frame chosen), so
      its print_url is null — the mock pins its intended frame. */
  printSrc?: string;
}) {
  const shortlisted = idea.status === "starting_lineup";
  const contentLeft = orientation === "content-left";
  const printBox = (
    <div className="w-[576px] shrink-0 overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
      <PrintReveal src={printSrc ?? idea.print_url!} alt={`Print — ${idea.name}`} />
    </div>
  );
  const content = (
    <div
      className="w-[288px] shrink-0 min-w-0 p-5 flex flex-col"
      style={contentLeft ? { borderRight: "1px solid rgba(255,255,255,0.1)" } : { borderLeft: "1px solid rgba(255,255,255,0.1)" }}
    >
      {votes && teamName && <StageTeamRow teamColor={teamColor} teamName={teamName} />}
      <StageTitle idea={idea} leading={votes?.leading} />
      {idea.description && (
        <p className={`mt-2 line-clamp-2 leading-relaxed ${votes ? "text-[17px]" : "text-[14px]"}`} style={{ color: STAGE_MUTED }}>
          {idea.description}
        </p>
      )}
      <div className="mt-auto pt-3">
        <StageShortlistControl shortlisted={shortlisted} />
      </div>
    </div>
  );
  return (
    <div className="flex items-stretch rounded-md overflow-hidden w-fit" style={{ background: STAGE_CARD_BG, border: stageCardBorder(shortlisted) }}>
      {votes ? (
        <StageVotesColumn rank={votes.rank} count={votes.count} leading={votes.leading} />
      ) : (
        <div className="shrink-0 w-1" style={{ background: teamColor }} />
      )}
      {contentLeft ? (<>{content}{printBox}</>) : (<>{printBox}{content}</>)}
    </div>
  );
}

// ============================================================
// ROUND 5 — THE SPREAD'S ACTION BAR (MOCK — DECIDED)
// ============================================================
// OUTCOME (user ruling, 2026-07-31): B ships — the full-width bar,
// so every card in the system carries one action UI. B's objection
// (picture actions stranded under text, Kill reading as if it
// belonged to the photograph) was answered by moving the PICTURE
// actions onto the print as chips; the bar carries idea actions
// only. The mocks below are kept as the reference for the choice.
// ============================================================
// The shipping spread parks every action at the foot of the ~1/3
// content column. The question: should the actions instead run the
// FULL WIDTH of the card along the bottom — under both columns —
// the way the pre-spread card's row did?
//
// Both variants carry the same real anatomy as components/
// ExpandedCard.tsx: slug row, serif title, three live framework
// fields, Done slab + Coach outline, and the quiet line (Present /
// the darkroom pair / Kill). The Category Almanac, print-04, with
// its sheet kept — the longest quiet line there is, which is the
// case that stresses a 380px column.
//
// The consequence is measured live below each card: the picture
// region reports its rendered height, because moving the actions
// out of the column takes their height out of what props the print
// up. Nothing here is wired to the shipping component.

const R5_PRINT = "/prints/print-04.png";
const R5_QUIET =
  "flex items-center gap-1.5 h-7 font-bold text-[12px] tracking-[0.3px] whitespace-nowrap";
const R5_QUIET_INK = "rgba(35,31,32,0.55)";
const R5_QUIET_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  padding: 0,
  color: R5_QUIET_INK,
};
const R5_FIELD: React.CSSProperties = {
  background: FIELD_BG,
  border: `1px solid ${FIELD_BORDER}`,
  color: INK,
  borderRadius: 0,
};

function R5SlugRow() {
  return (
    <div
      className="shrink-0 flex items-center flex-wrap gap-x-3 gap-y-1.5 px-6 pt-4 pb-3"
      style={{ borderBottom: `1px solid ${HEADER_BORDER}` }}
    >
      <span className="slug text-[12px]" style={{ color: "#8A8689" }}>№ 03</span>
      <span
        className="font-bold text-[12px] tracking-[3px] uppercase px-2 py-1"
        style={{ color: PILLARS.category_2.color, background: `${PILLARS.category_2.color}15` }}
      >
        {PILLARS.category_2.label} ▾
      </span>
      <span className="stamp" style={{ color: RED }}>{STATUS_LABELS.starting_lineup}</span>
      <span
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: R5_QUIET_INK }}
      >
        <span className="text-[12px] leading-none">★</span>
        Stage
      </span>
      <div className="ml-auto flex items-center gap-2">
        <span className="slug text-[12px] opacity-50" style={{ color: "#8A8689" }}>Saved</span>
        <span className="text-2xl leading-none p-1.5 opacity-40" style={{ color: INK }}>×</span>
      </div>
    </div>
  );
}

// The manuscript exactly as the spread sets it: 30px serif title,
// three stacked fields sharing one border run.
function R5Manuscript({ idea }: { idea: Idea }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className="mb-3">
        <input
          type="text"
          defaultValue={idea.name}
          className="w-full bg-transparent font-display tracking-[1px] focus:outline-none pb-2 text-[30px]"
          style={{ color: INK, borderBottom: `1px solid ${FIELD_BORDER}` }}
        />
      </div>
      <div className="flex flex-col">
        <div style={R5_FIELD}>
          <FieldLabel>Idea</FieldLabel>
          <textarea
            defaultValue={idea.description || ""}
            rows={3}
            className="w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none min-h-[96px] text-[18px]"
            style={{ color: INK, fieldSizing: "content" } as React.CSSProperties}
          />
        </div>
        <div style={{ ...R5_FIELD, borderTop: "none" }}>
          <FieldLabel>Connection to The Well-Informed Unconscious</FieldLabel>
          <textarea
            defaultValue={(idea.bbei_connection as string) || ""}
            rows={2}
            className="w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none min-h-[64px] text-[18px]"
            style={{ color: INK, fieldSizing: "content" } as React.CSSProperties}
          />
        </div>
        <div style={{ ...R5_FIELD, borderTop: "none" }}>
          <FieldLabel>{FRAMEWORK_FIELDS.find((f) => f.key === "key_partners")!.label}</FieldLabel>
          <textarea
            defaultValue={(idea.key_partners as string) || ""}
            rows={2}
            className="w-full bg-transparent px-4 pb-4 leading-[1.6] focus:outline-none resize-none min-h-[64px] text-[18px]"
            style={{ color: INK, fieldSizing: "content" } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}

// The primary pair. In the column they split the measure; on the
// full-width bar they hold a fixed measure at the left margin —
// a 1420px-wide Done slab would be a billboard, not a button.
function R5PrimaryPair({ span }: { span?: boolean }) {
  const slab = span
    ? "flex-1 basis-0 min-w-0 flex items-center justify-center h-12 font-bold text-[13px] tracking-[1px]"
    : "flex items-center justify-center h-12 font-bold text-[13px] tracking-[1px] px-10";
  const outline = span
    ? "flex-1 basis-0 min-w-0 flex items-center justify-center gap-2.5 h-12 font-bold text-[13px] tracking-[1px]"
    : "flex items-center justify-center gap-2.5 h-12 font-bold text-[13px] tracking-[1px] px-6";
  return (
    <>
      <button className={slab} style={{ background: INK, color: "#fff" }}>Done</button>
      <button
        className={outline}
        style={{ background: "transparent", border: "1px solid rgba(35,31,32,0.3)", color: INK }}
      >
        <MarkCoach size={18} />
        Coach this idea
      </button>
    </>
  );
}

function R5QuietOptions() {
  return (
    <>
      <button className={R5_QUIET} style={{ ...R5_QUIET_STYLE, color: INK }}>
        <span className="text-[13px] leading-none">★</span>
        On the Stage
      </button>
      <span className="flex items-center gap-x-4">
        <button className={R5_QUIET} style={R5_QUIET_STYLE}>
          <MarkGenerate size={16} />
          Choose another frame
        </button>
        <button className={R5_QUIET} style={R5_QUIET_STYLE}>New sheet</button>
      </span>
    </>
  );
}

function R5Kill() {
  return (
    <button
      className={`${R5_QUIET} ml-auto shrink-0`}
      style={{ ...R5_QUIET_STYLE, color: "rgba(35,31,32,0.4)" }}
    >
      <MarkKill size={16} />
      Kill
    </button>
  );
}

function R5Picture({ regionRef }: { regionRef: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={regionRef}
      className="relative flex-1 min-w-0 overflow-hidden"
      style={{ borderLeft: `1px solid ${HEADER_BORDER}`, aspectRatio: "16 / 9" }}
    >
      <PrintReveal src={R5_PRINT} alt="Print — The Category Almanac" />
    </div>
  );
}

function R5Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-full mx-auto flex flex-col overflow-hidden"
      style={{
        maxWidth: 1420,
        maxHeight: "calc(100vh - 80px)",
        background: "#FFFFFF",
        color: INK,
        border: "1px solid rgba(35,31,32,0.25)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
      }}
    >
      <div className="h-[4px] shrink-0" style={{ background: TOUFFOU.color }} />
      {children}
    </div>
  );
}

// ── A. COLUMN ACTIONS (SHIPPING) ─────────────────────────────
function R5ColumnActions({ idea, regionRef }: { idea: Idea; regionRef: React.Ref<HTMLDivElement> }) {
  return (
    <R5Shell>
      <div className="flex-1 min-h-0 flex items-stretch">
        <div className="flex flex-col min-h-0 min-w-0" style={{ width: "34%", minWidth: 380 }}>
          <R5SlugRow />
          <R5Manuscript idea={idea} />
          <div
            className="shrink-0 flex flex-col gap-3 px-6 py-4"
            style={{ borderTop: `1px solid ${HEADER_BORDER}` }}
          >
            <div className="flex gap-2.5">
              <R5PrimaryPair span />
            </div>
            <div className="flex items-start gap-x-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
                <R5QuietOptions />
              </div>
              <R5Kill />
            </div>
          </div>
        </div>
        <R5Picture regionRef={regionRef} />
      </div>
    </R5Shell>
  );
}

// ── B. FULL-WIDTH BAR ────────────────────────────────────────
// The split body holds the card; ONE bar runs under both columns.
// The wider measure buys the row back: primary pair at the left
// margin (aligned to the manuscript), the quiet options on the
// SAME line instead of a second one, Kill at the far right edge.
function R5FullWidthBar({ idea, regionRef }: { idea: Idea; regionRef: React.Ref<HTMLDivElement> }) {
  return (
    <R5Shell>
      <div className="flex-1 min-h-0 flex items-stretch">
        <div className="flex flex-col min-h-0 min-w-0" style={{ width: "34%", minWidth: 380 }}>
          <R5SlugRow />
          <R5Manuscript idea={idea} />
        </div>
        <R5Picture regionRef={regionRef} />
      </div>
      <div
        className="shrink-0 flex items-center gap-8 px-6 py-3"
        style={{ borderTop: `1px solid ${HEADER_BORDER}` }}
      >
        <div className="flex gap-2.5 shrink-0">
          <R5PrimaryPair />
        </div>
        <div className="flex items-center gap-x-6 min-w-0">
          <R5QuietOptions />
        </div>
        <R5Kill />
      </div>
    </R5Shell>
  );
}

// The consequence, measured: the picture region's rendered height
// in each variant, read off the live DOM (not asserted in a caption).
function R5Round({ idea }: { idea: Idea }) {
  const colRegion = useRef<HTMLDivElement>(null);
  const barRegion = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<{ a: number; b: number } | null>(null);

  useIsomorphicLayoutEffect(() => {
    const measure = () => {
      const a = colRegion.current?.offsetHeight ?? 0;
      const b = barRegion.current?.offsetHeight ?? 0;
      setH((prev) => (prev && prev.a === a && prev.b === b ? prev : { a, b }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (colRegion.current) ro.observe(colRegion.current);
    if (barRegion.current) ro.observe(barRegion.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const delta = h ? h.b - h.a : 0;

  return (
    <div className="flex flex-col gap-10 py-10 px-6" style={{ background: DIM_GROUND }}>
      <div>
        <p className="slug mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
          A · COLUMN ACTIONS — SHIPPING REFERENCE
        </p>
        <R5ColumnActions idea={idea} regionRef={colRegion} />
        <p className="slug mt-3" style={{ color: "rgba(255,255,255,0.72)" }}>
          PICTURE REGION MEASURES {h ? h.a : "—"} PX TALL · THE ACTION BLOCK SITS INSIDE THE COLUMN AND PROPS THE PRINT UP
        </p>
      </div>
      <div>
        <p className="slug mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
          B · FULL-WIDTH BAR — ONE ROW UNDER BOTH COLUMNS
        </p>
        <R5FullWidthBar idea={idea} regionRef={barRegion} />
        <p className="slug mt-3" style={{ color: "rgba(255,255,255,0.72)" }}>
          PICTURE REGION MEASURES {h ? h.b : "—"} PX TALL · THE BAR TAKES ITS HEIGHT OUT OF THE BODY
        </p>
      </div>
      <div className="px-5 py-4" style={{ border: "1px solid rgba(255,255,255,0.28)" }}>
        <p className="slug mb-1.5" style={{ color: RED }}>THE PRINT-HEIGHT CONSEQUENCE, MEASURED LIVE</p>
        <p className="text-[15px] leading-[1.55]" style={{ color: "#fff" }}>
          {h ? (
            <>
              The bar costs the print <strong className="tabular">{Math.abs(delta)} px</strong> of height
              — {h.a} px in A against {h.b} px in B at this viewport. The actions no longer stand inside
              the column, so their height stops holding the body open, and the picture falls back toward
              its own 16:9 floor.
            </>
          ) : (
            "Measuring…"
          )}
        </p>
      </div>
    </div>
  );
}

function StageRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="slug mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>{label}</p>
      <div className="flex flex-wrap gap-6 items-start">{children}</div>
    </div>
  );
}

function OpenSection({
  letter,
  name,
  thesis,
  degrade,
  children,
}: {
  letter: string;
  name: string;
  thesis: string;
  degrade: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-4 mb-1">
        <span className="font-display font-bold text-[44px] leading-none" style={{ color: RED }}>
          {letter}
        </span>
        <h2 className="font-bold text-[20px]" style={{ color: INK }}>{name}</h2>
      </div>
      <p className="text-[15px] leading-[1.55] max-w-[720px]" style={{ color: BODY }}>{thesis}</p>
      <p className="slug mt-1.5 mb-5" style={{ color: "#8A8689" }}>{degrade}</p>
      {children}
    </section>
  );
}

// ── The sheet ────────────────────────────────────────────────

function Section({
  letter,
  name,
  thesis,
  homes,
  children,
}: {
  letter: string;
  name: string;
  thesis: string;
  homes: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-4 mb-1">
        <span className="font-display font-bold text-[44px] leading-none" style={{ color: RED }}>
          {letter}
        </span>
        <h2 className="font-bold text-[20px]" style={{ color: INK }}>{name}</h2>
      </div>
      <p className="text-[15px] leading-[1.55] max-w-[720px]" style={{ color: BODY }}>{thesis}</p>
      <p className="slug mt-1.5 mb-5" style={{ color: "#8A8689" }}>{homes}</p>
      <div className="grid grid-cols-3 gap-6 items-start">{children}</div>
    </section>
  );
}

export default function CardLabPage() {
  return (
    <main className="min-h-screen bg-white px-12 py-10" style={{ color: INK }}>
      <div className="max-w-[1504px] mx-auto">
        <p className="slug mb-2" style={{ color: RED }}>CARD LAB · OPTION STUDY · NOT SHIPPING</p>
        <h1 className="font-display font-bold text-[44px] leading-[1.1] mb-3">
          The print, front and&nbsp;center.
        </h1>
        <p className="text-[16px] leading-[1.6] max-w-[760px] mb-12" style={{ color: BODY }}>
          Four treatments for the card that holds a Darkroom print. Each row shows two real
          printed ideas beside the unprinted sibling exactly as it ships today. The current
          strip treatment leads for reference; the shipping default is unchanged until you pick.
        </p>

        <section className="mb-16">
          <div className="flex items-baseline gap-4 mb-1">
            <span className="font-display font-bold text-[44px] leading-none" style={{ color: "#8A8689" }}>—</span>
            <h2 className="font-bold text-[20px]">Shipping (live reference)</h2>
          </div>
          <p className="text-[15px] leading-[1.55] max-w-[720px]" style={{ color: BODY }}>
            This row renders the real IdeaCard, so it always shows what ships. At the time of
            the study it was the 124px strip the brief reacted to; candidate B below was
            promoted (proof-print anatomy capped at 344px), and this row now reflects it.
          </p>
          <p className="slug mt-1.5 mb-5" style={{ color: "#8A8689" }}>
            SELECT: CIRCLES THE TEXT BELOW THE PRINT · STAMPS: BOTTOM EDGE ON PAPER
          </p>
          <div className="grid grid-cols-3 gap-6 items-start">
            <IdeaCard idea={HOMEWORK} onClick={() => {}} index={0} frameNo={LAB_NO.get(HOMEWORK.id) ?? 1} />
            <IdeaCard idea={ALMANAC} onClick={() => {}} index={1} frameNo={LAB_NO.get(ALMANAC.id) ?? 1} />
            <IdeaCard idea={SECOND} onClick={() => {}} index={2} frameNo={LAB_NO.get(SECOND.id) ?? 1} />
          </div>
        </section>

        <Section
          letter="A"
          name="The Poster"
          thesis="The print takes the whole card; an ink scrim rises from the bottom and the title sets on the image in white. The card becomes the idea's one-sheet — the description waits in the expanded card."
          homes="SELECT: CIRCLES THE TITLE ON THE SCRIM · STAMPS: ON THE SCRIM, INK FAMILY GOES WHITE, SHORTLISTED KEEPS RED"
        >
          <PosterCard idea={HOMEWORK} n={1} />
          <PosterCard idea={ALMANAC} n={3} />
          <UnprintedCard idea={SECOND} n={4} />
        </Section>

        <Section
          letter="B"
          name="The Proof Print"
          thesis="Contact-sheet vocabulary: the print sits with generous paper margins inside the frame — a print pinned on the card — with the title as its caption line and the № as the frame number it already is."
          homes="SELECT: CIRCLES THE MATTED FRAME, WAX MULTIPLY · STAMPS: ON THE MAT, BOTTOM EDGE"
        >
          <ProofPrintCard idea={HOMEWORK} n={1} />
          <ProofPrintCard idea={ALMANAC} n={3} />
          <UnprintedCard idea={SECOND} n={4} />
        </Section>

        <Section
          letter="C"
          name="The Split Frame"
          thesis="Landscape: the printed card widens to two grid columns — print left at real size, text right. The printed idea literally takes more of the board."
          homes="SELECT: CIRCLES THE TITLE IN THE TEXT PANEL, WAX MULTIPLY · STAMPS: BOTTOM OF THE TEXT PANEL"
        >
          <SplitFrameCard idea={HOMEWORK} n={1} />
          <UnprintedCard idea={SECOND} n={4} />
          <SplitFrameCard idea={ALMANAC} n={3} />
        </Section>

        <Section
          letter="D"
          name="The Tall Cover"
          thesis="Evolution of the strip: the image takes two-thirds of a taller card and the title overlaps its bottom edge on a paper chip — the text block compresses but everything stays on the card."
          homes="SELECT: CIRCLES THE TEXT BLOCK BELOW THE PRINT, WAX MULTIPLY · STAMPS: BOTTOM EDGE ON PAPER"
        >
          <TallCoverCard idea={HOMEWORK} n={1} />
          <TallCoverCard idea={ALMANAC} n={3} />
          <UnprintedCard idea={SECOND} n={4} />
        </Section>

        {/* ════ ROUND 2 — THE OPEN CARD ════ */}
        <div id="open-round">
        <div className="pt-8 mt-4" style={{ borderTop: `2px solid ${INK}` }}>
          <p className="slug mb-2" style={{ color: RED }}>ROUND 2 · THE OPEN CARD, A–D</p>
          <h2 className="font-display font-bold text-[36px] leading-[1.1] mb-3">
            What it looks like when it&nbsp;opens.
          </h2>
          <p className="text-[16px] leading-[1.6] max-w-[760px] mb-12" style={{ color: BODY }}>
            Today the open card shows the print only as the small &ldquo;In print&rdquo; chip in the
            action row. Four ways the print takes real presence in the paper modal — real
            anatomy, live textareas, all set with The Category Almanac on the true modal dim.
            The shipping ExpandedCard is unchanged until you pick.
          </p>
        </div>

        <OpenSection
          letter="A"
          name="The Frontispiece"
          thesis="Book-plate structure: the print runs full-width and generous at the top of the paper card, and the manuscript reads below it. Nothing overlaps the image, so no scrim is needed; the action row's chip retires."
          degrade="NO PRINT YET: THE BLOCK SIMPLY ISN'T THERE — THE CARD IS TODAY'S CARD, NO HOLE"
        >
          <OpenFrontispiece idea={ALMANAC} />
        </OpenSection>

        <OpenSection
          letter="B"
          name="The Plate"
          thesis="Editorial page: the print sits at ~40% width beside the manuscript, caption slug beneath it, framework fields stacked under the plate — a magazine spread on one page."
          degrade="NO PRINT YET: THE RIGHT COLUMN REVERTS TO THE STACKED FIELDS — SAME PAGE, NO PLATE"
        >
          <OpenPlate idea={ALMANAC} />
        </OpenSection>

        <OpenSection
          letter="C"
          name="The Facing Spread"
          thesis="The open card widens into a two-page spread: the manuscript stays the left page, the print is the full right page with its caption strip — the coach takeover's 50/50 grammar."
          degrade="NO PRINT YET: THE CARD FALLS BACK TO SINGLE-PAGE WIDTH — TWO CARD SIZES EXIST IN ONE SESSION"
        >
          <OpenSpread idea={ALMANAC} />
        </OpenSection>

        <OpenSection
          letter="D"
          name="The Backdrop Lift"
          thesis="The print becomes the theater: full-bleed behind the modal under an ink dim, while the paper card ships exactly as today — the room sees the image large, the reader keeps the manuscript."
          degrade="NO PRINT YET: THE DIM IS TODAY'S PLAIN OVERLAY — IDENTICAL CARD, QUIETER ROOM"
        >
          <OpenBackdrop idea={ALMANAC} />
        </OpenSection>
        </div>

        {/* ════ ROUND 3 — THE SEAM BRIDGE ════ */}
        <div id="seam-bridge" className="pt-8 mt-4" style={{ borderTop: `2px solid ${INK}` }}>
          <p className="slug mb-2" style={{ color: RED }}>
            ROUND 3 · THE SEAM BRIDGE · RULED 2026-08-05 — A SHIPS, B REJECTED
          </p>
          <h2 className="font-display font-bold text-[36px] leading-[1.1] mb-3">
            One printed object, or two stacked&nbsp;rectangles.
          </h2>
          <p className="text-[16px] leading-[1.6] max-w-[760px] mb-8" style={{ color: BODY }}>
            The shipping poster stacks the print over its solid ink panel with a hard seam.
            Candidate B dissolves the print&rsquo;s bottom 40 pixels into the panel&rsquo;s exact
            ground on an eased ten-stop gradient, so the poster reads as one printed object.
            No text ever enters the bridge zone, and the panel stays solid under every line of
            type. Squint at both, at full width and at projection scale, before this goes
            anywhere near the shipping component.
          </p>
          <div className="py-12 px-10 grid grid-cols-2 gap-10 items-start" style={{ background: DIM_GROUND }}>
            <div>
              <p className="slug mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                A · SHIPPING — HARD SEAM
              </p>
              <SeamPoster idea={HOMEWORK} teamLabel="Touffou · № 01" />
            </div>
            <div>
              <p className="slug mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                B · SEAM BRIDGE — 40PX EASED DISSOLVE
              </p>
              <SeamPoster idea={HOMEWORK} teamLabel="Touffou · № 01" bridge />
            </div>
          </div>
        </div>

        {/* ════ ROUND 4 — THE STAGE SLIDE CARD ════ */}
        <div id="stage-slide-round" className="pt-8 mt-16" style={{ borderTop: `2px solid ${INK}` }}>
          <p className="slug mb-2" style={{ color: RED }}>
            ROUND 4 · THE STAGE SLIDE CARD · MOCK — DO NOT SHIP
          </p>
          <h2 className="font-display font-bold text-[36px] leading-[1.1] mb-3">
            The printed card as a concept&nbsp;slide.
          </h2>
          <p className="text-[16px] leading-[1.6] max-w-[760px] mb-8" style={{ color: BODY }}>
            A printed Stage card recomposed as a presentation slide: two-thirds print — the
            full 16:9 frame, uncropped — beside a one-third content column, the card
            deliberately narrower than the row. Both orientations, in presenting and returns
            states, with the shipping stacked card above for scale. Real anatomy throughout:
            team spine, Sans-bold title, two-line description, shortlist control, and the
            returns column.
          </p>
          <div className="flex flex-col gap-12 p-10" style={{ background: "#0A0A0C" }}>
            <StageRow label="SHIPPING — THE STACKED STAGE CARD (REFERENCE) · PRESENTING + RETURNS">
              <StageStackedPresenting idea={HOMEWORK} teamColor={TOUFFOU.color} />
              <StageStackedResults idea={ALMANAC} teamColor={TOUFFOU.color} teamName={TOUFFOU.name} rank={1} count={24} leading />
            </StageRow>
            <StageRow label="V1 · CONTENT LEFT / PICTURE RIGHT">
              <StageSlideCard idea={HOMEWORK} teamColor={TOUFFOU.color} orientation="content-left" />
              <StageSlideCard idea={ALMANAC} teamColor={TOUFFOU.color} teamName={TOUFFOU.name} orientation="content-left" votes={{ rank: 1, count: 24, leading: true }} printSrc="/prints/print-04.png" />
            </StageRow>
            <StageRow label="V2 · PICTURE LEFT / CONTENT RIGHT">
              <StageSlideCard idea={ALMANAC} teamColor={TOUFFOU.color} orientation="picture-left" printSrc="/prints/print-04.png" />
              <StageSlideCard idea={HOMEWORK} teamColor={TOUFFOU.color} teamName={TOUFFOU.name} orientation="picture-left" votes={{ rank: 2, count: 17, leading: false }} />
            </StageRow>
          </div>
        </div>

        {/* ════ ROUND 5 — THE SPREAD'S ACTION BAR ════ */}
        <div id="action-bar-round" className="pt-8 mt-16" style={{ borderTop: `2px solid ${INK}` }}>
          <p className="slug mb-2" style={{ color: RED }}>
            ROUND 5 · THE SPREAD&rsquo;S ACTION BAR · MOCK — DO NOT SHIP
          </p>
          <h2 className="font-display font-bold text-[36px] leading-[1.1] mb-3">
            Do the actions belong to the column, or to the&nbsp;card?
          </h2>
          <p className="text-[16px] leading-[1.6] max-w-[760px] mb-8" style={{ color: BODY }}>
            The shipping spread parks every action at the foot of the one-third content column, so the
            Done slab and the Coach outline split a 380px measure and the quiet options wrap onto their
            own line beneath. The alternative is the row the card had before the spread: one bar running
            the full width along the bottom, under both columns, with the primary pair, the options, and
            Kill laid out across the wider measure. Same anatomy in both — The Category Almanac, print-04,
            sheet kept, which is the longest quiet line the card can carry. The consequence for the print
            is measured live under each card.
          </p>
          <R5Round idea={ALMANAC} />
        </div>

        {/* ════ ROUND 6 — HOW THE COACH'S WORDS ARRIVE ════ */}
        <ArrivalRound />

        {/* ════ ROUND 7 — THE SHARED CLOCK ════ */}
        <ClockRound />
      </div>
    </main>
  );
}
