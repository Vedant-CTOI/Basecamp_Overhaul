# Extending Basecamp

Tactical guide for the most common operations when adapting Basecamp for a new engagement.

This document assumes you've read the README and have the platform running locally against a fresh Supabase project. If not, start there. (Rewritten 2026-08-05 against the current tree — the Ogilvy showcase edition. For the full map of what lives in which layer — settings, assets, engagement craft, foundation — read `docs/customization-layers.md` first.)

---

## Mental Model — Three Layers

Before any change, ask: which layer am I touching?

| Layer | Examples | Cost of change |
|---|---|---|
| **Platform** | Realtime model, coaching architecture, voting RPC, synthesis pipeline | High — touches the whole system |
| **Primitives** | Categories, teams, coaches, brand, framework fields, page names | Medium — config edits + a re-seed |
| **Bespoke** | Strategic playbook, category briefs, audience data, partnership guardrails, brand assets, coach prompt overrides | Low — DB content only |

**80% of per-engagement work is bespoke layer.** If you find yourself rewriting platform code for a single engagement, stop and ask whether the change should be a primitive instead.

---

## Operation 1 — Swap Branding for a New Engagement

The branding layer is `lib/config.ts` plus asset drops. No code structure changes.

### 1. Update `app/lib/config.ts`

Work top to bottom; the file is the single source of truth and is
heavily commented in place:

- **The Accent block** — the platform's voice color, defined ONCE at the
  top of the file (`ACCENT` / `ACCENT_BRIGHT` / `ACCENT_DIM`). `BRAND.colors`
  reads it, `app/layout.tsx` injects the palette as `--brand-*` custom
  properties, and `globals.css`'s `@theme` tokens reference those — one
  edit re-voices every surface, CSS included. No other file may bake the
  hex (the four labs excepted).
- **`BRAND`** — name, workshopTitle, subtitle, year, colors (accent,
  surfaces, paper/ink, editorial accents), font stacks.
- **`ENGAGEMENT`** — `clientBrand` and `domain`, the two values every
  coach/scout prompt is grounded in. See Operation 5 for the
  placeholder-safety rules around these.
- **`ENTRY_CONFIG` / `TEAM_SELECT_CONFIG`** — the entry hero (lockup,
  kicker, tagline, orbit copy, atmosphere) and the medallion drum's
  copy + per-team media slots.
- **`PAGE_NAMES`** — surface names. The Ogilvy edition wears the
  editorial skin (The Newsroom, The Overnight Edition, The Ballot); the
  base register is a one-block swap (see `base-vocabulary.md` in the
  workshop-platform project).
- **`IMAGE_VOCAB`** — the image feature's register: one export line
  selects `IMAGE_VOCAB_BASE` (shipped) or `IMAGE_VOCAB_EDITORIAL`.

### 2. Drop assets into `app/public/`

Per `app/public/ASSETS.md` (the accurate slot-by-slot list): fonts,
logos, coach avatars + full-bleed portraits + voices, team videos, the
optional unlock clip, prints, and the tartan texture. Everything
degrades gracefully when a slot is empty.

### 3. Update layout metadata

`app/app/layout.tsx → metadata` still hardcodes the title/description —
derive or edit per engagement (audited as D-3; a config-driven fix is
planned).

### 4. Update the home-page guide

`app/app/page.tsx → GUIDE_SLIDES` — the onboarding slides after
room-code unlock. Explicitly a bespoke layer; note the audited gap
(D-12): slide copy that states structure ("three teams, four coaches")
must be kept in step with GROUPS/COACH_DEFS by hand until it moves to
config.

---

## Operation 2 — Change the Category Structure

Default: 3 categories (`category_1`, `category_2`, `category_3`). You can use any number, any slugs.

### 1. Update `PILLAR_SLUGS` and `PILLARS` in `config.ts`

```ts
export const PILLAR_SLUGS = ['retail', 'media', 'live'] as const;

export const PILLARS = {
  retail: { slug: 'retail',  label: 'Retail',  abbr: 'R',  color: '#5B6470' },
  media:  { slug: 'media',   label: 'Media',   abbr: 'M',  color: '#7A6B5C' },
  live:   { slug: 'live',    label: 'Live XP', abbr: 'L',  color: '#4A6670' },
};
```

### 2. Update `defaultPillars` on each team in `GROUPS`

If teams are assigned different category subsets per engagement, set per-team here.

### 3. Update `category_briefs` seed in `schema.sql`

```sql
insert into category_briefs (category) values
  ('retail'), ('media'), ('live');
insert into pillar_visions (category) values
  ('retail'), ('media'), ('live');
```

### 4. Re-run schema + re-seed

The DB constraints are relaxed — `category` is just `text not null`, no enum. Any slug works.

### 5. Update seed data

`app/scripts/seed-demo-data.ts` — change the `IDEAS` array's `category` values to match.

**Don't rename the DB column** (`category`). Renaming column names cascades through 30+ files (every page that reads ideas, every API route, every export). Only the slugs need to change.

---

## Operation 3 — Change the Team Structure

`GROUPS` in `config.ts` is the SINGLE source of team identity. The
showcase dataset (`lib/showcase-data.ts`) and the demo seed
(`scripts/seed-demo-data.ts`) derive their teams from it at runtime;
only the `teams` seed in `schema.sql` is a hand-copied mirror (SQL
cannot import TS), and `scripts/build-schema-manifest.mjs` FAILS THE
BUILD if that copy drifts from config.

### 1. Update `GROUP_SLUGS` and `GROUPS` in `config.ts`

```ts
export const GROUPS = {
  'group-1': { slug: 'group-1', name: 'Hathaway', shortLabel: 'HATHAWAY', color: '#2438D6', defaultPillars: [...] },
  // ...
};
```

`shortLabel` is the compact display label (ticker chips, Newsroom team
tags, Stage queue) — the team name uppercased unless designed otherwise.
Any new team hue must clear the palette law recorded above `GROUPS`:
ΔE ≥ 30 from both the platform accent and the category-chip neutral,
with type at 4.5:1.

### 2. Copy the values into the `teams` seed in `schema.sql`

Run `npm run schema:check` — it verifies the seed matches config
(names, colors, pillars) and tells you exactly what drifted.

### 3. Per-team content

Showcase creative platforms live in `lib/showcase-data.ts`
(`SHOWCASE_TEAM_CONTENT`, typed per slug — a team added to config
without content is a compile error). Live engagements load platforms
via `/admin → Platforms`. Team videos: `public/video/teams/<slug>.mp4`
per `TEAM_SELECT_CONFIG.media`.

### Known limit (priced into intake)

The medallion drum and the full-shortlist grid assume exactly three
teams (audited as D-4). A 2- or 4-team engagement is custom-tier work
until that geometry is derived from `GROUP_LIST.length`.

---

## Operation 4 — Re-Tune the Coaches

Two ways to re-tune coaches:

### A. Edit the system prompts in `app/lib/coaches.ts` (codebase change, ships with deploy)

The four prompt constants (`PROVOCATEUR_PROMPT` etc.) are genericized
templates — re-tune voice/moves to match the engagement. The client
brand and cultural domain interpolate from `ENGAGEMENT` in
`lib/config.ts`; there are no bracket placeholders left in the code
templates, and the routes REFUSE any prompt that still carries one
(see Operation 5's placeholder-safety note).

The `ANTI_TIC_RULES` block is universal — leave it alone unless you have a strong reason. Replace the example block at the bottom with engagement-specific writing examples (the example is the most efficient way to teach voice).

### B. Override prompts at runtime via the admin panel (no redeploy)

`/admin → Coaches`. Each coach has a textarea where you can paste a custom prompt. The override is stored in the `coach_prompt_overrides` table and used by `api/coach/route.ts` in preference to the codebase default.

**Use B for live tuning during workshop prep.** Use A for the canonical version that ships with the deploy.

### Adding or removing a coach

If your engagement needs different coach archetypes:

1. Update `COACH_TYPES` and `COACH_DEFS` in `config.ts`. The guardrails coach (`rights_advisor`) is on a separate code path in `api/coach/route.ts` — that pattern handles partnership/IP/brand guardrails on its own context. The other three share the standard creative-coaching context. Match this pattern or change the architecture deliberately.

2. Update the `COACHES` array in `coaches.ts` and define a new system prompt constant for the new coach.

3. Set `avatar` AND `portrait` on the new `COACH_DEFS` entry and drop the PNGs into `/public/coaches/` and `/public/coaches/full/`. The coach picker derives its grid and its "N ways to push an idea" copy from `COACH_LIST` — 3 coaches stand in one row, 4 compose as 2×2, 5–6 run three across — so no component edit is needed for a different cast size.

---

## Operation 5 — Wire Engagement Context

This is where the platform actually becomes useful for a specific engagement. Coach quality lives or dies based on the context you pipe in.

### Three layers of context

| Layer | What it is | Where to set it |
|---|---|---|
| **Layer 1 — Strategic** | The engagement's brief, evaluation framework, partnership goals, brand guardrails | `/admin → Playbook` (writes to `workshop_settings.strategic_playbook`) |
| **Layer 2 — Per-Category** | Category-specific brief, audience data, channel architecture | `/admin → Category Briefs` (writes to `category_briefs.brief_context` and `category_briefs.fan_context`) |
| **Layer 2.5 — Per-Team** | Each team's creative platform name + brief | `/admin → Platforms` (writes to `teams.creative_platform_name` and `teams.creative_platform_brief`) |
| **Audience** | Universal audience data the audience coach (The Listener) should know cold | `/admin → Audience Data` (writes to `workshop_settings.fan_context`) |
| **Insights** | Workshop insights, stimuli, prior-session takeaways | `/admin → Insights` (writes to `workshop_settings.insights`) |
| **Partnership Guardrails** | IP, rights, talent usage, territory, approval windows — used by the guardrails coach | `/admin → Partnership Guardrails` (writes to `workshop_settings.partnership_guardrails`; readers also alias the pre-rename `nba_rights` key so old DBs keep their content) |

### Mental model

Coaches see all of this, **layered automatically** by `api/coach/route.ts`. You don't write code to wire the context — you paste content into admin textareas. The route reads from `workshop_settings` and `category_briefs` on every coaching call.

### What good context looks like

- **Strategic playbook**: 500-1500 words. Cover the brief, evaluation lenses, partnership goals, tone of voice, key tensions.
- **Category briefs**: 500-1000 words each. Cover the channel-specific creative direction.
- **Audience data**: dense behavioral + cultural observations, with stats where they sharpen the point. Don't just paste a research deck — synthesize.
- **Workshop insights**: 100-500 words. Recent observations the room shared. The coaches will lean on these as primary evidence over universal data.
- **Partnership guardrails**: directive language. "Do X. Don't Y. Approval needed for Z within 10 days."

### Placeholder safety (D-6)

The context fallbacks in `lib/engagement-context.ts` carry bracket
tokens (`[ENGAGEMENT_STRATEGIC_CONTEXT]`, `[CATEGORY_N_BRIEF]`) as
deliberate TRIPWIRES. `api/coach` and `api/scout` scan the fully
assembled system prompt and refuse with a 503 ("Not sent · …placeholder
tokens…") if one survives — a coach can never say "[CLIENT_BRAND]" to a
live room. The Operator Console pre-flight ("Prompt placeholders" row)
names the offending source before the room opens. So: load real content
into every admin section above before rehearsal, and treat a red
pre-flight row as a blocker, not a nag.

---

## Operation 6 — Add a Framework Field

Per-idea fields beyond name/description (e.g. "Wave", "Strategic Connection", "Key Partners") are configurable.

### Currently shipping

`app/lib/config.ts → FRAMEWORK_FIELDS`:
```ts
export const FRAMEWORK_FIELDS = [
  { key: 'wave',            label: 'Wave',                 prompt: 'Near-term push or longer build? …' },
  { key: 'bbei_connection', label: 'Strategic Connection', prompt: 'How does this idea ladder up to the strategy…' },
  { key: 'key_partners',    label: 'Partners',             prompt: 'Who has to be at the table…' },
] as const;
```

The `wave`, `bbei_connection`, and `key_partners` fields are **DB columns on the `ideas` table**. The KEYS are code identifiers and stay put (`bbei_connection` is Coke-era but renaming the column would touch every read/write path — the labels are what an engagement edits, and every consumer, including the printed report, reads labels from this config by KEY, never by position). Wave display labels live beside them in `WAVES` (`label` "Wave One" for the report, `abbr` "Wave 1" for the deck) — the DB pins the two-wave shape (`wave_1`/`wave_2`); relabeling is config, adding a third wave is a migration.

### To add a new field

The current architecture requires a schema change for new fields. Three steps:

1. **Add the column** in `schema.sql`:
   ```sql
   alter table ideas add column my_new_field text;
   ```
2. **Add to `FRAMEWORK_FIELDS`** in `config.ts` with a `key` matching the column name.
3. **Update the API routes** that read/write idea data (`api/ideas/`, `api/ideas/[id]/`).
4. **Update components** that render or edit idea fields (`AddIdeaModal`, `ExpandedCard`).

### To turn a field on/off without a schema change

Use the admin's "Idea Fields" toggle (`/admin → Setup`). The toggle controls which fields appear in the UI but doesn't drop the column. This is the low-cost way to flex per engagement.

### Future improvement

Moving framework fields to a JSONB column (`framework_data jsonb`) would let new fields be added without migrations. This is a known refactor on the roadmap; if you're in here making changes, consider it.

---

## Operation 7 — Deploy a New Engagement

The platform is **not multi-tenant**. Each engagement gets its own deploy + subdomain.

### Recommended pattern

1. **Fork this repo** (or create a new branch) per engagement.
2. **Provision a new Supabase project** for the engagement. Apply `schema.sql`. Don't reuse a DB across engagements.
3. **Provision a new Vercel project** linked to the engagement's repo/branch. Set env vars in the Vercel dashboard.
4. **Subdomain**: configure under your team's domain (e.g. `acme-2026.basecamp.your-domain.com`). DNS via the Vercel dashboard.
5. **Pre-workshop**: load the strategic playbook, category briefs, audience data, partnership guardrails via `/admin`. Set the room code. Test the end-to-end coaching flow.
6. **Post-workshop**: run `npx tsx scripts/clear-workshop-data.ts` to wipe proprietary content, leaving the structural data intact. Or destroy the Supabase project entirely.

### Why not multi-tenant

Per-engagement bespoke layers (custom brand, custom prompts, custom framework fields, custom assets) make multi-tenancy expensive and risky. Sharing a DB across engagements creates data-leakage risk in a high-touch confidential context. The deploy-per-engagement pattern is the right default.

### Subdomain cost vs. value

A new Vercel project + Supabase project per engagement costs ~$0–25/month each. The cost is real but small relative to the engagement value. Don't optimize this away by sharing infrastructure.

---

## Operation 8 — Debug Realtime

The realtime layer subscribes to changes in `ideas`, `votes`, `ticker_messages`, and `workshop_settings`. If real-time updates aren't propagating during a live workshop, the cause is almost always one of these:

### 1. Realtime not enabled on the table

Supabase dashboard → Database → Replication. Make sure publication includes the relevant tables. The schema enables this by default but verify on a fresh Supabase project.

### 2. RLS policy blocking the subscription

A SELECT policy that an anonymous user can't satisfy will silently drop the realtime payload. Check `app/supabase/schema.sql` for the policies.

### 3. Connection pool exhausted

Realtime + frequent polling on the same data caused a 20-minute outage on the first deployment. The platform now uses **payload-based realtime** for high-traffic tables (subscriber gets the row payload directly, not a refetch trigger). Don't add polling on top of a realtime subscription for the same data.

### 4. Stale `useEffect` dep array

Common React mistake. If a subscriber re-subscribes constantly, the channel can hit a connection limit. Run the soak test (`scripts/realtime-soak-test.mjs`) to surface this before workshop day.

See `docs/BACKEND-TESTING.md` for full diagnostic procedures.

---

## Operation 9 — Customize the Synthesis Report

The overnight synthesis report is generated in `app/app/api/report/route.ts`. It builds an XML payload of all ideas + statistics, then prompts Gemini for a structured markdown report.

### To change the report shape

Edit the `userPrompt` template in `route.ts` — the section structure (Workshop Overview, Team Summaries, Cross-Team Connections, Shared Dependencies, Wave Analysis, Best of the Rest) is just a markdown skeleton. Add or remove sections to match the engagement's deliverable expectations.

### To change the team-vision extraction

The route extracts a "Draft Platform Vision" per team using a regex. If you change the markdown template's team-section format, update the `teamVisionRegex` to match.

### To change the model

`app/app/api/report/route.ts` uses `gemini-3.1-pro-preview`. Swap to `gemini-3-flash-preview` for a 4x cost reduction and 2x speed at some quality cost. Worth A/B-ing per engagement.

---

## Voting Architecture

How vote uniqueness and the per-category limit are enforced. This is the question every engagement asks.

### Three layers of protection

**Layer 1: Client-side voter identity** — `app/app/vote/page.tsx`

When a participant first lands on `/vote`, the app generates a UUIDv4 via `crypto.randomUUID()` and stores it in `localStorage` under the key `voter_id`. Same browser = same `voter_id` for the workshop's lifetime (until localStorage is cleared).

```ts
function getVoterId(): string {
  const key = "voter_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
```

**Layer 2: DB unique constraint** — `app/supabase/schema.sql`

```sql
create table votes (
  ...
  voter_id text not null,
  unique(idea_id, voter_id)
);
```

Postgres rejects duplicate votes at the constraint level. Even if a client misbehaves and POSTs the same vote twice, the DB rejects the second one.

**Layer 3: Vote-limit RPC with row-lock** — `cast_vote()` stored procedure

The vote endpoint never INSERTs directly; it calls `cast_vote(p_idea_id, p_category, p_voter_id)` which:

1. Reads the configurable limit from `workshop_settings.max_votes_per_pillar` (default 3 if unset)
2. Acquires a `FOR UPDATE` lock on existing votes for that voter+category — prevents concurrent vote requests from racing past the limit
3. Counts authoritative DB state (not client-cached counts) — if `>=` limit, returns `false`
4. Inserts with `ON CONFLICT (idea_id, voter_id) DO NOTHING` — duplicate vote is a no-op, returns `false`

Three guarantees: same-voter-same-idea blocked, concurrent-tap race-condition blocked, stale-UI-bypass blocked.

### What this protects against

| Attack | Defense |
|---|---|
| Same person voting twice for same idea | Unique constraint + ON CONFLICT |
| Tapping "vote" 5x in 200ms to slip past limit | `FOR UPDATE` row-lock + authoritative count |
| Stale client UI showing more votes than allowed | Server-side count is the source of truth |
| Direct API replay attack | Constraint + RPC enforce regardless of client |

### What this does NOT protect against

- **Multiple devices / browsers / incognito.** Each browser generates its own `voter_id` from `localStorage`. Same human, three identities, three quotas. No auth layer.
- **Cleared localStorage mid-workshop.** New voter_id, fresh quota.
- **Direct API access.** Anyone with the public URL can POST to `/api/votes` with any UUID. The RPC enforces per-voter-id limits, not per-human limits.

### Trust model

The platform's voting is built for **trusted-room contexts**: ~20 people in a controlled space, each with their own phone, low incentive to game the vote. The crypto-UUID + DB-constraint pattern is appropriate for that trust level.

It is **not appropriate** for:
- Open registration / large groups
- High-stakes outcomes where vote-stuffing is incentivized
- Public elections

### Adding auth for higher-stakes engagements

If an engagement needs stronger identity guarantees, add an auth layer that ties `voter_id` to a real identity. Three approaches in increasing rigor:

| Approach | What it adds | Cost |
|---|---|---|
| **Room code + name** | Light social pressure; participants register their name in a single shared list before voting | Hours |
| **Magic-link email** | Verified email per voter; harder to multi-account | Day or two — add Supabase Auth, modify `getVoterId()` to use the auth session |
| **SSO** | Tied to client's identity provider | Engagement-dependent — usually a real integration |

In all three, replace `getVoterId()` with `session.user.id` (from Supabase Auth) and ensure the API route reads the voter from the verified session, not from the request body.

### Configurable per engagement

- **Vote limit per category**: `workshop_settings.max_votes_per_pillar` (default 3)
- **Voting on/off**: `workshop_settings.voting_enabled` toggle (in admin)
- **Voting per-category vs. cross-category**: currently per-category; cross-category would require schema + RPC changes

### What happens to votes after the workshop

`votes` table has `on delete cascade` on `idea_id`. If an idea is deleted, its votes go with it. Use `clear-workshop-data.ts` to wipe votes (and other proprietary data) cleanly post-engagement.

---

## Common Gotchas

- **`.next` build artifacts mask type errors.** After renaming routes, run `rm -rf .next` before `tsc --noEmit`.
- **Hydration mismatches on the home page.** The room-code-unlock state reads localStorage. Use `useIsomorphicLayoutEffect` and `AnimatePresence initial={false}` to avoid flash.
- **State batching in card edits.** `setEditingIdea` followed by a save can race if the save reads `editingIdea` from closure. Pass the new value explicitly to the save function.
- **`isAutoNamed` false positives.** When a card is auto-named by AI scout and later edited, the `isAutoNamed` flag should clear. Check this in the `ExpandedCard` save flow.
- **Framer Motion's `AnimatePresence` blocks children with `initial={false}`.** This is intentional but easy to forget when adding nested animated components.
- **Supabase sort stability.** `.order("created_at")` on its own isn't stable across page refreshes when timestamps tie. Add `.order("id")` as a tiebreaker when sort stability matters.
- **Edge runtime constraints.** API routes using `export const runtime = "edge"` can't use Node-only APIs (`fs`, `path`, `crypto.randomBytes`). Use Web Crypto where you need crypto.
- **Turbopack cache.** If a hot-reload looks wrong, hard-refresh. Turbopack occasionally serves stale modules during rapid file changes.

---

## When You Get Stuck

1. **Read the source.** The codebase is small enough to grep through. Most "how does this work" questions are 30 seconds of reading.
2. **Check `progress.md`** for recent state. (May not exist in this fork — that's a per-engagement convention.)
3. **Check `docs/plans/`** for build plans and decision records.
4. **Check git history.** Commits are scoped and well-described.
5. **Ask via the agreed channel.** OC Labs is available as an async sounding board for non-trivial questions.
