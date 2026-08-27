// ============================================================
// Workshop PPTX Export — the print register, in PowerPoint
// ============================================================
// Generates a PowerPoint deliverable from the workshop ideas,
// organized by team. Runs entirely client-side via dynamic import
// to avoid SSR issues.
//
// DESIGN CONTRACT: docs/ogilvy-showcase-direction.md. The deck sits in
// the EDITION (print) register — paper ground, ink type, serif mastheads,
// red as the rule and the mark, never a flood. The team hue is a GROUND
// on exactly one slide per team (the divider, the Board's hero-band
// idiom), where luminance picks the type on top of it — cobalt and
// oxblood take white, the warm stone takes ink. Nothing here is green:
// the Sprite palette (#01A44D), the NBA blue and the yellow wave accent
// have been on the kill list since Round 1 and are gone.
//
// FONTS. PptxGenJS writes a font NAME; it cannot embed a face, and the
// licensed Ogilvy woff2s in public/fonts are not installable by a
// client opening this deck. So the deck ships on the direction doc's own
// declared fallbacks — Georgia for the serif register, Arial for the
// sans — which are present on every Mac and Windows machine. On a
// machine that HAS the licensed faces installed (Ogilvy's own), change
// the two constants below to "Ogilvy Serif" / "Ogilvy Sans" and the deck
// renders in the real identity with no other edit.
//
// Deck structure:
//   1. Cover
//   2. Workshop snapshot
//   3+. For each team: team divider → category sub-sections → idea cards
//   last. Next Steps
// ============================================================

import { Idea, Team } from "./types";
import { BRAND, PILLARS, GROUPS, WAVES, WAVE_LIST, type PillarSlug, type Wave } from "./config";
import { ideaNumbers, qualifiedIdeaNo } from "./idea-number";

// pptxgenjs ships no usable structural types for a slide/presentation
// handle, so both are aliased once here rather than disabling the rule
// on every generator below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pres = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Slide = any;

// Dynamic import to avoid SSR issues — pptxgenjs needs browser APIs
let PptxGenJS: Pres = null;
async function getPptxGenJS() {
  if (!PptxGenJS) {
    const mod = await import("pptxgenjs");
    PptxGenJS = mod.default || mod;
  }
  return PptxGenJS;
}

// ── Design tokens (PptxGenJS wants hex WITHOUT the hash) ──
const hex = (v: string) => v.replace("#", "").toUpperCase();

const COLORS = {
  ink: hex(BRAND.colors.ink),          // 231F20 — type on paper
  paper: hex(BRAND.colors.paper),      // FFFFFF
  paperDim: hex(BRAND.colors.paperDim), // EDEDED — the OWNER column's blank
  red: hex(BRAND.colors.primary),      // the accent — the voice: rules and marks
  muted: "7A7577",                     // ink at reading weight for slugs
  mutedLight: "A8A5A6",                // folios
  hairline: "D5D2D3",                  // table rules
};

// See FONTS in the header block. One edit each to wear the real faces.
const FONT_DISPLAY = "Georgia";
const FONT = "Arial";

// Standard 16:9 PowerPoint slide dimensions: 13.33" × 7.5"
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN_X = 0.6;
const MARGIN_Y = 0.5;
const CONTENT_W = SLIDE_W - MARGIN_X * 2; // 12.13"

// Category display labels come from config — never hardcoded. The old
// export printed "CATEGORY 1" on every slide of every deck, whatever the
// engagement had actually named its categories.
const PILLAR_TITLES: Record<PillarSlug, string> = Object.fromEntries(
  Object.values(PILLARS).map((p) => [p.slug, p.label.toUpperCase()])
) as Record<PillarSlug, string>;

// Wave display labels from config (D-10) — the deck can no longer carry
// a label set the report disagrees with. (The fiscal years the Sprite
// deck carried, "2026/27", were that engagement's, not a platform fact.)
const WAVE_TITLES: Record<Wave, string> = Object.fromEntries(
  WAVE_LIST.map((w) => [w.slug, w.abbr])
) as Record<Wave, string>;

// Maximum ideas per overview table slide. If a wave has more, paginate into
// multiple slides labeled "Wave 1 · 1 of 2", etc.
const MAX_IDEAS_PER_OVERVIEW_SLIDE = 5;
const MAX_TABLE_CELL_CHARS = 200; // ~3-4 lines of 9pt in overview tables — full text on idea card slides

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

// ── Helpers ──

/**
 * White or ink on a team-hue GROUND, by luminance — the same rule the
 * Board's hero band and the ticker chips run (`bandText`). Cobalt and
 * oxblood take white; the warm stone takes ink.
 */
function bandText(hex6: string): string {
  const n = parseInt(hex6, 16);
  const yiq = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return yiq > 128 ? COLORS.ink : COLORS.paper;
}

/**
 * Mix two hexes. The deck needs quieter tones of the band-text colour on
 * a team-hue ground, and it CANNOT get them from an alpha: a text run
 * that carries both letter-spacing and an alpha loses its last character
 * in LibreOffice's renderer (measured — "TEAM" printed "TEA" on every
 * divider, and the same run without the alpha printed whole). The deck is
 * a client hand-off and has to survive whatever opens it, so every
 * softened tone here is a real colour, mixed up front.
 */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a, 16), pb = parseInt(b, 16);
  const ch = (n: number, sh: number) => (n >> sh) & 255;
  const out = [16, 8, 0].map((sh) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t));
  return out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** A team's hue from config first (the heritage palette), the row second. */
function teamHue(team: Team): string {
  const group = Object.values(GROUPS).find((g) => g.slug === team.slug);
  return hex(group?.color || team.color || BRAND.colors.ink);
}

const FOOTER_LINE = `${BRAND.subtitle} ${BRAND.name} · ${BRAND.workshopTitle}`.toUpperCase();

function addFooter(slide: Slide, pageLabel: string) {
  slide.addText(FOOTER_LINE, {
    x: MARGIN_X,
    y: SLIDE_H - 0.4,
    w: CONTENT_W * 0.7,
    fontSize: 8,
    color: COLORS.mutedLight,
    fontFace: FONT,
    charSpacing: 1.5,
  });
  slide.addText(pageLabel, {
    x: MARGIN_X + CONTENT_W * 0.7,
    y: SLIDE_H - 0.4,
    w: CONTENT_W * 0.3,
    fontSize: 8,
    color: COLORS.mutedLight,
    fontFace: FONT,
    align: "right",
  });
}

/** The eyebrow slug: tracked caps, ink at reading weight. Never red — red
    is the rule and the mark on this register, not small running type. */
function addSlug(slide: Slide, text: string, y = MARGIN_Y) {
  slide.addText(text, {
    x: MARGIN_X,
    y,
    w: CONTENT_W,
    fontSize: 10,
    color: COLORS.muted,
    fontFace: FONT,
    bold: true,
    charSpacing: 3,
  });
}

/** The red rule — the deck's one recurring mark. */
function addRedRule(slide: Slide, y: number, w = CONTENT_W, width = 2) {
  slide.addShape("line", {
    x: MARGIN_X,
    y,
    w,
    h: 0,
    line: { color: COLORS.red, width },
  });
}

function getTeamName(idea: Idea, teams: Team[]): string {
  if (!idea.team_id) return "";
  const team = teams.find((t) => t.id === idea.team_id);
  return team?.display_name || team?.name || "";
}

/** `HATHAWAY 03` — the qualified №. A deck is a multi-team surface, so
    every number it prints is qualified by its team (Round 16 item 3). */
function ideaLabel(idea: Idea, teams: Team[], numbers: Map<string, number>): string | null {
  const n = numbers.get(idea.id);
  if (n == null) return null;
  const team = getTeamName(idea, teams).toUpperCase();
  return qualifiedIdeaNo(n, team || null);
}

// ── Slide generators ──

function addCoverSlide(pres: Pres, ideaCount: number, dateLabel: string) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.paper };

  // The one red bar in the deck — the wordmark band.
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.34,
    fill: { color: COLORS.red },
    line: { color: COLORS.red },
  });
  slide.addText(BRAND.subtitle.toUpperCase(), {
    x: MARGIN_X,
    y: 0.02,
    w: CONTENT_W,
    h: 0.3,
    fontSize: 12,
    color: COLORS.paper,
    fontFace: FONT,
    bold: true,
    charSpacing: 4,
    valign: "middle",
  });

  addSlug(slide, `${BRAND.name.toUpperCase()} · CO-CREATION WORKSHOP`, 1.5);

  slide.addText(BRAND.workshopTitle, {
    x: MARGIN_X,
    y: 2.0,
    w: CONTENT_W,
    h: 1.9,
    fontSize: 60,
    color: COLORS.ink,
    fontFace: FONT_DISPLAY,
    valign: "middle",
  });

  addRedRule(slide, 4.15);

  slide.addText(`${ideaCount} ${ideaCount === 1 ? "idea" : "ideas"}  ·  ${dateLabel}`, {
    x: MARGIN_X,
    y: 4.42,
    w: CONTENT_W,
    fontSize: 16,
    color: COLORS.muted,
    fontFace: FONT,
  });

  slide.addText(
    "Everything the room made, by team. Real ideas only. Overview tables are editable — assign owners in them.",
    {
      x: MARGIN_X,
      y: 5.0,
      w: CONTENT_W * 0.62,
      h: 0.8,
      fontSize: 13,
      color: COLORS.muted,
      fontFace: FONT,
      valign: "top",
      lineSpacingMultiple: 1.3,
    }
  );
}

function addSnapshotSlide(pres: Pres, ideas: Idea[], teams: Team[]) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.paper };

  addSlug(slide, "WORKSHOP SNAPSHOT");

  slide.addText("What the room made", {
    x: MARGIN_X,
    y: 0.82,
    w: CONTENT_W,
    h: 0.8,
    fontSize: 36,
    color: COLORS.ink,
    fontFace: FONT_DISPLAY,
    valign: "middle",
  });
  addRedRule(slide, 1.66, 2.4);

  // Compute stats
  const wave1Count = ideas.filter((i) => i.wave === "wave_1" || i.wave === null).length;
  const wave2Count = ideas.filter((i) => i.wave === "wave_2").length;
  const shortlisted = ideas.filter((i) => i.status === "starting_lineup").length;

  const col3W = CONTENT_W / 3;
  const row1Y = 1.9;

  const row1Stats = [
    { label: "TOTAL IDEAS", value: ideas.length.toString() },
    { label: "SHORTLISTED", value: shortlisted.toString() },
    { label: "COACHED OR BETTER", value: ideas.filter((i) => i.status !== "draft").length.toString() },
  ];

  row1Stats.forEach((stat, i) => {
    slide.addText(stat.value, {
      x: MARGIN_X + i * col3W,
      y: row1Y,
      w: col3W - 0.2,
      h: 1.25,
      fontSize: 72,
      color: COLORS.ink,
      fontFace: FONT_DISPLAY,
    });
    slide.addText(stat.label, {
      x: MARGIN_X + i * col3W,
      y: row1Y + 1.3,
      w: col3W - 0.2,
      fontSize: 9,
      color: COLORS.muted,
      fontFace: FONT,
      bold: true,
      charSpacing: 2,
    });
  });

  slide.addShape("line", {
    x: MARGIN_X,
    y: 3.6,
    w: CONTENT_W,
    h: 0,
    line: { color: COLORS.hairline, width: 0.75 },
  });

  // Row 2: by category, then the waves — the same ink, one size down, so
  // the breakdown reads as detail under the headline rather than a
  // second headline in a second colour.
  const row2Y = 3.82;
  const byCategory = Object.values(PILLARS).map((p) => ({
    label: PILLAR_TITLES[p.slug],
    value: ideas.filter((i) => i.category === p.slug).length.toString(),
  }));

  byCategory.forEach((stat, i) => {
    slide.addText(stat.value, {
      x: MARGIN_X + i * col3W,
      y: row2Y,
      w: col3W - 0.2,
      h: 1.0,
      fontSize: 52,
      color: COLORS.ink,
      fontFace: FONT_DISPLAY,
    });
    slide.addText(stat.label, {
      x: MARGIN_X + i * col3W,
      y: row2Y + 1.02,
      w: col3W - 0.2,
      fontSize: 9,
      color: COLORS.muted,
      fontFace: FONT,
      bold: true,
      charSpacing: 2,
    });
  });

  // The room + the waves, on one quiet line
  const teamNames = teams.map((t) => t.display_name || t.name).filter(Boolean).join("  ·  ");
  slide.addText("THE ROOM", {
    x: MARGIN_X,
    y: 5.45,
    w: CONTENT_W,
    fontSize: 9,
    color: COLORS.muted,
    fontFace: FONT,
    bold: true,
    charSpacing: 2,
  });
  slide.addText(
    [
      { text: teamNames || "—", options: { fontSize: 14, color: COLORS.ink, fontFace: FONT } },
      ...(wave1Count + wave2Count > 0
        ? [{
            text: `      ${WAVES.wave_1.abbr}: ${wave1Count}   ·   ${WAVES.wave_2.abbr}: ${wave2Count}`,
            options: { fontSize: 12, color: COLORS.muted, fontFace: FONT },
          }]
        : []),
    ],
    { x: MARGIN_X, y: 5.75, w: CONTENT_W, h: 0.4, valign: "middle" }
  );

  addFooter(slide, "Workshop Snapshot");
}

function addTeamDividerSlide(pres: Pres, team: Team, ideaCount: number, wave1Count: number, wave2Count: number, visionText: string | null) {
  const slide = pres.addSlide();
  const hue = teamHue(team);
  const onHue = bandText(hue);
  const onHueQuiet = mix(onHue, hue, 0.4);   // the eyebrow, one step back
  const onHueRule = mix(onHue, hue, 0.55);   // the rule, quieter still

  // The team hue as a GROUND — the Board's hero band, once per team.
  slide.background = { color: hue };

  slide.addText("TEAM", {
    x: MARGIN_X,
    y: 0.8,
    w: CONTENT_W,
    h: 0.3,
    fontSize: 11,
    color: onHueQuiet,
    fontFace: FONT,
    bold: true,
    charSpacing: 5,
  });

  const teamDisplayName = team.display_name || team.name;
  slide.addText(teamDisplayName, {
    x: MARGIN_X,
    y: 1.15,
    w: CONTENT_W,
    h: 1.3,
    fontSize: 54,
    color: onHue,
    fontFace: FONT_DISPLAY,
    valign: "middle",
  });

  // The creative platform, in the serif italic reserved for a named line.
  if (team.creative_platform_name) {
    slide.addText(team.creative_platform_name, {
      x: MARGIN_X,
      y: 2.5,
      w: CONTENT_W,
      fontSize: 22,
      color: onHue,
      fontFace: FONT_DISPLAY,
      italic: true,
    });
  }

  const statsY = team.creative_platform_name ? 3.15 : 2.8;
  slide.addShape("line", {
    x: MARGIN_X,
    y: statsY,
    w: CONTENT_W,
    h: 0,
    line: { color: onHueRule, width: 1.5 },
  });

  slide.addText([
    { text: `${ideaCount}`, options: { bold: true, color: onHue, fontSize: 28, fontFace: FONT } },
    { text: `  ${ideaCount === 1 ? "idea" : "ideas"}   ·   `, options: { fontSize: 15, color: onHue, fontFace: FONT } },
    { text: `${wave1Count}`, options: { bold: true, color: onHue, fontSize: 28, fontFace: FONT } },
    { text: "  Wave 1   ·   ", options: { fontSize: 15, color: onHue, fontFace: FONT } },
    { text: `${wave2Count}`, options: { bold: true, color: onHue, fontSize: 28, fontFace: FONT } },
    { text: "  Wave 2", options: { fontSize: 15, color: onHue, fontFace: FONT } },
  ], {
    x: MARGIN_X,
    y: statsY + 0.2,
    w: CONTENT_W,
    h: 0.6,
    valign: "middle",
  });

  if (visionText) {
    const visionY = statsY + 1.35;
    slide.addText("DRAFT PLATFORM VISION — TO BE REFINED", {
      x: MARGIN_X,
      y: visionY,
      w: CONTENT_W,
      h: 0.26,
      fontSize: 9,
      color: onHueQuiet,
      fontFace: FONT,
      bold: true,
      charSpacing: 2,
    });
    slide.addText(visionText.replace(/\*\*/g, ""), {
      x: MARGIN_X,
      y: visionY + 0.38,
      w: CONTENT_W * 0.8,
      h: 1.5,
      fontSize: 17,
      color: onHue,
      fontFace: FONT_DISPLAY,
      italic: true,
      valign: "top",
      lineSpacingMultiple: 1.4,
    });
  }
}

function addPillarWaveOverviewSlide(
  pres: Pres,
  pillar: PillarSlug,
  wave: Wave,
  ideas: Idea[],
  teams: Team[],
  numbers: Map<string, number>,
  pageInfo?: { current: number; total: number }
) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.paper };

  addSlug(slide, PILLAR_TITLES[pillar]);

  const waveTitle = pageInfo
    ? `${WAVE_TITLES[wave]}  ·  ${pageInfo.current} of ${pageInfo.total}`
    : WAVE_TITLES[wave];
  slide.addText(waveTitle, {
    x: MARGIN_X,
    y: 0.8,
    w: CONTENT_W,
    h: 0.6,
    fontSize: 28,
    color: COLORS.ink,
    fontFace: FONT_DISPLAY,
    valign: "middle",
  });

  slide.addText(`${ideas.length} ${ideas.length === 1 ? "idea" : "ideas"} on this slide`, {
    x: MARGIN_X,
    y: 1.42,
    w: CONTENT_W,
    fontSize: 10,
    color: COLORS.muted,
    fontFace: FONT,
  });

  // Columns: № | IDEA | DESCRIPTION | PARTNERS | OWNER
  const colWidths = [1.15, 2.35, 4.3, 2.5, 1.83]; // total 12.13 = CONTENT_W

  // The header row is the ink slab — the same primary the workbench uses.
  const headerOpts = {
    bold: true,
    color: COLORS.paper,
    fill: { color: COLORS.ink },
    fontSize: 10,
    fontFace: FONT,
    align: "left",
    valign: "middle",
    charSpacing: 1.5,
  };
  const headerCells = ["№", "IDEA", "DESCRIPTION", "PARTNERS", "OWNER"].map((text) => ({
    text,
    options: headerOpts,
  }));

  const dataRows = ideas.map((idea) => [
    {
      text: ideaLabel(idea, teams, numbers) || "",
      options: { fontSize: 9, color: COLORS.muted, fontFace: FONT, bold: true, valign: "top", fill: { color: COLORS.paper }, margin: 0.08 },
    },
    {
      text: idea.name,
      options: { bold: true, fontSize: 11, color: COLORS.ink, fontFace: FONT, valign: "top", fill: { color: COLORS.paper }, margin: 0.08 },
    },
    {
      text: truncate(idea.description || "", MAX_TABLE_CELL_CHARS),
      options: { fontSize: 9, color: COLORS.ink, fontFace: FONT, valign: "top", fill: { color: COLORS.paper }, margin: 0.08 },
    },
    {
      text: truncate(idea.key_partners || "", MAX_TABLE_CELL_CHARS),
      options: { fontSize: 9, color: COLORS.ink, fontFace: FONT, valign: "top", fill: { color: COLORS.paper }, margin: 0.08 },
    },
    // OWNER — blank on purpose, the one cell the client fills in.
    {
      text: "",
      options: { fontSize: 11, color: COLORS.ink, fontFace: FONT, valign: "top", fill: { color: COLORS.paperDim }, margin: 0.08 },
    },
  ]);

  slide.addTable([headerCells, ...dataRows], {
    x: MARGIN_X,
    y: 1.85,
    w: CONTENT_W,
    colW: colWidths,
    rowH: 0.45,
    fontFace: FONT,
    border: { type: "solid", pt: 0.5, color: COLORS.hairline },
  });

  const footerLabel = pageInfo
    ? `${PILLAR_TITLES[pillar]} · ${WAVE_TITLES[wave]} · ${pageInfo.current}/${pageInfo.total}`
    : `${PILLAR_TITLES[pillar]} · ${WAVE_TITLES[wave]}`;
  addFooter(slide, footerLabel);
}

// Chunk an array into groups of `size`
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function addIdeaCardSlide(pres: Pres, idea: Idea, teams: Team[], numbers: Map<string, number>, platformName?: string) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.paper };

  const waveLabel = idea.wave ? WAVE_TITLES[idea.wave].toUpperCase() : null;
  const stamp = idea.status === "starting_lineup" ? "SHORTLISTED" : idea.status === "coached" ? "COACHED" : null;

  // The slug line: real data, nothing fake (signature element 4).
  const metaParts = [
    PILLAR_TITLES[idea.category],
    ideaLabel(idea, teams, numbers),
    waveLabel,
    stamp,
  ].filter(Boolean);
  addSlug(slide, metaParts.join("  ·  "));

  addRedRule(slide, 0.88, 2.2);

  slide.addText(idea.name, {
    x: MARGIN_X,
    y: 1.05,
    w: CONTENT_W,
    h: 1.3,
    fontSize: 40,
    color: COLORS.ink,
    fontFace: FONT_DISPLAY,
    valign: "top",
  });

  let cursorY = 2.6;
  if (idea.description) {
    slide.addText(idea.description, {
      x: MARGIN_X,
      y: cursorY,
      w: CONTENT_W * 0.82,
      h: 1.4,
      fontSize: 14,
      color: COLORS.ink,
      fontFace: FONT,
      valign: "top",
      lineSpacingMultiple: 1.35,
    });
    cursorY += 1.5;
  }

  const addField = (label: string, body: string) => {
    slide.addText(label, {
      x: MARGIN_X,
      y: cursorY,
      w: CONTENT_W,
      fontSize: 9,
      color: COLORS.muted,
      fontFace: FONT,
      bold: true,
      charSpacing: 2,
    });
    slide.addText(body, {
      x: MARGIN_X,
      y: cursorY + 0.3,
      w: CONTENT_W * 0.82,
      h: 0.8,
      fontSize: 12,
      color: COLORS.ink,
      fontFace: FONT,
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
    cursorY += 1.2;
  };

  if (idea.bbei_connection) {
    addField(
      platformName ? `CONNECTION TO ${platformName.toUpperCase()}` : "STRATEGIC CONNECTION",
      idea.bbei_connection
    );
  }
  if (idea.key_partners) addField("PARTNERS", idea.key_partners);

  addFooter(slide, idea.name);
}

function addClosingSlide(pres: Pres) {
  const slide = pres.addSlide();
  slide.background = { color: COLORS.paper };

  addSlug(slide, "NEXT STEPS");

  slide.addText("Where we go from here", {
    x: MARGIN_X,
    y: 0.85,
    w: CONTENT_W,
    h: 0.9,
    fontSize: 36,
    color: COLORS.ink,
    fontFace: FONT_DISPLAY,
    valign: "middle",
  });
  addRedRule(slide, 1.78, 2.4);

  slide.addText(
    "Use the overview tables in this deck to assign owners and track each shortlisted idea through to activation.\n\n" +
      "Each idea card can be printed and shared with the relevant team for further development.\n\n" +
      "Add columns to the overview tables as needed: organization, target date, budget, approvals.",
    {
      x: MARGIN_X,
      y: 2.2,
      w: CONTENT_W * 0.7,
      h: 3.0,
      fontSize: 16,
      color: COLORS.ink,
      fontFace: FONT,
      lineSpacingMultiple: 1.5,
      valign: "top",
    }
  );

  addFooter(slide, "Next Steps");
}

// ── Main export function ──

export interface ExportOptions {
  /** Team IDs to include. If omitted or empty, all teams are included. */
  selectedTeamIds?: string[];
  /** Team vision texts keyed by team slug (e.g. `team_vision_group-1`). */
  teamVisions?: Record<string, string>;
}

export async function exportStartingLineup(
  ideas: Idea[],
  teams: Team[],
  _visions?: { category: string; vision_text: string | null }[],
  options?: ExportOptions
): Promise<void> {
  const Pptx = await getPptxGenJS();
  const pres = new Pptx();

  pres.layout = "LAYOUT_WIDE"; // 13.33 × 7.5
  pres.author = `${BRAND.subtitle} ${BRAND.name}`;
  pres.title = `${BRAND.workshopTitle} · ${BRAND.year}`;
  pres.subject = "Co-Creation Workshop Deliverable";

  // The № is derived from the WHOLE set, set-aside included — a number
  // taken from a filtered slice is a position again (lib/idea-number).
  const numbers = ideaNumbers(ideas);

  // Filter: all non-set-aside ideas
  let exportIdeas = ideas.filter((i) => i.status !== "bench");

  // Filter to selected teams if provided
  const selectedTeamIds = options?.selectedTeamIds;
  if (selectedTeamIds && selectedTeamIds.length > 0) {
    exportIdeas = exportIdeas.filter((i) => i.team_id && selectedTeamIds.includes(i.team_id));
  }

  // A fresh room may genuinely have nothing to export — the deck still
  // builds (cover + snapshot + closing) so the facilitator can hand out
  // an empty structure, but every idea slide skips itself below.

  // Determine which teams to include
  const teamsToExport = selectedTeamIds && selectedTeamIds.length > 0
    ? teams.filter((t) => selectedTeamIds.includes(t.id))
    : teams;

  const dateLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // 1. Cover slide
  addCoverSlide(pres, exportIdeas.length, dateLabel);

  // 2. Workshop snapshot
  addSnapshotSlide(pres, exportIdeas, teamsToExport);

  // 3+. Per-team sections: each team is self-contained
  //     team divider → category sub-sections (overview tables + idea cards)
  const pillars = Object.values(PILLARS).map((p) => p.slug);
  const waves: Wave[] = WAVE_LIST.map((w) => w.slug);

  // Helper: get ideas grouped by wave (with unassigned defaulted to wave_1)
  const getWaveIdeas = (ideasGroup: Idea[], wave: Wave): Idea[] => {
    const filtered = ideasGroup.filter((i) => {
      if (wave === "wave_1") return i.wave === "wave_1" || i.wave === null;
      return i.wave === "wave_2";
    });
    // Sort within wave by created_at for predictable order
    return [...filtered].sort((a, b) => a.created_at.localeCompare(b.created_at));
  };

  for (const team of teamsToExport) {
    const teamIdeas = exportIdeas.filter((i) => i.team_id === team.id);
    if (teamIdeas.length === 0) continue;

    // Team divider slide
    const teamW1 = teamIdeas.filter((i) => i.wave === "wave_1" || i.wave === null).length;
    const teamW2 = teamIdeas.filter((i) => i.wave === "wave_2").length;
    const visionKey = `team_vision_${team.slug}`;
    const teamVision = options?.teamVisions?.[visionKey] || null;
    addTeamDividerSlide(pres, team, teamIdeas.length, teamW1, teamW2, teamVision);

    // Per-category sub-sections within this team
    for (const pillar of pillars) {
      const pillarIdeas = teamIdeas.filter((i) => i.category === pillar);
      if (pillarIdeas.length === 0) continue;

      // Overview tables — wave 1 first, then wave 2 (paginated if > MAX_IDEAS_PER_OVERVIEW_SLIDE)
      for (const wave of waves) {
        const waveIdeas = getWaveIdeas(pillarIdeas, wave);
        if (waveIdeas.length === 0) continue;

        const pages = chunk(waveIdeas, MAX_IDEAS_PER_OVERVIEW_SLIDE);
        pages.forEach((pageIdeas, pageIdx) => {
          const pageInfo = pages.length > 1 ? { current: pageIdx + 1, total: pages.length } : undefined;
          addPillarWaveOverviewSlide(pres, pillar, wave, pageIdeas, teams, numbers, pageInfo);
        });
      }

      // Idea cards for this category — wave 1 cards first, then wave 2 cards
      const platformName = team.creative_platform_name || undefined;
      for (const wave of waves) {
        const waveIdeas = getWaveIdeas(pillarIdeas, wave);
        for (const idea of waveIdeas) {
          addIdeaCardSlide(pres, idea, teams, numbers, platformName);
        }
      }
    }
  }

  // Last. Next Steps
  addClosingSlide(pres);

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `dove-real-intelligence-${BRAND.workshopTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dateStr}.pptx`;
  await pres.writeFile({ fileName: filename });
}
