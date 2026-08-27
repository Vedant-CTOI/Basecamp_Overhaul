// ============================================================
// SHOWCASE DATA — Dove Real Intelligence
// ============================================================
// When no Supabase env is configured, the app runs in SHOWCASE MODE:
// lib/supabase.ts serves these rows through an in-memory engine with
// working mutations and same-machine realtime. The content is a real
// engagement: Dove's Real Intelligence session — one day, three teams,
// championing authentic self-expression in a synthetic world.
// Briefs: Transparency / Self-Esteem / Care Innovation.
// Voice contract: docs/dove-brand-system.md.
// ============================================================

import { GROUP_LIST, type GroupSlug } from './config';

type Row = Record<string, unknown>;

// The session is running NOW, whenever now is. Anchoring these rows to a fixed
// calendar date meant the wire — the wall that reports the room as it
// works — stamped every seeded event "163H AGO" the moment that date had
// passed, and the Pace column read STEADY for a room that, as far as the data
// was concerned, had stopped a week earlier.
//
// The timeline is therefore laid out backwards from the present: the last
// seeded event lands a couple of minutes ago and the rest step back from it at
// the original five-minute spacing. The wire reads like a session three hours
// in, and Pace sees real recent movement instead of a flat week-old floor.
const STEP_MS = 5 * 60000;
const LAST_STEP = 40;   // highest index passed to T() below — keep in step
const SESSION_START = Date.now() - LAST_STEP * STEP_MS - 2 * 60000;

const T = (i: number) => new Date(SESSION_START + i * STEP_MS).toISOString();

// ── Teams ─────────────────────────────────────────────────────
// IDENTITY (name, slug, colour, pillars) is DERIVED from `GROUPS` in
// lib/config.ts — config is the single source of team identity (D-7),
// so a showcase row can no longer change colour between the seeded
// surfaces and the live ones. Only the showcase CONTENT stays here:
// the stable row ids the seeded ideas reference, and each team's
// creative platform (Real Intelligence's own bespoke layer). The
// Record<GroupSlug, …> type makes a team added to config without
// showcase content a compile error, not a blank surface.
const SHOWCASE_TEAM_CONTENT: Record<
  GroupSlug,
  { id: string; creative_platform_name: string; creative_platform_brief: string }
> = {
  'group-1': {
    id: 'team-one',
    creative_platform_name: 'Proof Over Polish',
    creative_platform_brief: 'Every image we ship carries its own receipt: unretouched, unfiltered, labelled if synthetic. This team builds the proof systems — if an idea cannot survive being looked at closely, it does not leave this room.',
  },
  'group-2': {
    id: 'team-two',
    creative_platform_name: 'The Confidence Curriculum',
    creative_platform_brief: 'Self-esteem is a skill, not a mood. This team turns filter literacy and digital ethics into tools teens, parents, and creators actually use — education that feels like culture, never like a lecture.',
  },
  'group-3': {
    id: 'team-three',
    creative_platform_name: 'Skin in the Game',
    creative_platform_brief: 'Real skin comes in every texture, tone, and condition, and care science should prove it. This team pushes formulation and product innovation that serves the full spectrum — no cosmetic tropes required.',
  },
};

export const SHOWCASE_TEAMS: Row[] = GROUP_LIST.map((g) => ({
  id: SHOWCASE_TEAM_CONTENT[g.slug].id,
  name: g.name,
  slug: g.slug,
  display_name: g.name,
  color: g.color,
  assigned_pillars: [...g.defaultPillars],
  facilitator_notes: null,
  creative_platform_name: SHOWCASE_TEAM_CONTENT[g.slug].creative_platform_name,
  creative_platform_brief: SHOWCASE_TEAM_CONTENT[g.slug].creative_platform_brief,
  created_at: T(0),
}));

// ── Ideas ─────────────────────────────────────────────────────
let ideaN = 0;
const idea = (
  team: string, category: string, name: string, description: string,
  extra: Partial<{ status: string; source: string; wave: string | null; bbei_connection: string | null; key_partners: string | null; link_group: string | null; presenting: boolean; print_status: string | null; print_options: string[] | null; print_url: string | null; print_source: string | null; print_note: string | null }> = {},
): Row => ({
  id: `idea-${String(++ideaN).padStart(2, '0')}`,
  team_id: team, category, name, description,
  status: extra.status ?? 'draft',
  source: extra.source ?? 'team',
  wave: extra.wave ?? null,
  bbei_connection: extra.bbei_connection ?? null,
  key_partners: extra.key_partners ?? null,
  link_group: extra.link_group ?? null,
  gifted_from_team_id: null,
  // SCHEMA ADDITION (dev team): `presenting`, `print_status`,
  // `print_options`, `print_url`, `print_source`, `print_note` are new
  // ideas-table columns — see lib/types.ts for the migration note.
  // `print_options` is the CONTACT SHEET (three frames per commission;
  // print_url is the chosen one, null while the sheet awaits its
  // choice). Seeded prints default to a FRESH print_source (the
  // "name\ndescription" snapshot format from lib/darkroom
  // printSourceOf, inlined here to avoid a circular import); pass an
  // explicit print_source to seed a print from an earlier draft.
  // `print_note` is the optional note the commission carried.
  presenting: extra.presenting ?? false,
  print_status: extra.print_status ?? null,
  print_options: extra.print_options ?? null,
  print_url: extra.print_url ?? null,
  print_source: extra.print_source ?? (extra.print_url || extra.print_options ? `${name}\n${description}` : null),
  print_note: extra.print_note ?? null,
  created_at: T(ideaN), updated_at: T(ideaN + 1),
});

// Presenting seeds: each team arrives with 2–3 ideas already brought to
// the Stage so the ON THE STAGE stamps and the Stage's present-gate read
// on first load. Realness deliberately has NONE selected under Inclusive
// Biomimetic Care (category_3) so the Stage's "showing all — none selected
// yet" fallback demonstrates itself on the same screen. Darkroom seed mix:
// one idea carries a pre-sheet chosen print (stale, no sheet — the
// "Picture it again" path), one a chosen print WITH its kept sheet
// (re-choose path), and one a developed sheet still awaiting its
// choice (the choosing moment) — every print state demos untouched.
// ── A FRESH WORKSHOP SHIPS EMPTY ─────────────────────────────
// The room opens with zero ideas, zero votes, zero coaching notes:
// everything in it is made by the people in it, live. Teams, briefs,
// ticker welcome lines, and settings still seed (they are the room's
// structure), and the darkroom stand-in print pool stays available so
// "Picture it" works without an AI key. To rehearse with a populated
// room, run `npm run seed` against a Supabase project instead.
export const SHOWCASE_IDEAS: Row[] = [
  // Populated live during the session.
];

// ── Votes ─────────────────────────────────────────────────────

const V = (ideaId: string, category: string, n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `vote-${ideaId}-${i}`, idea_id: ideaId, category,
    voter_id: `voter-${String(i + 1).padStart(2, '0')}`, created_at: T(30 + i),
  }));

export const SHOWCASE_VOTES: Row[] = [
  // Cast live during the session.
];

// ── Training notes (saved coaching exchanges) ─────────────────
export const SHOWCASE_TRAINING_NOTES: Row[] = [
  // Saved coaching exchanges land here during the session.
];

// ── Ticker (the wire) ─────────────────────────────────────────
export const SHOWCASE_TICKER: Row[] = [
  { id: 'tick-01', message: 'Dove Real Intelligence — three teams, three briefs, one day to make real beauty undeniable in a synthetic world', style: 'standard', reporter: null, is_active: true, created_at: T(1) },
  { id: 'tick-02', message: '\u201cReal beauty is not generated.\u201d — the working credo of today\u2019s session', style: 'standard', reporter: null, is_active: true, created_at: T(2) },
  { id: 'tick-03', message: 'Voting opens this afternoon — three votes per brief, cast from your phone', style: 'standard', reporter: null, is_active: true, created_at: T(3) },
  { id: 'tick-04', message: 'The Dove Self-Esteem Project has reached a generation of young people — today that work walks into digital ethics', style: 'standard', reporter: null, is_active: true, created_at: T(4) },
  { id: 'tick-05', message: 'The Real Report lands tomorrow at nine — patterns first, commitments second', style: 'standard', reporter: null, is_active: true, created_at: T(5) },
];

// ── Settings ──────────────────────────────────────────────────
export const SHOWCASE_SETTINGS: Row[] = [
  { key: 'room_code', value: '', updated_at: T(0) },
  { key: 'workshop_state', value: JSON.stringify({ pillar: 'category_1', team: null, view: null, voting_open: false, show_counts: false }), updated_at: T(0) },
  { key: 'voting_enabled', value: 'true', updated_at: T(0) },
  { key: 'total_participants', value: '12', updated_at: T(0) },
  { key: 'max_votes_per_pillar', value: '3', updated_at: T(0) },
  { key: 'enabled_idea_fields', value: '[\"bbei_connection\",\"key_partners\"]', updated_at: T(0) },
  { key: 'insights', value: 'Pre-read synthesis: the threat isn\u2019t AI making beauty dishonest — it\u2019s AI making dishonesty effortless. Every brief today answers with proof, education, or science. Never with a disclaimer.', updated_at: T(0) },
  { key: 'partnership_guardrails', value: 'House guardrails: nothing contradicts Dove\u2019s no-digital-distortion commitments — no generated faces, no retouched bodies in concepts we would ship. Real people are described with respect; no condition mocked for effect. Competitor brands are challenged, never named destructively.', updated_at: T(0) },
  { key: 'strategic_playbook', value: 'Dove Real Intelligence. Premise: in a synthetic world, authenticity stops being a value statement and becomes a system — labelling, literacy, and science. Three briefs — The Transparency Standard (prove what is real), Digital Self-Esteem Toolkits (teach seeing), Inclusive Biomimetic Care (serve every skin). Output: a shortlisted, sequenced program in the Real Report by morning.', updated_at: T(0) },
  { key: 'fan_context', value: 'The room: Dove marketers, agency creatives, and youth-culture experts. They can smell purpose-washing instantly, know the Real Beauty archive better than its timeline, and want work that protects young people AND sells. Write to people who chose this brief because it matters.', updated_at: T(0) },
];

// ── Category briefs ───────────────────────────────────────────
export const SHOWCASE_BRIEFS: Row[] = [
  { category: 'category_1', brief_context: 'The Transparency Standard: industry-wide labelling of AI-altered and synthetic imagery while Dove holds its own 100% natural, un-retouched line. The brief wants standards, marks, dashboards, and commitments with enforcement. Not manifestos.', fan_context: null, updated_at: T(0) },
  { category: 'category_2', brief_context: 'Digital Self-Esteem Toolkits: interactive modules and in-app tools that build critical literacy around algorithmic beauty filters — for teenagers, parents, and creators. Every idea should name where in the daily routine it lives.', fan_context: null, updated_at: T(0) },
  { category: 'category_3', brief_context: 'Inclusive Biomimetic Care Innovation: gentle, microbiome-friendly formulation for every skin texture, melanin level, and dermatological need — without restrictive cosmetic tropes. If it doesn\u2019t widen who care is for, it isn\u2019t innovation.', fan_context: null, updated_at: T(0) },
];

// ── Pillar visions ────────────────────────────────────────────
export const SHOWCASE_VISIONS: Row[] = [
  { category: 'category_1', vision_text: 'Draft, for refinement: across the Transparency board, one through-line — trust must be verifiable, not asserted. The room\u2019s bets pair every claim with a mechanism someone else can check: the scannable label, the public dashboard, the open standard, the certification mark. The program isn\u2019t \u201chonesty plus marketing\u201d; it is infrastructure anyone can audit.', ai_draft: null, updated_at: T(40) },
  { category: 'category_2', vision_text: null, ai_draft: null, updated_at: T(0) },
  { category: 'category_3', vision_text: null, ai_draft: null, updated_at: T(0) },
];

// ── Darkroom prints (pre-rendered stand-ins) ───────────────────
// The pool contains eight abstract duotone prints (navy / ink / paper,
// cinematic 16:9 at 1600×900). In the showcase, "Picture it" commissions
// a CONTACT SHEET of three from PRINT_POOL (lib/darkroom sheetForIdea);
// a mapped idea's print leads its sheet when free. REAL IMPLEMENTATION:
// this map disappears — the route renders three frames from the
// engagement's image model, in parallel. See lib/darkroom.ts.
// No print is hung before the room opens: every picture in a fresh
// session is commissioned live. PRINT_POOL below still backs the
// "Picture it" flow when no AI key is attached.
export const SHOWCASE_PRINTS: Record<string, string> = {};

export const PRINT_POOL: string[] = Array.from(
  { length: 8 },
  (_, i) => `/prints/print-${String(i + 1).padStart(2, '0')}.png`,
);
export const SHOWCASE_COACH_REPLIES: Record<string, string> = {
  provocateur:
    'Take the version you\u2019re holding and ask what it looks like with ten times the nerve. Right now this idea behaves politely — it asks permission of the category. Rewrite the first line so the claim makes every other brand\u2019s feed look complicit, then keep every tooth when the edits come.\n\n(Scripted round — with a live engagement key this is a real conversation, grounded in today\u2019s briefs and everything the room has made.)',
  sharpener:
    'Hold it against the brief. The strongest overlap is the part you wrote last — move it to the front, cut the throat-clearing, and let the framework fields carry the strategy so the description can carry the idea. Then name one number this changes; today\u2019s briefs don\u2019t accept vibes.\n\n(Scripted round — with a live engagement key this is a real conversation, grounded in today\u2019s briefs.)',
  fan_lens:
    'The young person this is for has already scrolled past four versions of it today. This lands the moment it costs them nothing to care — find the ten-second version a sceptical teenager would send to a friend and still get right. That forward is the idea; the rest is production.\n\n(Scripted round — with a live engagement key this voice runs on the audience context loaded for the session.)',
  rights_advisor:
    'Right now this sits next to the de-influencing and \u201creveal the edit\u201d energy running through the feed — audiences are actively rewarding brands that show the seams. That\u2019s live, not late. Where it wobbles: anything that lectures tips into cringe overnight. Reframe the teaching as demonstration and you\u2019re riding the wave instead of chasing it. This should feel fresh the day it ships.\n\n(Scripted round — with a live engagement key this voice reads the culture loaded for the session.)',
};

// ── Scout pitches (no AI key attached) ─────────────────────────
export const SHOWCASE_SCOUT_PITCHES: Array<{ name: string; description: string; platformConnection: string }> = [
  {
    name: 'The Distortion Detector',
    description: 'A shareable scan: run any campaign image through it and get a plain-language verdict — real, edited, or generated — with the evidence highlighted. Audiences police the aisle; Dove arms them.',
    platformConnection: 'Scouted from the room\u2019s own material — it stitches Label It or Lose It to the Provenance Standard. Keeps only if a human says so.',
  },
  {
    name: 'The Morning Mirror',
    description: 'A daily ninety-second ritual for classrooms and group chats: one image, one question — what did the algorithm change? By Friday everyone has argued about twenty pictures. Literacy by repetition, not by memo.',
    platformConnection: 'Drafted from Detox Week and the Filter Decoder — the Scout pitches into the gap between them.',
  },
];
