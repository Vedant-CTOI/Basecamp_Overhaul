# Bespoke-Layer Audit — The Dove Test

*2026-08-04 · branch `ogilvy-generic` · analysis only, no app code changed.*

The question this answers, in the user's words: *"if we were like 'we need to now make this a Dove platform' — what are all the pieces that would be bespoke to that engagement that we could swap out/adjust relatively easily? and what is NOT built to be easily swappable or replaced or adjusted when it should be?"*

Method: a simulated full reskin — different brand, different fonts and colors, possibly 2 or 4 teams instead of 3, different categories, a different coach cast, different content, no Ogilvy anything — walked across every surface, asking what would have to change and where that change lives. Grades:

- **A — config swap.** One edit in `lib/config.ts` (or a DB row), verified consumed everywhere.
- **B — asset swap.** A documented drop-in file slot that degrades gracefully when empty.
- **C — contained edit.** One known file or component, reasonable work at the reskin tier.
- **D — hardcoded where it shouldn't be.** The gap list; each has a specific fix in section 3.

All file paths are relative to `app/` unless prefixed `docs/`. Line numbers are from today's tree.

---

## 1. The verdict — Dove in five days

**A clean Dove reskin today is realistically ~5 working days if Dove keeps the shipped structure (3 teams, 3 categories, 4 coaches). Roughly 2 of those days are avoidable debt — the D-list. After the D-list is paid down, the same reskin is 2.5–3 days. If Dove wants 2 or 4 teams, add 1–2 days today for geometry that assumes three.**

Where the five days go:

| Work | Time | Why |
|---|---|---|
| Config swaps (BRAND, GROUPS, PILLARS, COACH_DEFS, PAGE_NAMES, ENTRY_CONFIG, TEAM_SELECT_CONFIG, FRAMEWORK_FIELDS labels) | 0.5 day | The config layer genuinely works — see the A rows below. |
| Asset drops (logos, fonts, team videos, coach portraits, voices, unlock clip, prints) | 0.5 day platform-side | Slots exist and degrade gracefully; client asset production is a separate track. |
| Chasing hardcoded duplicates the config swap does NOT reach (48 baked `#EB3F43` across 19 files, ~10 hardcoded `/logos/ogilvy-*.svg` references, the second color system in `globals.css @theme`, `layout.tsx` metadata) | 1 day | D-1, D-2, D-3 below. This is the day that shouldn't exist. |
| Content rewrites (guide slides, coach system prompts + placeholder tokens, engagement context, scout prompt, showcase/seed data, admin placeholder copy) | 1 day | Legitimately bespoke work, but the placeholder tokens fail silently — D-6. |
| A non-broadsheet report layout | 1 day | The Overnight Edition's broadsheet is the Ogilvy skin; the base layout `base-vocabulary.md` calls "the one real build item" does not exist yet. Dove ships a costume or waits for the build — D-8. |
| Team-count geometry if not exactly 3 (drum, full-shortlist grid) and coach-count geometry if not exactly 4 (picker, copy) | +1–2 days | D-4, D-5. |
| Room-size QA pass | 0.5 day | Non-negotiable at any tier; the visual-QA harness (`scripts/visual-qa-board-stage-newsroom.mjs`) covers Board/Stage/Newsroom. |

The structural story is good: the two-layer model (`workshop-platform/productization-framework.md`) mostly holds. Surfaces read `PAGE_NAMES`, `GROUPS`, `PILLAR_LIST`, `COACH_DEFS`, `IMAGE_VOCAB`, and `BRAND.colors` rather than local constants, and the Sprite-era failure ("configs scattered across 6+ files") is largely fixed. What remains is a thinner, more specific debt: the platform's *voice* (red, logos, metadata, fonts) is half-config and half-baked-in, count assumptions hide in three specific components, and the naming seams (`bbei_connection`, `nba_rights`, wave labels) leak one engagement's vocabulary into the next.

---

## 2. Full inventory

### 2.1 Identity and theming

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Workshop name, subtitle, year | `lib/config.ts:216-220` (`BRAND`) | **A** | Consumed by entry, ticker, vote receipts (`app/vote/page.tsx:82,108` scope receipts by `BRAND.workshopTitle`), report dateline/footer, PPTX metadata (`lib/export-pptx.ts:733-734`). |
| Color tokens (primary, surfaces, paper/ink, accents) | `lib/config.ts:222-239` (`BRAND.colors`) | **A/D** | The config exists and most surfaces consume it (`app/vote/page.tsx:13-15`, `app/report/page.tsx:13-15`, ControlStrip, PillarView, LiveTicker, export-pptx). But 48 baked `#EB3F43` occurrences across 19 files duplicate it — see D-1 — and `app/globals.css:10-51` maintains a *second* color system (`@theme` tokens `--color-red`, `--color-ink`, etc., plus legacy aliases `--color-sprite*`/`--color-nba*` at lines 30-37) that must be edited in step with `BRAND.colors`. Two sources of truth. |
| Fonts | `app/layout.tsx:12-33` (localFont, Ogilvy woff2 paths), `app/globals.css:69-88` (`.font-display`/`.font-mono`), `lib/config.ts:242-245` (`BRAND.fonts`), `lib/export-pptx.ts:71-72` (deck fallbacks) | **C** | Structurally swappable: replace the woff2s and the four `localFont` blocks and every surface follows, because everything routes through `--font-ogilvy-serif`/`--font-ogilvy-sans` variables and `.font-display`. The variable names themselves say "ogilvy" in 4 files — code identifiers by the Round 11 discipline, so they may stay, but they will confuse a Dove build team. One documented edit. |
| Logos | Hardcoded `/logos/ogilvy-logo-{white,ink}.svg` in ~10 call sites: `app/page.tsx:311`, `app/[team]/page.tsx:698`, `app/center-court/page.tsx:477`, `app/big-board/page.tsx:297`, `app/admin/page.tsx:799`, `app/admin-login/page.tsx:47`, `app/stage-lab/page.tsx:654`, `app/card-lab/clock-round.tsx:351,451` | **D** | `ENTRY_CONFIG.clientLogo` exists (`lib/config.ts:261-264`) and `OrbitalEntry.tsx:177-184` consumes it — but every header elsewhere bakes the path. See D-2. |
| Browser tab title/description | `app/layout.tsx:40-43` | **D** (small) | "Basecamp · Ogilvy — Co-Creation Workshop Platform" hardcoded; should derive from `BRAND`. See D-3. |
| Selection color, highlight bars, caret color | `app/globals.css:310-318` (`.highlight-bar*`), `:337-341` (`::selection`), `:359` (`.edit-field` caret) | **D** (rides D-1) | All bake `#EB3F43`; `.highlight-bar-chartreuse` (`:318`, `#D6D972`) is a **retired-palette color still live** — used on the report's headline stat (`app/report/page.tsx:146`). |
| Tartan texture | `/public/textures/tartan.svg` via `.tartan-band` (`app/globals.css:320-324`); used at `app/page.tsx:643,744` and `app/center-court/page.tsx:671` | **B/C** | Pure Ogilvy heritage. Swap the SVG for a Dove-equivalent texture or delete the three call sites. Degrades to nothing if the file is absent (background-image just doesn't paint). |
| Halftone, horizon glow, type-texture, motion grammar | `app/globals.css:265-335`, `lib/motion.ts` | **Platform — keep** | The craft layer the rulings protect: "character comes from craft, not costume" (`base-vocabulary.md`). Do not swap per engagement. |
| Drawn marks icon family | `components/Marks.tsx`, `components/ChinaMark.tsx` | **Platform — keep** | `stroke="currentColor"` so they take any palette. These are the platform's hand, not Ogilvy's. |

### 2.2 Teams

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Team names, slugs, colors, short labels | `lib/config.ts:95-104` (`GROUP_SLUGS`, `GROUPS`) | **A** | Consumed everywhere checked: medallions (`app/page.tsx:17-21`), Board (`app/[team]/page.tsx:204-210`), Stage (`useCenterCourtData.ts`, `PillarView`, `LineupView`), Newsroom rows (`app/big-board/page.tsx:249`), ticker chips (`components/LiveTicker.tsx:37-42`), admin (`app/admin/page.tsx:51`), PPTX. Newsroom rows and Stage queue iterate `GROUP_LIST` and are count-agnostic. |
| The `dunkName` slot | `lib/config.ts:98-99` | **C** (cosmetic) | Sprite-era name for "short display label," defaulting to uppercased team name. Works; the name is the only debt. Rename to `shortLabel` when convenient — it is consumed in only two places (`LiveTicker.tsx:40`, `big-board/page.tsx:104`). |
| Team hue rules (`paperType`, `bandText`, `chipText`, ΔE ≥ 30 law) | `lib/config.ts:108-136` + per-surface luminance helpers | **Platform — keep** | Any Dove palette must clear the Round 17 rule (ΔE ≥ 30 from platform accent AND chip neutral, type at 4.5:1). The helpers make any compliant palette work without touching components. |
| **Teams in the DATABASE** | `supabase/schema.sql:185-188` (seed: Team A/B/C, slate hexes), `scripts/seed-demo-data.ts:46+` (Team A/B/C, different again), `lib/showcase-data.ts:36-61` (Hathaway/Touffou/Baskerville, mirrors config by comment discipline only) | **D** | Three parallel team definitions that must be kept in sync by hand. A fresh Supabase deploy seeded from `schema.sql` shows "Team A" on DB-driven surfaces while medallions, ticker chips, and the Board band show config's names/colors. See D-7. |
| Team count = 3 (medallion drum) | `app/page.tsx:209,218` (rotation steps of 120°), `:416` (`rotateY(${i * 120}deg) translateZ(300px)`) | **D** | The drum's geometry is 360/3 baked as the literal 120, and `goToRing`'s shortest-path wrap (`:213-219`) only handles ±1. Two or four teams break the entry's signature moment. `TEAM_SELECT_CONFIG.layout` (`lib/config.ts:325-327`) already reserves a 'grid' slot for higher counts — unbuilt. See D-4. |
| Team count = 3 (full shortlist) | `app/center-court/components/FullLineupView.tsx:71` (`grid grid-cols-3`, one column per team via `GROUP_LIST.map` at `:76`) | **D** | The header two lines up is already count-agnostic ("ACROSS {GROUP_LIST.length} TEAMS", `:64`); the grid isn't. See D-4. |
| Team select copy, CTA, media slots | `lib/config.ts:315-338` (`TEAM_SELECT_CONFIG`) | **A** | Headline, CTA, fallback tagline, per-team media all config. |
| Team videos + posters | `/public/video/teams/<slug>.{mp4,jpg}` | **B** | Fully graceful: `TeamMedallion.tsx:249-255` falls back video → image → generative on missing/failed assets; the generative field is genuinely zero-asset. The model B slot in the codebase. |
| Board phone breakpoint (599px) | `app/[team]/page.tsx:650-685` | **C** (documented) | Measured against THIS engagement's team names and PAGE_NAMES; the comment itself says an engagement with longer names must re-measure. Honest, but it means "rename the teams" has a hidden QA step. |

### 2.3 Categories and framework fields

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Category slugs, labels, abbreviations | `lib/config.ts:19-28` (`PILLARS`) | **A** | Consumed by tabs (`components/CategoryTabs.tsx`), Board counts, Stage pillar views, Newsroom category bars, report sections, PPTX (`export-pptx.ts:82-85` derives labels from config — the comment records the old hardcode as a fixed bug). DB check constraints on category are relaxed (`schema.sql:23,41,85,93`), so slugs can change per engagement without migration. |
| Category count | All consumers iterate `PILLAR_LIST` | **A** | No 3-category geometry found. Report's `md:columns-3` (`report/page.tsx:236,282`) and PillarView's `grid-cols-3` set-aside tray (`PillarView.tsx:890`) are idea-flow columns, not category counts. |
| Framework field labels/prompts | `lib/config.ts:580-584` (`FRAMEWORK_FIELDS`), toggled per engagement via the `enabled_idea_fields` setting (admin UI `admin/page.tsx:995-1010`, consumed in `AddIdeaModal.tsx:76`) | **A** for labels, **D** for keys | Labels are config and admin-toggleable. But the KEYS are physical DB columns — see next row — and two consumers index the array positionally (`app/[team]/training-room/page.tsx:18-23` uses `[1]`/`[2]`; `app/card-lab/page.tsx:397,977`), so reordering config silently mislabels fields. |
| `bbei_connection` column | `supabase/schema.sql:28`, threaded through `api/ideas`, `api/report:87`, `report/page.tsx:318`, `AddIdeaModal`, showcase data | **D** | Sprite-era name for "strategic connection" burned into the schema and every read/write path. The Round 11 "code identifiers are not vocabulary" rule protects it from cosmetic renames, but unlike `print_url` this name is *engagement-branded*, and adding a Dove-specific field today means a migration (the JSONB refactor from `platform-architecture.md` is not done). See D-9. |
| Framework labels re-hardcoded in the report | `app/report/page.tsx:320` ("Platform Connection:"), `:325` ("Partners:") | **D** (rides D-9) | The report invents its own labels instead of reading `FRAMEWORK_FIELDS` — a Dove relabel in config does not reach the printed deliverable. |
| Waves | `lib/config.ts:72-73` (`WAVES` — slugs only, no labels), DB check `schema.sql:27` (`wave in ('wave_1','wave_2')`), labels invented separately as "Wave 1/2" (`export-pptx.ts:89-91`) and "Wave One/Two/Unplaced" (`report/page.tsx:221-223`), literal unions in Stage prop types (`PillarView.tsx:31` et al.) | **D** | Config has no label slot, so two surfaces invented two different label sets; the DB constraint pins the count at exactly two; an engagement wanting "Now / Next / Later" needs a migration plus three component edits. See D-10. |
| Status pipeline | `lib/config.ts:38-58` (`IDEA_STATUSES`, `STATUS_LABELS`, `STATUS_TRANSITIONS`), DB check `schema.sql:26` | **A** for labels ("Shortlisted"/"Set Aside" read from `STATUS_LABELS` — `IdeaCard.tsx:93-98` confirmed) | Slugs `starting_lineup`/`bench` are Coke-era but ruled code identifiers; the check constraint pins the pipeline shape, which is fine at reskin tier. |

### 2.4 Coaches and AI

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Coach names, titles, descriptions, colors, avatar paths | `lib/config.ts:145-207` (`COACH_DEFS`) | **A** | Consumed by `CoachTakeover`, `CoachTile`, `CoachResponse`, training room, admin prompt editor. |
| Coach system prompts | `lib/coaches.ts:49-143`, overridable live per coach via DB (`coach_prompt_overrides`, `api/coach/route.ts:105`) | **C** | Genericized templates with explicit re-tune notes. The DB override path means a Dove build can even re-voice coaches without a deploy. |
| Placeholder tokens in live prompts | `lib/coaches.ts:62,64` (`[CLIENT_BRAND]`, `[ENGAGEMENT_DOMAIN]`), `api/scout/route.ts:90,97,103`, `api/coach/route.ts:176`, `lib/engagement-context.ts:16,32` (whole-file placeholder text used as runtime fallback) | **D** | These render *into real model calls* if not edited; nothing fails loudly. A Dove deploy that misses one ships a coach who says "[CLIENT_BRAND]" to the room. See D-6. |
| Layered engagement context | DB settings (`strategic_playbook`, `insights`, `fan_context`, per-category briefs) win; `lib/engagement-context.ts` is the fallback; assembled in `api/coach/route.ts:56-120` and `api/scout/route.ts:62-75` | **A** (mechanism) | The right architecture: bespoke strategy is DB content, editable in admin, no deploy needed. |
| `nba_rights` settings key | `supabase/schema.sql:199`, `api/coach/route.ts:110-113`, `admin/page.tsx:126,164` (surfaced as "Partnership guardrails") | **D** (small) | Sprite-era key name for partnership/IP guardrails, documented in three comments instead of renamed once. See D-11. |
| Coach count = 4 | `components/CoachTakeover.tsx:818` ("Four ways to push an idea."), `:829` (`grid grid-cols-2` picker — a 2×2 for exactly 4), `:843` (hardcoded type→portrait-filename remap: `fan_lens`→listener, `rights_advisor`→tastemaker) | **D** | The COACH_LIST plumbing is count-agnostic (map everywhere), but the picker's geometry, its copy, and the portrait filename remap all assume this cast. Config comment (`config.ts:139`) frames "3 standard + 1 culture voice" as the pattern — the component should not enforce it. See D-5. |
| Coach voices | `/public/audio/coaches/<type>.mp3` (all four present), played by `CoachTakeover.tsx:359-366` | **B** | Graceful: `.play().catch(...)` → text-only when the file is missing. Regenerate per cast via `scripts/generate-coach-voices.mjs`. |
| Coach avatars + full-bleed portraits | `/public/coaches/*.png`, `/public/coaches/full/*.png` | **B** (avatars) / **C** (portraits) | Avatar paths come from config. The full-bleed picker portraits bypass config via the `:843` remap and have no `onError` fallback (the monogram SVGs still sit in `/public/coaches/*.svg` but nothing wires them). |
| Scout | `api/scout/route.ts` (prompt is marked bespoke, `:85-87`), showcase fallback pitches from `lib/showcase-data.ts` imported directly into `app/[team]/page.tsx:12,320-327` | **C** | Prompt re-tune per engagement is expected. Note the platform Board component imports showcase content directly — acceptable for the offline fallback, but the import is the seam a starter repo must cut. |
| Anti-tic writing rules | `lib/coaches.ts:6-36` | **Platform — keep** | Engagement swaps the EXAMPLE (`:34` says so); the rules stay. |

### 2.5 Entry, guide, and rituals

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Entry hero (lockup, kicker, title, tagline, date, orbit copy, media mode, atmosphere) | `lib/config.ts:256-290` (`ENTRY_CONFIG`), consumed fully by `components/OrbitalEntry.tsx` | **A** | The model config-driven craft moment. Two blemishes ride D-1: `OrbitalEntry.tsx:191,224` bake `#EB3F43` where `BRAND.colors.primary` sits one import away. |
| Room-code flow | `app/page.tsx:90-148` (validates against `workshop_settings.room_code`; any code opens when unset), sessionStorage key `workshop-room-code` | **A / Platform** | No bespoke content; showcase-vs-live behavior is a DB row. |
| Unlock ritual clip | `app/page.tsx:28` (`/video/unlock-quote.mp4` slot, HEAD-checked at `:67-71`; missing file → typographic ritual unchanged) | **B** | Graceful by design. The caption/credit constants (`:38-40`, David Ogilvy 1981) are same-file edits when the clip changes — **C**. |
| Guide slides | `app/page.tsx:157-188` (`GUIDE_SLIDES`) | **C→D** | Explicitly commented "Bespoke layer: rewrite per engagement," but it lives in a component, and slide 1's body hardcodes the structure ("Three teams, four coaches, one room") — a config change to GROUPS/COACH_DEFS silently falsifies the copy. Belongs in config beside ENTRY_CONFIG. See D-12. |
| Launch takeover ("Entering the Room" + team name) | `app/page.tsx:502-583` | **A** | All values flow from the selected team's config. |
| Atmosphere presets | `components/AmbientShaderField.tsx:326-338` (`ember`/`blush` tuned to the red/pink brand), selected via `ENTRY_CONFIG.atmosphere` + `/atmosphere-lab` | **C** | Preset selection is config; a Dove palette needs one new preset object (two color stops) in one file. |

### 2.6 Room surfaces (Board, Stage, Newsroom, Vote, Report)

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Surface names | `lib/config.ts:345-359` (`PAGE_NAMES`) | **A** | Verified consumed on every header/nav checked (Board `[team]/page.tsx:724,826,839`, Stage, Newsroom `big-board/page.tsx:303`, vote `vote/page.tsx:155`, report masthead `report/page.tsx:130`, admin, guide). Base-register swap is the documented one-block edit (`base-vocabulary.md`). |
| Image feature vocabulary | `lib/config.ts:382-572` (`IMAGE_VOCAB_BASE` / `IMAGE_VOCAB_EDITORIAL`, one selector line at `:572`) | **A** | The exemplar. All five image components consume `V.` (`IdeaCard` 4 uses, `ContactSheet` 10, `PrintLightbox` 9, `ExpandedCard` 17); zero baked labels found. Round 12 ruling: base register ships even here — keep it that way for Dove. |
| Board wall (masonry, pockets, empty state) | `app/[team]/page.tsx` | **A / Platform** | Column count is viewport-driven (`:64-66`), not team/category-driven. Copy is platform voice. |
| Stage field planning | `PillarView.tsx:83-110` (`planFieldLayout` computes columns from the actual wall) | **A / Platform** | Count-agnostic by construction. |
| Returns, ballot, present gate | `lib/present-gate.ts` (one rule, four consumers), `components/Ballot.tsx` (fully config/DB-fed), returns grid `PillarView.tsx:1266` (2-col by idea count) | **A / Platform** | No count assumptions found. The gate is the pattern to protect. |
| Newsroom rows, Pace, category bars | `app/big-board/page.tsx` (`GROUP_LIST` order, `PILLAR_LIST` bars) | **A** | Rows grow with team count. Pace thresholds are platform tuning. |
| Ticker | `components/LiveTicker.tsx` | **A/C** | Chips and brand from config; event verb templates (Added/Coached/Shortlisted/Scouted/Renamed) are ruled primitives — keep. Seeded instructional/D.O. lines live in DB (`ticker_messages`) and showcase data, so content swaps with the engagement. `DEMO_BREAKING` pool (`:195-200`) is commented bespoke — contained. |
| Breaking-news device | `api/breaking-news/route.ts` (voice marked bespoke `:12-15`), reporter slots `/public/reporters/` (empty, optional) | **C/B** | Explicitly optional per `ASSETS.md`; drop for engagements without the device. |
| Report (Overnight Edition) | `app/report/page.tsx` — broadsheet masthead, crop marks, "Late City Final" stamp (`:139`), wave group labels (`:221-223`), chartreuse highlight (`:146`) | **C→D** | The layout IS the editorial skin (Round 5: broadsheet is costume). Data flow is config-clean, but the base-register modern layout does not exist, so a non-editorial engagement has nothing to fall back to. See D-8. |
| PPTX export | `lib/export-pptx.ts` | **A/C** | Colors and labels from config (`:57-85`), fonts are two documented constants (`:71-72`), wave labels local (`:89-91`, rides D-10), filename `basecamp-workshop-*.pptx` (`:826`) — one-line edit. |
| Admin console | `app/admin/page.tsx` | **A/C** | Colors/teams/fields from config; placeholder scaffolding in textareas (`:1435,1485`) is teaching copy — fine. "Partnership guardrails" label is the `nba_rights` seam (D-11). |
| Vote receipts | `app/vote/page.tsx:52,82,108` | **A** | Keyed by `BRAND.workshopTitle` — reskin-safe by construction. |

### 2.7 Content and data layer

| Touchpoint | Where it lives | Grade | Notes |
|---|---|---|---|
| Showcase dataset (Divine Discontent everything: teams, ideas, notes, ticker, settings, briefs, visions, coach replies, scout pitches, print map) | `lib/showcase-data.ts` | **C** | Entirely bespoke by design — this is the demo's content universe, and the file is the single place it lives. A Dove build rewrites this file (or, live, seeds the DB instead). |
| Live seed | `scripts/seed-demo-data.ts` + `supabase/schema.sql:180-204` | **C→D** | Marked "replace per engagement," but its Team A/B/C values diverge from config (D-7), and the config-driven seed script from the priority-refactor list ("spin up a new workshop DB in minutes") remains unbuilt. |
| Prints / activation images | `/public/prints/` (8 abstract duotones from `scripts/generate-prints.py`), `/public/activation-images/` | **B** | Regenerate per engagement palette; the darkroom shim (`lib/darkroom.ts`) documents the real-model plug-in point, where the art-direction prompt is explicitly an engagement-config item (`:43-56`). |
| Asset manifest | `app/public/ASSETS.md` | **D** | Drifted badly from the code it documents: names avatars `audience-lens.png`/`guidelines-advisor.png` (config says `listener.png`/`tastemaker.png`), still lists `splatter.png` and the killed sports-era slots, and points to `engagement-logo.png`, which no code references (the code hardcodes Ogilvy SVGs). A Dove team following this file fails. See D-13. |
| Reskin playbook | `docs/extending-basecamp.md` | **D** | Documents the pre-Ogilvy BRAND shape (Bebas Neue, Roboto, yellow `#F8CD24`, splatter) — three generations stale against `lib/config.ts`. Same fix batch as D-13. |
| Labs (`/card-lab`, `/stage-lab`, `/atmosphere-lab`, `/mountain-mark`) | `app/card-lab/`, `app/stage-lab/`, `app/atmosphere-lab/`, `app/mountain-mark/` | **C** | Dev-only option-study surfaces, saturated with Ogilvy content on purpose (they record rulings). Exclude from the starter repo; never client-facing. |

**Inventory totals: 24 touchpoints grade A (or A-mechanism), 6 grade B, 12 grade C, 13 grade D.**

---

## 3. The D-list, ranked by fix cost

Cheapest first. Each fix is written so it can be executed without re-deriving the analysis.

**D-3 — Layout metadata hardcodes the brand.** `app/layout.tsx:40-43`. Fix: `title: \`${BRAND.name} · ${BRAND.subtitle}\`` and derive the description from `ENTRY_CONFIG.tagline`. Cost: 15 minutes.

**D-11 — `nba_rights` settings key.** `schema.sql:199`, `api/coach/route.ts:110-113`, `admin/page.tsx:164`. Fix: rename the key to `partnership_guardrails` in schema seed, showcase settings, and the two readers — or alias at the read site (`nba_rights ?? partnership_guardrails`) if preserving old DBs matters. Cost: 30 minutes. Same batch: rename `dunkName` → `shortLabel` (2 consumers).

**D-2 — Logo paths baked into ~10 headers.** Fix: add `BRAND.logo = { light: '/logos/logo-light.svg', dark: '/logos/logo-dark.svg', alt: BRAND.subtitle }` to config and replace the ten `src="/logos/ogilvy-logo-*.svg"` call sites (list in §2.1). Then a Dove logo is two files plus zero code. Cost: 1 hour.

**D-12 — Guide slides live in a component.** `app/page.tsx:157-188`. Fix: move `GUIDE_SLIDES` to `lib/config.ts` as `GUIDE_CONFIG` (verb, mark key, place, body), and derive the structural sentence from config (`${GROUP_LIST.length} teams, ${COACH_LIST.length} coaches`) so the copy can't lie. Cost: 1-2 hours.

**D-13 — The handoff docs describe a different app.** `app/public/ASSETS.md`, `docs/extending-basecamp.md`. Fix: rewrite both against the current config surface (BRAND as shipped, coach avatar names from `COACH_DEFS`, the video/audio/print slots that actually exist, the D-2 logo slot once built). Cheap, and it multiplies every other fix — the reskin playbook is the product at this tier. Cost: half a day.

**D-6 — Placeholder tokens flow into live model calls.** `lib/coaches.ts:62,64`, `api/scout/route.ts:90,97,103`, `api/coach/route.ts:176`, `lib/engagement-context.ts` (whole file, used as runtime fallback at `api/coach/route.ts:116,120`). Fix: centralize as real config — `ENGAGEMENT.clientBrand` and `ENGAGEMENT.domain` interpolated at prompt-build time — and add a startup (or admin health-panel) check that refuses/flags any prompt still containing `[CLIENT_BRAND]`, `[ENGAGEMENT_DOMAIN]`, or `[ENGAGEMENT_STRATEGIC_CONTEXT]`. The admin panel already has a health section (`admin/page.tsx:864`) to hang this on. Cost: half a day.

**D-1 — 48 baked `#EB3F43` (and friends) betray the one-line accent swap.** 19 files (grep `EB3F43` — full list in the audit trail; biggest offenders `ExpandedCard`, `CoachTakeover`, `[team]/page.tsx`, `training-room`, `globals.css` highlight/selection/caret rules). Also: `globals.css` `@theme` duplicates the whole palette, and `.highlight-bar-chartreuse` still ships a retired-palette hex onto the live report. Fix in three moves: (1) mechanical replace of baked hexes with `BRAND.colors.primary` imports in TSX (labs exempt); (2) make `globals.css` tokens the *only* CSS-side source by generating or hand-syncing them from config in one commented block, and kill the dead `--color-sprite*`/`--color-nba*` aliases after grepping for consumers; (3) replace the chartreuse highlight with the ink or red treatment per the current palette law. Cost: ~1 day including visual QA. This is also the *conceptual* separation the question asked about: after this fix, "red is the platform's voice" survives a Dove reskin as "the accent is the platform's voice" — one value in config, whatever hue Dove's world wants.

**D-10 — Waves are half-configured.** Fix: give `WAVES` the PILLARS treatment — `{ slug, label }` in config — and consume it in `report/page.tsx:221-223`, `export-pptx.ts:89-91`, and the Stage's wave-setter types (replace the `"wave_1" | "wave_2"` literal unions with `Wave`). Widen or drop the DB check constraint (`schema.sql:27`) the same way categories were relaxed. Cost: half a day.

**D-7 — Team identity has three sources of truth.** Config `GROUPS`, DB `teams` rows, and `showcase-data` mirror each other by comment discipline only, and the two seed paths (`schema.sql:185-188`, `seed-demo-data.ts`) ship values that contradict config today. Fix: make config the single authority — generate the seed inserts and `SHOWCASE_TEAMS` from `GROUPS` (the config-driven seed script already on the priority list does exactly this), and decide the precedence rule once: DB `display_name`/`color` override config when present, config is the fallback. Then document which surfaces read which (today the Board band reads config at `[team]/page.tsx:876` while the medallion's platform line reads DB). Cost: 1 day, and it collapses the "new workshop DB in minutes" refactor into the same work.

**D-5 — The coach picker assumes this exact cast of four.** `CoachTakeover.tsx:818` (copy), `:829` (2×2 grid), `:843` (filename remap). Fix: derive the count word from `COACH_LIST.length` (or cut the sentence), make the grid `grid-cols-2` only when `COACH_LIST.length === 4` (3 → three-up row, 5-6 → 3×2), and move the portrait filename onto `CoachDef` as `portrait: '/coaches/full/listener.png'` beside the existing `avatar` slot, with an `onError` fall-through to the monogram SVGs that already exist in `/public/coaches/`. Cost: half a day.

**D-4 — Two components assume exactly three teams.** The medallion drum (`app/page.tsx:209,218,416`) and the full-shortlist grid (`FullLineupView.tsx:71`). Fix: derive the drum's step as `360 / TEAMS.length` and `translateZ` as a function of count (radius ≈ `160 / tan(π/n)` keeps faces from overlapping; at n=2 fall back to a flat two-up, at n≥5 build the reserved 'grid' layout that `TEAM_SELECT_CONFIG.layout` already names), and fix the wrap logic in `goToRing` for n>3. Make FullLineupView `gridTemplateColumns: repeat(GROUP_LIST.length, minmax(0,1fr))` and re-judge type sizes at 2 and 4 columns on the projector rule. Cost: 1-2 days including motion QA — this is the priciest fix, and it is also optional until an engagement actually wants ≠3 teams. Price it into any such intake.

**D-9 — `bbei_connection` and the migration-per-field schema.** Fix at the seam, not the vocabulary: (1) short term, alias in the API layer if the name must die (`strategic_connection` view or rename migration — every consumer is listed in §2.3, about 12 call sites plus the index-coupled `FRAMEWORK_FIELDS[1]`/`[2]` reads in training-room and card-lab, which should become key lookups regardless); (2) real fix is the JSONB `framework` column from `platform-architecture.md`, which removes the migration-per-client cost and makes `FRAMEWORK_FIELDS` config fully self-sufficient. Cost: 1-2 days for the JSONB refactor (already on the priority list; this audit just confirms it is the binding constraint on framework flexibility).

**D-8 — There is no base-register report.** The Overnight Edition ships only as the Ogilvy broadsheet. Fix: build the "clean modern synthesis-report layout" that `base-vocabulary.md` names as the one real base-layer build item, keep the broadsheet as the editorial skin's variant behind a config switch (the same pattern as `IMAGE_VOCAB`), and fold the D-10 wave labels and the §2.3 framework-label fix into it. Cost: 1 day.

---

## 4. What the starter repo should extract

Feeds `workshop-platform/starter-repo-structure.md`. The three-tier split this codebase implies:

**Platform (lift as-is, never per-engagement):** the masonry wall and its laws, `lib/present-gate.ts`, `lib/idea-number.ts`, `lib/motion.ts` tokens, `lib/workshop-phase.ts`, the vote RPC + receipts pattern, the realtime/showcase dual engine in `lib/supabase.ts` (offline showcase mode is a genuine sales asset), the admin gate (`middleware.ts` + `lib/admin-session.ts`, fails closed), `components/Marks.tsx` + `ChinaMark.tsx`, the luminance/contrast helpers (`paperType`, `bandText`, `chipText`) and the ΔE palette law, `IMAGE_VOCAB_BASE` as the shipped register, the anti-tic rules, the layered coach-context architecture (DB wins, config falls back), and the visual-QA harness pattern.

**Primitives (config surface, the engagement's dials):** everything in `lib/config.ts` — after the D-list, this file plus `/public` asset slots plus one seed command should BE the reskin. The additions this audit says it still needs: `BRAND.logo` (D-2), `GUIDE_CONFIG` (D-12), wave labels (D-10), `ENGAGEMENT.clientBrand`/`domain` for prompts (D-6), coach `portrait` slots (D-5), and generation of seeds from config (D-7).

**Engagement (gitignored or per-fork content):** `lib/showcase-data.ts`'s successor (per-engagement seed content), `lib/engagement-context.ts` real strategy text, coach prompt tunings, the scout prompt's domain collisions, the darkroom art-direction prompt, all `/public` assets (fonts, logos, teams video, coach portraits/voices, unlock clip, textures), and the report skin choice.

**Leave behind in the showcase fork entirely:** the four labs, the Ogilvy fonts and logos (licensed), the Divine Discontent dataset, and `docs/ogilvy-showcase-direction.md` (the rulings graduate into platform docs; the Ogilvy dressing stays here).

Also carry the two honest structural limits into the starter repo's intake form: team count ≠ 3 and coach count ≠ 4 are custom-tier work until D-4/D-5 are built, and any new framework field is a migration until D-9's JSONB lands. The intake form should ask these three questions before pricing a reskin.

---

## 5. How to run the Dove test again

Repeat this audit per engagement (or after any platform pass) in about an hour:

1. **Name the hypothetical.** A real brand, a different world: different palette, fonts, team count, category count, coach cast, no incumbent client content.
2. **Read `lib/config.ts` top to bottom** and ask of every block: if I change this, does every surface follow? Then verify with grep, not trust:
   - `grep -rn "<brand-hex>" app components lib --include="*.tsx" --include="*.ts" --include="*.css"` — every hit outside config/labs is drift.
   - `grep -rn -i "<client-name>\|<workshop-title>" app components lib` excluding config, showcase-data, and comments — every hit is a leak.
   - `grep -rn "logos/\|/coaches/\|/video/\|/audio/" app components` — every literal asset path should be a config slot or a documented drop-in.
   - `grep -rn "grid-cols-\|columns-\|\* 120\|translateZ" ` on team-facing and coach-facing components — any literal that equals a team/category/coach count is a D.
   - `grep -rn "\[CLIENT_BRAND\]\|\[ENGAGEMENT" app lib` — placeholders reachable by a live model call must be zero or gated.
3. **Walk the seven surfaces** (entry → team select → Board → Coaching → Stage → Vote/Newsroom → Report → PPTX) with the config *mentally swapped*, hunting copy that states structure ("three teams, four coaches"), labels that duplicate config (wave names, framework labels), and geometry that only works at the shipped counts.
4. **Diff the three team sources** (config `GROUPS`, `schema.sql` seed, showcase/seed scripts) — they must agree or be generated from one another.
5. **Check the handoff docs against the code** (`ASSETS.md`, `extending-basecamp.md`): every path and name they state must exist in the tree. Stale docs are D-grade findings, not cosmetic ones.
6. **Grade every finding A/B/C/D**, re-rank the D-list by fix cost, and update the "Dove in N days" number. The number is the health metric: the productization is working when it falls toward 2-3 days and the D-list stops regrowing between engagements.
