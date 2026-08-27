// ============================================================
// Basecamp Workshop — Centralized Config
// ============================================================
// Single source of truth for all team, category, coach, and status
// definitions. Every page imports from here — no local constants.
//
// This branch is the OGILVY SHOWCASE EDITION: platform showcase /
// instructional mode, dressed in Ogilvy's own identity (red #EB3F43,
// Ogilvy Serif/Sans, editorial vernacular). Values below demonstrate
// the structure while teaching what each slot is for. Design contract:
// docs/ogilvy-showcase-direction.md
// ============================================================

// ── The Accent ────────────────────────────────────────────────
// The platform's voice, defined EXACTLY ONCE. Every blue in the system
// routes here: BRAND.colors reads these, app/layout.tsx injects them
// as `--brand-*` custom properties, and globals.css maps its @theme
// tokens onto those. Re-voicing the platform is this edit and nothing
// else — no other file may bake the hex (labs excepted; they record
// rulings). Values verified against dove.com's own CSS — see
// docs/dove-brand-system.md.
// Engagement rule: categories stay NEUTRAL ink chips — teams carry hue.

const ACCENT = '#002663';        // Dove Blue — the voice [L]
const ACCENT_BRIGHT = '#366AA5'; // hover on dark (mid blue) [L]
const ACCENT_DIM = '#1E4570';    // borders/subtle on dark [D]

/** A config hex at an alpha, as CSS rgba() — derived tints re-voice
    with the token they derive from instead of baking their own red. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ── Categories (formerly "Pillars") ───────────────────────────
// Default placeholder set. The schema relaxes the votes.category check
// constraint so engagements can supply their own category list.
// Showcase rule: categories stay NEUTRAL ink chips — teams carry hue.

export const PILLAR_SLUGS = ['category_1', 'category_2', 'category_3'] as const;
export type PillarSlug = (typeof PILLAR_SLUGS)[number];

export const PILLARS = {
  category_1: { slug: 'category_1' as const, label: 'The Transparency Standard', abbr: 'Transparency', color: '#8A8689' },
  category_2: { slug: 'category_2' as const, label: 'Digital Self-Esteem Toolkits', abbr: 'Self-Esteem', color: '#8A8689' },
  category_3: { slug: 'category_3' as const, label: 'Inclusive Biomimetic Care', abbr: 'Care Innovation', color: '#8A8689' },
} as const satisfies Record<PillarSlug, { slug: PillarSlug; label: string; abbr: string; color: string }>;

export const PILLAR_LIST = Object.values(PILLARS);

export function isPillarSlug(value: unknown): value is PillarSlug {
  return typeof value === 'string' && (PILLAR_SLUGS as readonly string[]).includes(value);
}

// ── Idea Statuses ─────────────────────────────────────────────
// DB slugs are stable ('starting_lineup'/'bench'); user-facing labels
// come from STATUS_LABELS / PAGE_NAMES ("The Shortlist" / "Set Aside").

export const IDEA_STATUSES = ['draft', 'coached', 'starting_lineup', 'bench'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === 'string' && (IDEA_STATUSES as readonly string[]).includes(value);
}

export const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: 'Draft',
  coached: 'Coached',
  starting_lineup: 'Shortlisted',
  bench: 'Set Aside',
};

// Valid status transitions
export const STATUS_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  draft:           ['coached', 'bench'],
  coached:         ['starting_lineup', 'bench'],
  starting_lineup: ['bench'],
  bench:           ['coached', 'draft'],
};

// ── Idea Sources ──────────────────────────────────────────────

export const IDEA_SOURCES = ['team', 'quick_toss', 'tissue', 'ai_scouted'] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export function isIdeaSource(value: unknown): value is IdeaSource {
  return typeof value === 'string' && (IDEA_SOURCES as readonly string[]).includes(value);
}

// ── Waves ─────────────────────────────────────────────────────
// Optional temporal/strategic segmentation, given the PILLARS treatment
// (D-10): slugs are stable DB values, labels live HERE — the report and
// the PPTX consume these instead of inventing their own label sets.
// `label` is the editorial long form; `abbr` is the compact form the
// deck and chips wear. The DB check constraint (schema.sql) still pins
// the two-wave shape — widening it is a migration decision, not a
// label edit.

export const WAVE_SLUGS = ['wave_1', 'wave_2'] as const;
export type Wave = (typeof WAVE_SLUGS)[number];

export const WAVES = {
  wave_1: { slug: 'wave_1' as const, label: 'Wave One', abbr: 'Wave 1' },
  wave_2: { slug: 'wave_2' as const, label: 'Wave Two', abbr: 'Wave 2' },
} as const satisfies Record<Wave, { slug: Wave; label: string; abbr: string }>;

export const WAVE_LIST = Object.values(WAVES);

// ── Groups (Teams) ────────────────────────────────────────────
// THE HERITAGE PALETTE (shipped 2026-08-03, user ruling — candidate A of
// the palette study, `scripts/palette-study.mjs`). Ogilvy's own heritage
// colours moved clear of the brand red: cobalt, oxblood, warm stone.
// Red is never a team color — red is the platform's voice, and this set
// is the first one that actually obeys that. Measured (CIE ΔE76 against
// the platform red #EB3F43 and the category-chip neutral #8A8689):
//   cobalt  #2438D6  ΔEred 122 · ΔEchip 96 · white type (YIQ 65)
//   oxblood #8E2740  ΔEred  40 · ΔEchip 50 · white type (YIQ 62)
//   stone   #C9A46B  ΔEred  61 · ΔEchip 38 · INK type   (YIQ 169)
// The stone is TUNED off the study's #B08A4F, which carried only 5.12:1
// under ink: white on either hex fails AA outright (3.18:1), so the fix
// was to lighten the ground rather than switch the type. #C9A46B measures
// 6.99:1 under #231F20 — comfortably above the 6.5:1 projector target —
// while holding hue 36° at 47% saturation, so it stays unmistakably a
// warm stone rather than drifting to cream (the kill-list's "cream +
// terracotta drift"). Any future team hue must clear ΔE 30 from BOTH the
// platform red and the chip neutral, and pass one of the two type rules
// at 4.5:1 or better.

export const GROUP_SLUGS = ['group-1', 'group-2', 'group-3'] as const;
export type GroupSlug = (typeof GROUP_SLUGS)[number];

// `shortLabel` is the compact display label (ticker chips, Newsroom
// team tags, Stage queue); default is the team name uppercased. It was
// the Sprite-era `dunkName` until 2026-08-05 (D-11 batch).
export const GROUPS = {
  'group-1': { slug: 'group-1' as const, name: 'Realness', shortLabel: 'REALNESS', color: '#2438D6', defaultPillars: ['category_1', 'category_2', 'category_3'] as PillarSlug[] },
  'group-2': { slug: 'group-2' as const, name: 'Confidence', shortLabel: 'CONFIDENCE', color: '#B78938', defaultPillars: ['category_1', 'category_2', 'category_3'] as PillarSlug[] },
  'group-3': { slug: 'group-3' as const, name: 'Skinfirst', shortLabel: 'SKINFIRST', color: '#7A5C3E', defaultPillars: ['category_1', 'category_2', 'category_3'] as PillarSlug[] },
} as const;

export const GROUP_LIST = Object.values(GROUPS);

/**
 * A team hue used as TYPE on the paper register.
 *
 * The luminance rule (`bandText` / `chipText` / `medallionText`) answers
 * the case where the hue is a GROUND: white or ink on top of it. This is
 * the converse, and it needs its own answer — a hue too light to carry
 * ink is also too light to BE ink. Cobalt clears AA on white at 8.0:1
 * and oxblood at 8.4:1 and both come back untouched; the heritage stone
 * reads 2.3:1, so it is mixed toward ink until it clears 4.5:1
 * (#C9A46B → #8A714F, 4.61:1) — still unmistakably that team's colour,
 * no longer a pale label on a working surface.
 *
 * Use it for team-hue TEXT on paper only. Rules, spines, swatches, dots
 * and grounds keep the raw hue — they are marks, and a mark is not read.
 */
export function paperType(hex: string): string {
  const toLin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const onWhite = (rgb: number[]) =>
    1.05 / (0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]) + 0.05);
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const ink = [0x23, 0x1f, 0x20];
  for (let step = 0; step <= 100; step++) {
    const t = step / 100;
    const mix = rgb.map((v, i) => Math.round(v + (ink[i] - v) * t));
    if (onWhite(mix) >= 4.5) return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }
  return '#231F20';
}

/**
 * A hue used as a MARK on the dark register — a spine, a rule, a dot.
 *
 * This is deliberately NOT the dark-ground twin of `paperType`. A mark
 * is not read, so it does not owe 4.5:1, and lifting every hue until it
 * did would fork the palette away from every other dark surface: the
 * Stage ships cobalt and oxblood spines at their raw values on purpose.
 * There is exactly one hue that cannot survive here, and it is the one
 * that is not a hue at all — pure ink has nothing to see against a
 * near-black ground (#231F20 on #1B1A1D measures 1.06:1), so it hands
 * over to the register's own secondary. Everything else comes back
 * untouched: the platform red reads 4.39:1, the Listener's rose 5.83:1,
 * the heritage blue 1.48:1 — faint, but a blue line you can see, which
 * is what a spine is for.
 *
 * Lifted out of CoachTakeover (where it was `onDark`) when the Operator
 * Console moved to this register and hit the same wall: the Sharpener's
 * spine had simply disappeared. One rule, one definition.
 */
export function darkMark(hex: string): string {
  return hex.toUpperCase() === '#231F20' ? '#A8A5A6' : hex;
}

/**
 * The alpha at which a team hue reads as a HELD-BACK TINT on a dark
 * ground — equally held back, whatever the hue.
 *
 * A single flat opacity does not do this, and that is not a rounding
 * error. On the Stage's card ground (#1B1A1D) a flat 0.55 measured
 * cobalt at 1.43:1, oxblood at 1.40:1 and the warm stone at 3.17:1 —
 * the stone read more than twice as loud as its peers, so one team's
 * cards looked marked and the other two looked plain. The eye reads
 * contrast, not opacity, so parity has to be solved per hue.
 *
 * Solved rather than tabulated, because three magic numbers would rot
 * the moment an engagement swaps a team colour: this walks alpha until
 * the composite hits `target` contrast against `ground`, so a new hue
 * gets the right restraint automatically.
 *
 * Ceiling of 1 — a hue too dark to reach the target even at full
 * strength (a near-black team on near-black ground) returns 1 rather
 * than pretending. That is the honest failure, and the palette law
 * above `GROUPS` is what prevents it arising.
 */
export function heldBackTint(hex: string, ground: string, target = 1.47): number {
  const toLin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
  const lum = (rgb: number[]) => 0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]);
  const rgbOf = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hue = rgbOf(hex);
  const bg = rgbOf(ground);
  const bgL = lum(bg);
  const ratio = (rgb: number[]) => {
    const l = lum(rgb);
    return (Math.max(l, bgL) + 0.05) / (Math.min(l, bgL) + 0.05);
  };
  for (let step = 1; step <= 100; step++) {
    const a = step / 100;
    const mix = hue.map((v, i) => Math.round(a * v + (1 - a) * bg[i]));
    if (ratio(mix) >= target) return a;
  }
  return 1;
}

// ── Coaches ───────────────────────────────────────────────────
// Structural pattern: 3 standard coaches + 1 culture voice. Showcase
// dress: the creative department masthead. Avatars are duotone character
// portraits (placeholder set carried over from Coke/Sprite and recolored
// to each coach's hue); swap in a bespoke set per engagement. Monogram
// SVGs remain as fallbacks. No emoji in the Ogilvy edition.

export const COACH_TYPES = ['provocateur', 'sharpener', 'fan_lens', 'rights_advisor'] as const;
export type CoachType = (typeof COACH_TYPES)[number];

export function isCoachType(value: unknown): value is CoachType {
  return typeof value === 'string' && (COACH_TYPES as readonly string[]).includes(value);
}

export interface CoachDef {
  type: CoachType;
  name: string;
  emoji: string;
  title: string;
  description: string;
  shortDescription: string;
  avatar: string;
  /** Full-bleed picker portrait. Lives HERE, not as a filename remap in
      the picker component (D-5): a recast engagement swaps portraits by
      editing this slot. Components fall back to the monogram SVG beside
      the avatar (`avatar` with .svg) when the file is missing. */
  portrait: string;
  color: string;
}

// Coach definitions (system prompts live in coaches.ts, not here).
export const COACH_DEFS: Record<CoachType, CoachDef> = {
  provocateur: {
    type: 'provocateur',
    name: 'The Provocateur',
    emoji: '',
    title: 'Makes it bigger',
    description: 'Pushes an idea to its most ambitious version. If it doesn\'t scare you a little, it isn\'t big enough yet.',
    shortDescription: 'Makes it bigger.',
    avatar: '/coaches/provocateur.png',
    portrait: '/coaches/full/provocateur.png',
    color: ACCENT,
  },
  sharpener: {
    type: 'sharpener',
    name: 'The Sharpener',
    emoji: '',
    title: 'Holds it to the brief',
    description: 'Finds where the idea hits the strategy hardest, and says so plainly. Every engagement loads its own brief here.',
    shortDescription: 'Holds it to the brief.',
    avatar: '/coaches/sharpener.png',
    portrait: '/coaches/full/sharpener.png',
    color: '#303334',
  },
  fan_lens: {
    type: 'fan_lens',
    name: 'The Listener',
    emoji: '',
    title: 'Speaks for the audience',
    description: 'Actually listened to real people — teens, parents, and creators navigating synthetic media — and brings their voice into the room. The texture that turns a rough idea into one that lands.',
    shortDescription: 'Speaks for the audience.',
    avatar: '/coaches/listener.png',
    portrait: '/coaches/full/listener.png',
    color: '#D97A85',
  },
  rights_advisor: {
    type: 'rights_advisor',
    name: 'The Tastemaker',
    emoji: '',
    title: 'Reads the culture',
    description: 'Dialed into what’s moving right now — what’s breaking, what’s already over, where the energy is. Tells you if the idea will feel fresh the day it ships or dated.',
    shortDescription: 'Reads the culture.',
    avatar: '/coaches/tastemaker.png',
    portrait: '/coaches/full/tastemaker.png',
    color: '#0090C1',
  },
};

export const COACH_LIST = Object.values(COACH_DEFS);

// ── Brand ─────────────────────────────────────────────────────
// Dove Real Intelligence Edition tokens. Verified against dove.com's
// own CSS — see docs/dove-brand-system.md (blue #002663, ink #303334,
// gold #B78938).
// BLUE DISCIPLINE: blue is the voice, not the wallpaper. It appears as
// the wordmark, the accent bars, the select marks, and the LIVE chip.
// It is never running text on dark, never a decorative flood.

export const BRAND = {
  name: 'Basecamp',
  workshopTitle: 'Dove Real Intelligence',
  subtitle: 'Dove',
  edition: 'Overhaul',
  year: '2026',

  colors: {
    primary: ACCENT,          // the voice — see The Accent block above
    primaryBright: ACCENT_BRIGHT,
    primaryDim: ACCENT_DIM,
    yellow: ACCENT,           // legacy vote-accent slot — the accent in this edition
    yellowBright: ACCENT_BRIGHT,
    surface0: '#F3EEE7',      // stage ground — warm cream (overhaul register)
    surface1: '#FBF8F3',      // card on stage — soft raised white
    surface2: '#EDE6DC',      // elevated surface — deeper cream
    surface3: '#E4DCCF',      // pressed/inset
    // Light register (the workbench) — same family now
    paper: '#FBF8F3',
    paperDim: '#F3EEE7',
    ink: '#2C2419',           // warm ink
    // Editorial accents
    pink: '#C4756B',          // clay
    blue: '#366AA5',          // mid blue [L]
    gold: '#B78938',          // Dove gold [L]
  },

  fonts: {
    display: "var(--font-ogilvy-serif), Georgia, 'Times New Roman', serif",
    body: "var(--font-ogilvy-sans), 'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: "var(--font-courier-prime), 'Courier New', monospace",
  },
} as const;

// ── Engagement (AI grounding) ─────────────────────────────────
// The two values every coach and scout prompt is grounded in,
// interpolated at prompt-build time (lib/coaches.ts, api/coach,
// api/scout). D-6: a bracket token must NEVER flow into a live model
// call — the routes refuse any assembled prompt still carrying one
// (the token registry lives in lib/engagement-context.ts) and the
// Operator Console pre-flight flags them before the room opens.

export const ENGAGEMENT = {
  /** Who the room is creating for. */
  clientBrand: BRAND.subtitle,
  /** The cultural domain the coaches read for heat and freshness. */
  domain: 'digital self-esteem, AI-generated media, and real beauty representation',
} as const;

// ── Entry Experience ──────────────────────────────────────────
// Primitive contract for the opening craft moment. The component supplies
// the room-code behavior, media container, orbit, and transition mechanics.
// Every engagement rebuilds the bespoke values below: client lockup,
// workshop title, typography, copy, metadata, media, palette, and orbit
// language. A client engagement should move Basecamp into the small platform
// endorsement and let the client/workshop identity take over the hero.

export const ENTRY_CONFIG = {
  platformLabel: BRAND.name,
  /** The platform credit is the PLATFORM'S — it names Basecamp's maker
      and never varies with the engagement. The client is not the
      platform's author ("Basecamp by Coca-Cola" is a false claim); the
      client's identity lives in the core lockup and the hero, never in
      this line. A constant, not an interpolation of the client
      subtitle. Set '' to run the wordmark alone. */
  platformAttribution: 'by Ogilvy',  // platform credit — kept per contract

  clientName: BRAND.subtitle,
  clientLogo: {
    src: '/logos/dove-logo-white.svg',
    alt: 'Dove',
  },

  kicker: 'Championing authentic self-expression in a synthetic world — welcome to',
  /** THE HERO — the biggest type on the entry, and it belongs to the
      ENGAGEMENT, not the platform (user ruling, Round 20 extension):
      point it at the workshop's own name and let Basecamp recede to
      the header credit. When this equals `workshopTitle` the core's
      sub-line and the header echo both yield, so the name is never
      read twice. The showcase ships the platform name only because
      the platform IS this engagement's subject. */
  heroTitle: BRAND.workshopTitle,
  /** THE HERO'S FACE — the entry display typeface is a slot, like the
      name (same ruling: "the font shouldn't be the same across all
      three either"). `family` is the CSS family name; `src` an optional
      drop-in woff2 under public/fonts/ (Layer 2 — the component injects
      the @font-face itself when set; omit `src` for a system-installed
      face). Scope is the HERO LINE ONLY — nothing else on the entry or
      in the app re-fonts. null = the platform's default display face. */
  displayFont: null as { family: string; src?: string } | null,
  workshopTitle: BRAND.workshopTitle,
  tagline: 'Real beauty is not generated.',

  date: BRAND.year,
  location: '',

  media: {
    // Supported bespoke modes: generative, image, or video.
    kind: 'generative' as 'generative' | 'image' | 'video',
    src: '',
    poster: '',
  },

  /** Full-bleed photographic backdrop beneath the orbital core — the
      engagement's "place" (the Coke edition opened on the LA skyline;
      this edition opens on the Touffou grounds). File convention:
      public/backdrop/entry.jpg, graded dark so the frame reads as
      environment, not content. When a photo is present the shader
      field is disabled (photo + shader compete) and the component
      scrims the frame so the orbit type, core, and coupon hold at
      projector distance over ANY photo. `scrim` is the engagement's
      dial on that treatment — every photo differs, so the intensity
      is config, not a baked constant: 'standard' (default), 'light'
      one step brighter, 'deep' the heavy original. The contrast LAW
      (type ≥4.5:1 in its worst regions) is fixed regardless of dial;
      the component's torture-test render (backdrop swapped for pure
      white) is the verification step for any new photo+dial pairing.
      Set null — or ship no file; a missing/broken src falls back at
      runtime — and the generative AmbientField renders exactly as
      before. This edition ships null: the field IS Ogilvy's place.
      public/backdrop/entry.jpg stays in the slot as the worked
      example a reskin flips on with this one value. */
  backdrop: null as
    | { src: string; scrim?: 'light' | 'standard' | 'deep' }
    | null,

  atmosphere: {
    // The live entry default. Review the alternates at /atmosphere-lab.
    mode: 'color-bends' as const,
  },

  orbit: {
    outer:
      'DOVE REAL INTELLIGENCE · REAL BEAUTY IS NOT GENERATED · WELCOME TO BASECAMP · 2026 · ',
  },
} as const;

// ── Team Select ───────────────────────────────────────────────
// Primitive contract for the team-select craft moment. The component keeps
// the drum mechanics (spring rotation, arrows, dots, launch sequence);
// engagements rebuild the medallion faces through the media slots below.
//
// Media modes, per team:
//   generative — zero-asset default. A slow field of drifting bodies in the
//                team hue and its darker/lighter neighbors, painted on a
//                local canvas: a static frame at rest, in motion only while
//                the medallion is focused.
//   image      — static art in `still`; subtle scale (≤1.03) while focused.
//   video      — the Sprite freeze-frame pattern: `still` is the poster
//                frame at rest, `loop` plays muted while the medallion is
//                focused and freezes again on blur.

export type TeamMediaKind = 'generative' | 'image' | 'video';

export interface TeamMediaSlot {
  kind: TeamMediaKind;
  still: string;
  loop: string;
}

export const TEAM_SELECT_CONFIG = {
  headline: 'Choose your team.',
  ctaLabel: 'Enter the board',
  // Serif-italic line on a medallion when the team has no creative platform
  // name yet (or platform names are switched off).
  fallbackTagline: 'A team, a platform, and a wall of its own.',
  // Shows each team's creative platform name on its medallion, and echoes
  // the active team's platform line under the drum.
  showPlatformNames: true,
  // 'ring' (the 3-medallion drum) is the only shipped layout; the flag
  // reserves the slot for a future grid at higher team counts.
  layout: 'ring' as const,

  // DROP-IN SLOTS: place clips at app/public/video/teams/<slug>.mp4 (and an
  // optional poster <slug>.jpg) and they play Sprite-style — poster at rest,
  // loop while focused. Missing files fall back to generative at runtime, so
  // these paths are safe to ship empty. Three short David Ogilvy clips make
  // a perfect prototype set.
  media: {
    'group-1': { kind: 'video' as TeamMediaKind, still: '/video/teams/group-1.jpg', loop: '/video/teams/group-1.mp4' },
    'group-2': { kind: 'video' as TeamMediaKind, still: '/video/teams/group-2.jpg', loop: '/video/teams/group-2.mp4' },
    'group-3': { kind: 'video' as TeamMediaKind, still: '/video/teams/group-3.jpg', loop: '/video/teams/group-3.mp4' },
  } satisfies Record<GroupSlug, TeamMediaSlot>,
} as const;

// ── Page Names ────────────────────────────────────────────────
// The naming formula (from the Coke teardown): each surface gets an
// article-name, an italic tagline where shown, and one verb. Venue
// metaphors generalize; these are the Ogilvy-edition names.

export const PAGE_NAMES = {
  teamSelect:       'Team Select',
  tunnel:           'Loading',
  teamBoard:        'The Board',
  coachRoom:        'The Coaching Room',
  bigBoard:         'The Feed',
  centerCourt:      'The Stage',
  quickAdd:         'Quick Add',
  quickToss:        'Quick Add',
  startingLineup:   'The Shortlist',
  report:           'The Real Report',
  admin:            'Operator Console',
  vote:             'The Ballot',
  bench:            'Set Aside',
} as const;

// ── Image Vocabulary ──────────────────────────────────────────
// Every user-facing string of the image feature, in one place — the
// same treatment PAGE_NAMES gives surface names, for the same reason.
//
// ROUND 11 RULING (user): this vocabulary is SKIN, not mechanic. The
// BASE set names the FUNCTION — Visualize / Options / Image — and is
// what the platform ships out of the box, so the feature carries no
// costume into an engagement that has none of its own ("if it's
// NBA/Sprite or DOVE, idk what the darkroom equivalent would be").
// The EDITORIAL set is Ogilvy's darkroom dress: picture it, the
// contact sheet, frames, prints. Swapping the two is the RESKIN
// TIER's job and costs one line — the export at the foot of this
// block — never an edit inside a component.
//
// CODE IDENTIFIERS ARE NOT VOCABULARY. print_url, print_status,
// print_options, print_note, commissionPrint, ContactSheet,
// PrintLightbox, lib/darkroom.ts and the /prints/ asset paths stay
// exactly as they are under either set: DB columns, files and routes
// are not user-facing text. Labels only — the same discipline the
// Newsroom rename kept.

export type ImageVocab = {
  /** The verb, on the action bar: commission images for this idea. */
  action: string;
  actionHint: string;
  /** The waiting state, as a slug beside a spinner. */
  working: string;
  /** The same state as a short card/Stage flag (no ellipsis). */
  workingFlag: string;
  /** The same state stamped over a picture being replaced. */
  workingStamp: string;
  /** A set has landed and still owes the team a choice. */
  readyFlag: string;
  /** The set of options returned by one request. */
  set: string;
  /** One option within the set. */
  item: string;
  /** The chosen thing, hanging on the idea. */
  artifact: string;
  /** The set's header line, above the options. */
  setHeader: string;
  /** The header's right-hand prompt, before and after a choice. */
  choosePrompt: string;
  chooseAnotherPrompt: string;
  /** Close the set, keep what's already chosen. */
  keep: string;
  keepHint: string;
  /** The quiet hover quick-pick on an option. */
  use: string;
  useHint: string;
  /** The commit action in the full-size viewer's label band. */
  useItem: string;
  useItemHint: string;
  inspectHint: string;
  /** Marks the option that is currently the chosen one. */
  current: string;
  /** Reopen the kept set and swap on taste — no new request. */
  reChoose: string;
  reChooseHint: string;
  /** Ask for a fresh set over an already-chosen image. */
  regenerate: string;
  regenerateHint: string;
  /** Ask again because the idea has moved past its image. The base
      does not distinguish the two regenerate cases; the skin does. */
  regenerateStale: string;
  regenerateStaleHint: string;
  /** The image no longer matches the idea's current text. */
  stale: string;
  /** U6 — a request that never finished: the develop/generation state
      outlived its ceiling (a refresh killed the clock, or the finish
      write failed). The flag is the board card's quiet fact; the line
      and the retry ride the open card's bar. */
  stalledFlag: string;
  stalledLine: string;
  retry: string;
  retryHint: string;
  /** Open the chosen image at room scale. */
  viewFull: string;
  prevItem: string;
  nextItem: string;
  /** The direction modal — optional free text sent with a request. */
  noteTitle: string;
  noteHeadline: string;
  noteSupport: string;
  /** Concrete in-world examples — the shape of a direction. */
  notePlaceholder: readonly string[];
  /** The modal's primary, first time out and every time after. */
  noteSendFirst: string;
  noteSendAgain: string;
  noteSendHint: string;
  /** The one-click skip — the direction is never required. */
  noteSkip: string;
  noteSkipHint: string;
  /** The direction's Courier slug prefix, wherever it is shown. */
  noteSlugLabel: string;
};

/** BASE — the platform's out-of-the-box register. Names the function,
    wears no world. This is what ships when an engagement has not paid
    for a vocabulary of its own. */
export const IMAGE_VOCAB_BASE: ImageVocab = {
  action: 'Visualize',
  actionHint: 'Generate images for this idea — three options arrive in 20–30 seconds',
  working: 'Generating…',
  workingFlag: 'Generating',
  workingStamp: 'Generating',
  readyFlag: 'Options ready',
  set: 'Options',
  item: 'Option',
  artifact: 'Image',
  setHeader: 'Options · one request, three images',
  choosePrompt: 'Choose an image',
  chooseAnotherPrompt: 'Choose a different image',
  keep: 'Keep this image',
  keepHint: 'Close the options and keep the current image',
  use: 'Use',
  useHint: 'Use this image',
  useItem: 'Use this image',
  useItemHint: "Commit this option as the idea's image",
  inspectHint: 'Inspect this image full-size',
  current: 'Current',
  reChoose: 'Choose another',
  reChooseHint: 'Reopen the options — swap images on taste, no wait',
  regenerate: 'Generate again',
  regenerateHint: 'Send it back with direction — three fresh options arrive in 20–30 seconds',
  regenerateStale: 'Generate again',
  regenerateStaleHint: 'The idea has moved since this image — send it back with direction for fresh options',
  stale: 'From an earlier draft',
  stalledFlag: 'Didn\u2019t finish',
  stalledLine: 'Didn\u2019t finish',
  retry: 'Try again',
  retryHint: 'Ask again — three options arrive in 20\u201330 seconds',
  viewFull: 'View the full image',
  prevItem: 'Previous option',
  nextItem: 'Next option',
  noteTitle: 'Add direction',
  noteHeadline: 'Anything you want different?',
  noteSupport: 'Optional. Leave it blank and the image is generated from the idea alone.',
  notePlaceholder: [
    'Warmer. Put people in it.',
    'Less abstract — show the product on a shelf.',
    'Night, city, wet streets.',
  ],
  noteSendFirst: 'Visualize',
  noteSendAgain: 'Generate again',
  noteSendHint: 'Generate three options for this idea — they arrive in 20–30 seconds',
  noteSkip: 'No direction — just generate',
  noteSkipHint: 'Generate without direction',
  noteSlugLabel: 'DIRECTION',
};

/** EDITORIAL — the Ogilvy skin. The darkroom, the contact sheet, the
    frames, the print: a photographic world that says what latency is
    for. Bespoke, and priced that way. */
export const IMAGE_VOCAB_EDITORIAL: ImageVocab = {
  action: 'Picture it',
  actionHint: 'Commission a print for this idea — a sheet of three frames develops in 20–30 seconds',
  working: 'In the darkroom…',
  workingFlag: 'Darkroom',
  workingStamp: 'In the Darkroom',
  readyFlag: 'Sheet ready',
  set: 'Contact sheet',
  item: 'Frame',
  artifact: 'Print',
  setHeader: 'Contact sheet · one commission, three frames',
  choosePrompt: 'Choose the frame',
  chooseAnotherPrompt: 'Choose a different frame',
  keep: 'Keep this frame',
  keepHint: 'Close the sheet and keep the current frame',
  use: 'Use',
  useHint: 'Use this frame as the print',
  useItem: 'Use this frame',
  useItemHint: "Commit this frame as the idea's print",
  inspectHint: 'Inspect this frame full-size',
  current: 'Current',
  reChoose: 'Choose another frame',
  reChooseHint: 'Reopen the contact sheet — swap frames on taste, no darkroom wait',
  regenerate: 'New sheet',
  regenerateHint: 'Send it back with a note — a fresh sheet of three develops in 20–30 seconds',
  regenerateStale: 'Picture it again',
  regenerateStaleHint: 'The idea has moved since this print — send it back with a note for a fresh sheet',
  stale: 'From an earlier draft',
  stalledFlag: 'Didn\u2019t develop',
  stalledLine: 'The sheet didn\u2019t develop',
  retry: 'Develop again',
  retryHint: 'Send it back — a fresh sheet of three develops in 20\u201330 seconds',
  viewFull: 'View the full frame',
  prevItem: 'Previous frame',
  nextItem: 'Next frame',
  noteTitle: 'A note to the darkroom',
  noteHeadline: 'Anything you want different?',
  noteSupport: 'Optional. Leave it blank and the darkroom works from the idea alone.',
  notePlaceholder: [
    'Warmer. Put people in it.',
    'Less abstract — show the product on a shelf.',
    'Night, city, wet streets.',
  ],
  noteSendFirst: 'Develop',
  noteSendAgain: 'Send it back',
  noteSendHint: 'Send this idea to the darkroom — a sheet of three frames develops in 20–30 seconds',
  noteSkip: 'No note — just develop',
  noteSkipHint: 'Commission without a note',
  noteSlugLabel: 'NOTE',
};

// THE ENGAGEMENT'S CHOICE — the one line the reskin tier edits.
// USER RULING (2026-08-01): this feature runs the BASE register even in
// the Ogilvy showcase. The darkroom set reads as bespoke theming on a
// mechanic every engagement needs — Dove or Sprite has no equivalent —
// so the platform names the function and the photographic world stays
// available as a skin. Point this at IMAGE_VOCAB_EDITORIAL to wear it.
export const IMAGE_VOCAB: ImageVocab = IMAGE_VOCAB_BASE;

// ── The Darkroom's standing art direction ─────────────────────
// The engagement's LOOK, as a brief. Every commissioned print is this
// text plus the idea's own words plus the team's optional note —
// composed by buildRenderPrompt() in lib/darkroom.ts, which is the one
// place the three are joined. Swapping this constant re-art-directs
// every picture the workshop makes, and nothing else has to move.
//
// WRITE IT AS PROSE, NOT KEYWORDS. Comma-separated tags ("cinematic,
// moody, 8k, professional") read to an image model as a pile of
// competing weights; a written brief reads as a brief, and the models
// hold composition and restraint far better from sentences. Say what
// the picture IS, then what it is NOT — the negative half is what
// keeps a campaign visual from drifting into stock or into the
// glossy-3-D default every model falls back on.
//
// The shipped text is Ogilvy's: a presentation-ready activation
// photograph with the confidence of the full-page press ad the agency
// invented — one image doing the work. It is the DEFAULT, not a law;
// another engagement replaces it wholesale, the same way coach
// personalities swap.
//
// Two things the builder adds, so don't repeat them here: the idea's
// name/description (Subject) and the 16:9 format line (FORMAT LAW,
// docs/ogilvy-showcase-direction.md Round 9 — every mount is a true
// 16:9 box and no surface crops a print).
export const IMAGE_ART_DIRECTION = `Art-direct this as a presentation-ready "idea brought to life" photograph for a Dove Real Intelligence activation deck: one image doing the work, in the honest documentary register of the Real Beauty campaigns. The frame must make the proposal legible in one glance — what has been made, who it is for, and what is happening. Translate an abstract idea into its clearest concrete proof: a physical artifact, a service encounter, a spatial activation, or a consequential human moment. It is a photograph, not a symbolic illustration, diagram, mood board, or software-company render.

If people appear, they are real people: unretouched skin with visible pores, texture, scars, body hair, and natural variation across age, ethnicity, and body size. Catch them doing something precise — making, presenting, deciding, teaching, reacting — never posed smiling at camera and never the weightless evenly spaced figures of stock photography. Absolutely no beauty-filter look: no porcelain smoothing, no symmetrical face-tuning, no glossy lip-gloss sheen. This is Dove; digital distortion is the thing the workshop exists to end.

Find one focal proposition, not necessarily one isolated object. Use supporting people, props, screens, and environment only when they explain the mechanism, scale, or stakes. Make the production design specific and buildable — real materials, plausible dimensions, integrated technology, practical evidence of how the thing would exist in the world. Let the idea determine the setting rather than defaulting to a boardroom or a generic event space.

Photograph it honestly with coherent, motivated light: soft natural or practical light, true skin tones preserved across every complexion, real depth of field, contact shadows, wear, paper edges, cables, and small imperfections where they make the scene credible. Avoid over-cleaned architectural visualization and cinematic effects that announce themselves before the idea.

Compose for the full wide frame. Establish clear foreground, subject plane, and context; place the focal action on a third when that strengthens the picture; leave intentional breathing room without emptying out an activation that needs useful detail. Human eye level, believable lens, no fisheye or extreme depth-of-field gimmick. Keep essential information away from the outermost edges because every 16:9 mount must read without cropping.

Keep the palette restrained but alive: warm paper whites, deep navy rather than pure black, honest neutrals, and truthful skin colour across the full spectrum of melanin. Deep navy blue (#002663) is the disciplined accent system, with warm gold (#B78938) as its single secondary accent. Each may live in one focal object or repeat across a small family of related physical details — bindings, annotations, a garment edge, a signal — but never becomes a wash, ambient tint, gradient, neon line, or glow across the picture.

Finish it as premium editorial photography that can hold full bleed in a client deck: crisp detail, restrained contrast, subtle grain, material richness. No blanket halftone filter over faces. No lens flare, sparkle, neon, gradient mesh, glassy floating three-dimensional objects, glossy tech-marking sheen, or decorative particles.

Put no readable words in the picture. No legible text, lettering, signage, brand names, logos, watermarks, captions, or interface copy. Abstract charts, unlettered controls, and embedded screens are allowed only when physically part of the idea and helpful to explain it; never floating interface panels. The words live on the card. The photograph proves the idea.`;

// ── The Darkroom's image model ────────────────────────────────
// A DEPLOYMENT decision with real money attached: every commissioned
// sheet is THREE renders, and a room of three teams picturing freely
// will commission dozens. Dial `size` down before dialling the beat
// down — 2K is comfortably enough for a projected key visual, and 4K
// is slower and dearer for detail no room will ever resolve.
//
// The provider is the Vercel AI SDK's Google provider, which is a
// plain npm library and NOT a hosting commitment — the same code runs
// on Cloud Run, a container, or any Node host. Swapping to a different
// image provider is this block plus one import in the route.
//
// NOT configurable: the 16:9 aspect ratio. That is the FORMAT LAW
// (docs/ogilvy-showcase-direction.md, Round 9) — every mount in the
// product is a true 16:9 box and no surface crops a print — so the
// route pins it rather than reading it from here.
export const IMAGE_MODEL = {
  /** Gemini 3 Pro Image ("Nano Banana Pro"). `gemini-3-flash-image`
      renders faster and cheaper if a room outgrows the wait. */
  id: 'gemini-3-pro-image',
  size: '2K' as '1K' | '2K' | '4K',
};

// ── Framework Fields ──────────────────────────────────────────
// Optional per-idea metadata fields beyond name/description.
// Keys map to DB columns on the ideas table; labels and prompts are
// the user-visible framing per engagement. Showcase prompts teach the
// slot instead of rendering a bracket token.

export const FRAMEWORK_FIELDS = [
  { key: 'wave',            label: 'Wave',                 prompt: 'Near-term push or longer build? Each engagement defines its own waves.' },
  { key: 'bbei_connection', label: 'Strategic Connection', prompt: 'How does this idea ladder up to the strategy in the client brief?' },
  { key: 'key_partners',    label: 'Partners',             prompt: 'Who has to be at the table to make this real — inside the client, and beyond?' },
] as const;

// ── Vote Config ───────────────────────────────────────────────

export const VOTE_CONFIG = {
  maxVotesPerPillar: 3,
} as const;
