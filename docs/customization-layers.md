# Customization Layers — the map

How customizing this platform works, in four layers: what an engagement changes,
where each change lives, and what it costs. Page one is for anyone; the rest is
the reference a developer executes from. The graded inventory behind this doc is
`docs/bespoke-layer-audit.md` (2026-08-04); its D-list was paid down in the
"Bespoke debt:" commits of 2026-08-05, and everything below describes the tree
as it stands after that pass.

Path convention: paths are relative to `app/` (the Next workspace) unless
prefixed `docs/` or noted as repo-root `scripts/`. All `npm run` commands run
from `app/`.

---

## Page one — how a Dove version happens

Suppose Dove signs, and Dove keeps the shipped structure: three teams, three
categories, four coaches. Here is the whole job.

**First, settings — about half a day.** One file, `lib/config.ts`, edited top to
bottom. The accent color is defined exactly once at the top of that file, so
"make it Dove blue" is a three-line edit that re-voices every surface, CSS
included. The same file holds the workshop's name, the team names and hues, the
categories, the coach cast, the surface names ("The Board", "The Newsroom"),
the entry-screen copy, the two values the AI coaches are grounded in (client
brand, cultural domain), the wave labels, and the per-idea framework field
labels. Nothing in this layer carries design risk: the components were built to
read these values, and the guards below prove the swap landed.

**Second, assets — about half a day of platform work.** Files dropped into known
folders: team films and posters, coach portraits and voices, logos, fonts, an
optional unlock-ritual clip, activation images. Every slot degrades gracefully
when a file is absent — a missing team film falls back to a generative field, a
missing coach voice falls back to text, a missing clip leaves the typographic
ritual unchanged — so asset production is a producer's track that never blocks
the build. The slot-by-slot list is `public/ASSETS.md`.

**Third, engagement craft — one to one and a half days, plus content.** The
genuinely bespoke tier: rewriting the guide slides in Dove's voice, re-tuning
the four coach personalities, writing the strategy content the coaches draw on
(pasted into the admin console, no deploy needed), building the seed content
universe, and deciding which skin the deliverable wears. This is
creative-direction work, but every piece lives in a named file — none of it is
archaeology.

**Fourth, the foundation — zero days, because it does not change.** The
mechanics, the interaction laws, the motion grammar, the database schema, the
hardening, and the QA harness are the platform. Changing them is product
development, not customization. The few places where the foundation currently
constrains an engagement (a team count other than three, a non-broadsheet
report) are listed honestly below, with their known costs.

Add half a day of room-size QA at the end — non-negotiable at any tier — and a
full reskin at the current structure is **about 2.5–3 working days of
platform-side effort**, the post-cleanup verdict from the audit. Client asset
production and strategy writing run as their own parallel tracks.

---

## The four layers at a glance

| Layer | What it is | Who does it | Rough effort |
|---|---|---|---|
| 1 — Settings | One config file: every name, color, cast, register | Any developer | Hours |
| 2 — Assets | Drop-in file slots that degrade gracefully when empty | Producer + developer | Hours platform-side |
| 3 — Engagement craft | Named files of bespoke content: prompts, guide, seeds, skins | Creative direction + developer | 1–1.5 days |
| 4 — Foundation | Mechanics, laws, schema, hardening, harness | Nobody, per engagement | Zero (it is the product) |

---

## Layer 1 — Settings (`lib/config.ts`)

One file, 647 lines, commented in place. Work top to bottom.

| Block | What it controls |
|---|---|
| The Accent (`ACCENT` / `ACCENT_BRIGHT` / `ACCENT_DIM`) | The platform's voice color, defined exactly once. `BRAND.colors` reads it, `app/layout.tsx` injects the palette as `--brand-*` custom properties, and `globals.css`'s `@theme` tokens reference those — no other file may bake the hex (the four labs excepted; they record rulings). |
| `PILLARS` / `PILLAR_SLUGS` | Category slugs, labels, abbreviations. Any count works — no consumer bakes a category count. New slugs also go into the `category_briefs` / `pillar_visions` seeds in `supabase/schema.sql`, then re-seed. |
| `STATUS_LABELS` | User-facing status labels ("Shortlisted", "Set Aside"). The slugs and the pipeline shape are foundation. |
| `WAVES` | Wave labels (`label` for the report, `abbr` for the deck). The report and the PPTX read these; the two-wave shape itself is pinned by a DB check constraint (see the product-work list). |
| `GROUPS` / `GROUP_SLUGS` | Team names, `shortLabel`, hues, default categories. The single source of team identity: `lib/showcase-data.ts` and `scripts/seed-demo-data.ts` derive their teams from it at runtime; only the `teams` seed in `supabase/schema.sql` is a hand-copied mirror, and `schema:check` fails the build if it drifts. Any new hue must clear the palette law recorded above `GROUPS` (ΔE ≥ 30 from both the accent and the chip neutral, type at 4.5:1). |
| `COACH_DEFS` / `COACH_TYPES` | Coach names, titles, descriptions, hues, `avatar` and `portrait` paths. The picker derives its grid and its "four ways to push an idea" copy from `COACH_LIST` — 3 coaches stand in one row, 4 compose as 2×2, 5–6 run three across. |
| `BRAND` | Platform name, workshop title, client subtitle, year, the full color set, font stacks. |
| `ENGAGEMENT` | `clientBrand` and `domain` — the two values every coach and scout prompt interpolates at build time. |
| `ENTRY_CONFIG` / `TEAM_SELECT_CONFIG` | The entry hero (lockup, kicker, tagline, orbit copy, atmosphere mode) and the medallion drum (headline, CTA, per-team media slots). |
| `ENTRY_CONFIG.heroTitle` | The biggest type on the entry — the ENGAGEMENT'S workshop name, not the platform's (Basecamp recedes to the header credit it already holds). When it equals `workshopTitle`, the core's sub-line and the header echo both yield so the name never reads twice; long names step the hero scale down automatically. The showcase ships the platform name only because the platform is this engagement's subject. |
| `ENTRY_CONFIG.displayFont` | The hero line's typeface — `{ family, src? } \| null`. Config names the family here; the optional woff2 is a drop-in under `public/fonts/` (Layer 2) and the component injects the `@font-face` itself when set. Scope is the hero line only — nothing else re-fonts. `null` keeps the platform's default display face. |
| `PAGE_NAMES` | Every surface name. The base register (The Board / The Room / The Stage / The Vote / The Shortlist / The Overnight) versus a themed skin is a one-block swap — canonical doc: `base-vocabulary.md` in the workshop-platform project. |
| `IMAGE_VOCAB` | The image feature's register: one export line selects `IMAGE_VOCAB_BASE` (shipped) or `IMAGE_VOCAB_EDITORIAL` (the darkroom skin). |
| `FRAMEWORK_FIELDS` | Labels and prompts for the per-idea fields, read by key everywhere including the printed report. The keys are DB columns and stay put. |
| `VOTE_CONFIG` | The per-category vote limit default (overridable live via `workshop_settings.max_votes_per_pillar`). |

**Verification, after any settings pass:**

```
NODE_OPTIONS= npm run schema:check    # teams seed ↔ GROUPS drift + schema manifest
NODE_OPTIONS= npm run lint            # eslint + check:writes + schema:check
grep -rn "EB3F43" app components lib  # only lib/config.ts (+ the four labs) may hit
```

For an accent-only swap, use the zero-diff capture approach: screenshot Board,
Stage, Newsroom, Vote, and Report before and after, and require the files
byte-identical when the hex is unchanged (the proof from the D-1 pass lives in
`output/playwright/accent-plumbing/`). Same technique for any plumbing-only
change: if nothing should look different, prove that nothing does.

**Three named edits still sit outside config** (deferred debts, on record in
the audit): the browser-tab metadata in `app/layout.tsx` (D-3), the logo paths
in six page headers (D-2 — see Layer 2), and the guide slides in `app/page.tsx`
(D-12 — treated as Layer 3 content in a named file). The model holds; these are
its known exceptions.

---

## Layer 2 — Assets (drop-in slots under `public/`)

The defining property of this layer: every slot degrades gracefully when empty,
so the build never waits on the asset track. Full detail in `public/ASSETS.md`.

| Slot | Path | When absent |
|---|---|---|
| Entry backdrop | `public/backdrop/entry.jpg`, wired by `ENTRY_CONFIG.backdrop` (grade dark; the component scrims and drops the shader over a photo). The scrim intensity is the config dial `backdrop.scrim` — `'light' \| 'standard' \| 'deep'` — because every engagement's photo differs; the ≥4.5:1 type law is fixed regardless of dial, verified by the pure-white torture-test render for any new photo+dial pairing | Generative AmbientField renders unchanged; a broken/missing file falls back at runtime |
| Entry display font | `public/fonts/<file>.woff2`, wired by `ENTRY_CONFIG.displayFont.src` (hero line only) | Platform's default display face renders; a `family` without `src` relies on the viewer's system faces |
| Team films + posters | `public/video/teams/<slug>.mp4` / `.jpg` | Generative field renders instead |
| Unlock-ritual clip | `public/video/unlock-quote.mp4` | Typographic ritual runs unchanged (caption constants sit beside the slot in `app/page.tsx`) |
| Coach avatars | `public/coaches/<name>.png`, per `COACH_DEFS.avatar` | Monogram SVG fallback |
| Coach full-bleed portraits | `public/coaches/full/<name>.png`, per `COACH_DEFS.portrait` | Monogram SVG fallback |
| Coach voices | `public/audio/coaches/<type>.mp3` (regenerate via `scripts/generate-coach-voices.mjs`) | Text-only, no error |
| Logos | `public/logos/` — the entry reads `ENTRY_CONFIG.clientLogo`; six other headers still reference `/logos/ogilvy-logo-{white,ink}.svg` by literal path (D-2) | Drop same-named files, or edit the six call sites |
| Fonts | `public/fonts/*.woff2` + the four `localFont` blocks in `app/layout.tsx` | System fallback stacks |
| Prints / activation images | `public/prints/`, `public/activation-images/` (regenerate via `scripts/generate-prints.py`) | Feature works; showcase frames absent |
| Textures | `public/textures/tartan.svg` | Band simply doesn't paint |
| Reporter headshots | `public/reporters/` | Optional device, drop entirely |

---

## Layer 3 — Engagement craft (named files, genuinely bespoke)

Creative-direction work, every piece with an address:

- **Guide slides** — `GUIDE_SLIDES` in `app/page.tsx`, commented as bespoke.
  One caveat on record: slide one's copy states the structure ("Three teams,
  four coaches, one room") and must be kept true to `GROUPS` / `COACH_DEFS` by
  hand.
- **Coach personalities** — system prompts in `lib/coaches.ts` (ship with the
  deploy) or live overrides via `/admin → Coaches` (the `coach_prompt_overrides`
  table, no deploy). The `ANTI_TIC_RULES` block is platform; the example block
  at the bottom swaps per engagement.
- **Scout prompt** — `app/api/scout/route.ts`, marked bespoke in place; the
  domain-collision move re-tunes per engagement.
- **Strategy content** — pasted into the admin console, stored in the DB
  (`workshop_settings`, `category_briefs`, per-team platforms), layered into
  every coach call automatically. `lib/engagement-context.ts` holds deliberate
  bracket-token tripwires as fallbacks — see the guards section.
- **Seed content universe** — `lib/showcase-data.ts` (the offline showcase) and
  `scripts/seed-demo-data.ts` (the live seed, `npm run seed`). Team identity
  derives from config in both; the ideas, notes, ticker lines, and platforms
  are the rewrite.
- **Craft moments** — the unlock clip's caption and credit (`app/page.tsx`),
  the atmosphere preset (`components/AmbientShaderField.tsx` palettes, selected
  by `ENTRY_CONFIG.atmosphere`), the breaking-news voice
  (`app/api/breaking-news/route.ts`, optional device).
- **The deliverable's dress** — the Overnight Edition's broadsheet layout in
  `app/report/page.tsx` is the editorial skin; the PPTX's two font constants
  and filename live in `lib/export-pptx.ts`. Data flow in both is config-clean.
- **Skins** — a themed vocabulary (the `PAGE_NAMES` editorial register, the
  `IMAGE_VOCAB_EDITORIAL` darkroom set) is applied in config but designed here.
  Skins are paid work; the base register ships by default.
- **Darkroom art direction** *(live as of 2026-08-05)* — `IMAGE_ART_DIRECTION` in `lib/config.ts` is
  the engagement's LOOK, written as a prose brief: palette, medium, mood, and
  the explicit negative half that keeps a campaign visual out of stock and out
  of the glossy-3-D default. The shipped direction asks for the kind of
  presentation-ready activation photograph creative teams use to make an idea
  tangible: a clear mechanism, a credible moment of use, and one focal
  proposition rather than one isolated object. Swapping that one constant
  re-art-directs every picture the workshop makes. `buildRenderPrompt()` in
  `lib/darkroom.ts` is the single place it joins the idea's words, the 16:9
  format law, and the team's note (which outranks the standing direction on
  everything except format and palette). It ships Ogilvy's because that is
  this edition's subject; it is a default, not a law. `IMAGE_MODEL` beside it
  picks the model and render size — a deployment cost decision (three renders
  per sheet), not a creative one. The model call is
  `app/api/darkroom/route.ts`: with `GOOGLE_GENERATIVE_AI_API_KEY` set it
  renders three frames in parallel at 16:9 and the model's own latency becomes
  the develop beat; without it the route answers 503 and the pre-rendered
  stand-ins and staged develop take over, so one build is both the live
  product and the offline showcase. Still owed before a live room: storage
  instead of data URLs, a server-side reaper, and a spend bound — all listed
  at the top of `lib/darkroom.ts`.

### The arrival moment stays here on purpose

The entry screen is the one surface where the slots are *not* the whole
answer, and that is a ruling, not an omission. Its identity pieces are
config — `heroTitle`, `displayFont`, `clientLogo`, `backdrop` and its
scrim, the accent — so a reskin gets a correct, complete first screen for
free. But the *moment* that screen performs is bespoke by design: Sprite's
video activating and coming to life set the tenor for the room, and the
David Ogilvy clip does the same job in a completely different shape. Those
shapes are right precisely because each was cut for its own room.

Do not generalize them into one video slot. Forcing both through a single
component would settle on a compromise geometry that serves neither, and
the compromise would be invisible in the diff and obvious in the room. What
the platform owes the moment is a clean mounting point, not a template:
stable arrival choreography and timing, a composition that holds whatever
is dropped into the centre, and a defined hand-off into the room. Build the
moment against that scaffold each time.

The default, when an engagement has no crafted moment of its own, is the
composition shipped here — the orbital core over a backdrop, the way the
Coke edition runs it. That is a floor, not a target.

---

## Layer 4 — Foundation (the platform; does not change per engagement)

The mechanics and laws every engagement gets identically: the masonry wall and
its fill law, the present gate (`lib/present-gate.ts`), the vote RPC and its
three-layer protection, the stable idea number, the motion tokens
(`lib/motion.ts`) and the plate-arrival rule, the serif law, the accent
discipline, the ΔE palette law, card anatomy, the schema and its migrations,
the write-receipt convention (`lib/db.ts`), the admin session, the showcase
shim, and the QA harness. The rulings behind these are on record in
`docs/ogilvy-showcase-direction.md`; changing any of them is product
development with its own plan, not engagement work.

### What you cannot change without product work

- **A team count other than three.** The medallion drum bakes 120° rotation
  steps (`app/page.tsx`) and the full-shortlist grid bakes three columns
  (`app/center-court/components/FullLineupView.tsx`). Deferred by user ruling
  until an engagement actually wants it; known cost 1–2 days including motion
  QA. Price it into any such intake.
- **A non-broadsheet report.** The base-register Overnight layout named in
  `base-vocabulary.md` is unbuilt; today the deliverable ships in the editorial
  skin or waits for the ~1-day build.
- **A new framework field.** The keys are physical DB columns, so a new field
  is a migration until the planned JSONB refactor (1–2 days) lands.
- **A third wave.** The DB check constraint pins `wave_1` / `wave_2`; relabeling
  is config, widening the count is a migration decision.
- **The vote mechanic's shape.** Per-category voting with a per-category limit
  is the built mechanic; cross-category voting is schema plus RPC work.
- **A new coach archetype.** Recasting the four is settings and assets; adding
  a genuinely new archetype touches `lib/coaches.ts` and `app/api/coach/route.ts`
  (the guardrails coach runs a separate context path by design).
- **Multi-tenancy.** Deliberately none — one deploy, one Supabase project, one
  subdomain per engagement (`docs/extending-basecamp.md`, Operation 7).

---

## How the layers meet the commercial tiers

- **Reskin** buys layers 1–2 plus a light pass on layer 3 (prompts re-grounded, guide rewritten, seed content).
- **Adapt** buys layer 3 in earnest — new skins, new craft moments, a re-dressed deliverable, mechanics modified at the edges.
- **Custom** buys layer 4 — new mechanics, new geometry, new surfaces.

Numbers and strategy live in `pricing.md` in the workshop-platform project, not
here.

---

## Worked example — Make it Dove

| Change | Layer | Where | Effort |
|---|---|---|---|
| Name the platform and the session | 1 | `BRAND` + `ENTRY_CONFIG` (title, tagline, orbit) in `lib/config.ts` | Minutes |
| Dove blue accent | 1 | The `ACCENT` trio at the top of `lib/config.ts` | Minutes, then the accent grep and zero-diff check |
| New categories | 1 | `PILLARS` + the `category_briefs` / `pillar_visions` seeds in `supabase/schema.sql`, re-seed | An hour |
| Rename the three teams, new hues | 1 | `GROUPS` + the `teams` seed in `supabase/schema.sql`, then `NODE_OPTIONS= npm run schema:check`; hues must clear the palette law | An hour, plus re-measuring the Board's 599px breakpoint against the new names |
| Two teams instead of three | 4 | Drum geometry + full-shortlist grid | Not a reskin — 1–2 days of product work |
| New coach cast (names, titles, hues) | 1 | `COACH_DEFS` | An hour |
| Coach portraits and voices | 2 | `public/coaches/`, `public/coaches/full/`, `public/audio/coaches/` + `scripts/generate-coach-voices.mjs` | Producer half-day; degrades to monograms and text |
| Coach personalities | 3 | `lib/coaches.ts` or `/admin → Coaches` | Half a day |
| Ground the AI in Dove | 1 + 3 | `ENGAGEMENT` in config; strategy content via the admin console | Minutes for config; content is its own track |
| Team films and posters | 2 | `public/video/teams/<slug>.mp4` / `.jpg` | Producer work; degrades to generative |
| Dove logo | 2 | Same-named files in `public/logos/`, or edit the six header call sites (D-2) | An hour |
| Dove fonts | 2 | woff2s in `public/fonts/` + the four `localFont` blocks in `app/layout.tsx` | An hour |
| Rewrite the guide | 3 | `GUIDE_SLIDES` in `app/page.tsx` | An hour; keep the structural sentence true |
| New seed content universe | 3 | `lib/showcase-data.ts` / `scripts/seed-demo-data.ts`, or the live DB via admin | Half a day to a day |
| The deliverable's dress | 3/4 | `app/report/page.tsx` — keep the broadsheet skin, or build the base layout (D-8) | Free to keep; ~1 day to build clean |
| Browser tab title | exception | `app/layout.tsx` metadata (D-3) | Minutes |

---

## Keeping this true

The layers stay honest only because guards enforce them. All are wired into
`npm run lint` and `prebuild` unless noted:

- **`NODE_OPTIONS= npm run schema:check`** — regenerates the schema manifest
  from the checked-in SQL and diffs it against the committed file, and verifies
  the `teams` seed matches `GROUPS` (names, colors, pillars). Drift fails the
  build.
- **`npm run check:writes`** (`scripts/check-write-errors.mjs`, repo root) —
  every mutating DB call must go through `write(...)` from `lib/db.ts`; an
  unchecked write is a build failure, and opt-outs are on the record in source.
- **The accent grep** — `grep -rn "EB3F43" app components lib` must return only
  the definition in `lib/config.ts` (plus comments and the four labs). Run it
  with the engagement's own hex after any swap.
- **Placeholder refusal** — `api/coach` and `api/scout` scan the fully
  assembled prompt and refuse with a 503 if a bracket token survives, so a
  coach can never say "[CLIENT_BRAND]" to a live room; the Operator Console
  pre-flight names the offending source before the room opens.
- **The harness** — `scripts/visual-qa-board-stage-newsroom.mjs` (repo root; 13
  suites, 1110 checks green as of 2026-08-05) plus
  `scripts/visual-qa-mobile.mjs`, run against a dev server from a
  Playwright-equipped checkout per the usage notes in each script. Re-run after
  any pass that touches a surface; use the zero-diff capture technique for
  passes that shouldn't.
- **The rule that binds it all: a new hardcoded engagement string is a
  regression.** If a component needs a client name, a brand hex, a team count,
  or a label, it reads config or it is a bug. After any platform pass, re-run
  the Dove test (`docs/bespoke-layer-audit.md`, section 5) — about an hour, and
  the "Dove in N days" number is the health metric.
