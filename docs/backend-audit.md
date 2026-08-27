# Backend & data-path audit — 2026-08-03

Scope: every `supabase.from(...)`, `.rpc(...)` and `.channel(...)` in `app/`, every route
under `app/app/api/`, the in-memory shim (`lib/supabase.ts`), and the six new `ideas`
columns that exist today only as comments. Written against the showcase build, judged
against a **real Supabase deployment** — the path nobody has exercised since the print /
present-gate / stable-№ work landed.

Method: read every call site rather than sampling; verified against `supabase/schema.sql`
as the checked-in truth. Fixes applied here are only the unambiguous, local ones (listed
in §8); everything that needs a schema or product decision is a recommendation.

**Headline:** the app cannot currently write `presenting` or any print column to a real
Postgres, and it will not tell you — those writes ignore `error`. Second headline: there
is no RLS and no auth on any mutating API route, so an anon key handed to 69 phones can
delete the room.

---

## 1. Schema truth — the six new columns

`lib/types.ts` documents them; `supabase/schema.sql` does not contain them; no migration
file exists anywhere in the repo. The showcase shim tolerates them because it is a
`Record<string, unknown>` store that `Object.assign`s whatever it is handed.

### 1.1 What a real migration must add

```sql
-- ideas: the Present gate + the Darkroom
alter table ideas
  add column presenting    boolean not null default false,
  add column print_status  text,
  add column print_options text[],
  add column print_url     text,
  add column print_source  text,
  add column print_note    text;

alter table ideas
  add constraint ideas_print_status_check
  check (print_status is null or print_status in ('developing', 'developed'));
```

| column | type | null | default | notes |
|---|---|---|---|---|
| `presenting` | `boolean` | not null | `false` | Every read is `!!idea.presenting`, so nullable would also work — but `not null default false` keeps `teamStageIdeas`'s "selected nothing yet" fallback meaning *chose nothing*, not *unknown*. Backfill is the default. |
| `print_status` | `text` | null | none | Only ever written `'developing'` then `'developed'`. **No code path ever writes it back to null**, so a stranded develop is unrecoverable from the app (see §5.4). CHECK must permit null for pre-Darkroom rows. |
| `print_options` | `text[]` | null | none | The contact sheet: exactly three URLs today, written as a JS `string[]`. PostgREST maps a JSON array to `text[]` cleanly; values are `/`-prefixed asset paths with no commas or braces, so array-literal quoting is not a hazard. `jsonb` would also satisfy every reader (`?.length`, spread into a `Set`) — pick `text[]` to match the declared TS type. |
| `print_url` | `text` | null | none | Deliberately set back to `null` on every re-commission (`darkroom.ts:268`) — the sheet awaits its choice. Nullability is load-bearing, not incidental. |
| `print_source` | `text` | null | none | `"name\ndescription"` snapshot. `isPrintStale` splits on the **first** `\n`, so a name containing a newline would corrupt provenance — names are single-line inputs, so this is a note, not a defect. |
| `print_note` | `text` | null | none | Cleared to `null` by any commission that carries no note — an empty string must not be stored, or the `NOTE ·` chip renders empty. `darkroom.ts:252` already does `note?.trim() || null`. |

**Indexes: none required.** No query in the app filters, orders, or joins on any of the
six. The present gate is computed *client-side* over rows already fetched
(`presentedInCategory`), and the print columns are select-list payload only. Add
`create index idx_ideas_presenting on ideas (category) where presenting;` **only** if the
gate ever moves into the query — which §2.4 recommends for the phone ballot.

**`idea_no` escape hatch (documented in `lib/idea-number.ts`, not needed yet).** The №
is derived from `(team_id, category, created_at, id)`. The one behaviour a column would
buy is survival across a DELETE. If an engagement ever needs that: `add column idea_no int`,
assign at insert, and read it inside `ideaNumbers()` — every consumer already calls that
one function.

### 1.2 Read / write sites

**Writers (all of them):**

| column | writer | file |
|---|---|---|
| `presenting` | `handleTogglePresent` | `app/components/ExpandedCard.tsx` (~L416) — **the only writer in the app** |
| `print_status`, `print_source`, `print_note`, plus `name`+`description` | `commissionPrint` | `app/lib/darkroom.ts:242-255` |
| `print_status`, `print_options`, `print_url` | `commissionPrint`'s develop timer | `app/lib/darkroom.ts:259-272` |
| `print_url` | `chooseFrame` | `app/lib/darkroom.ts:280-285` |

Every one of these is `await supabase.from("ideas").update({...}).eq("id", …)` with the
result discarded. Against a schema without the columns, PostgREST returns
**HTTP 400 / `PGRST204` — "Could not find the 'presenting' column of 'ideas' in the schema
cache"**, the row is untouched, and the UI shows the optimistic state until the next
refetch quietly reverts it. `commissionPrint` is worse: `name` and `description` ride in
the same statement, so a failed commission also **silently drops the participant's text
edits** it was supposed to persist.

**Readers** (verbatim, non-lab): `lib/present-gate.ts` (`presenting`); `lib/darkroom.ts`
(`isPrintStale`, `sheetForIdea`, `noteSlug`); `components/IdeaCard.tsx`;
`components/ExpandedCard.tsx`; `app/center-court/components/PillarView.tsx`,
`FullLineupView.tsx`, `LineupView.tsx`. Labs (`app/card-lab`, `app/stage-lab`) read them
from fixtures and never touch the DB.

**Degradation if the migration is missing but the app still runs:** every read is
optional-chained or `!!`-coerced, so the Board and Stage render — but `presenting` is
always undefined, so `teamStageIdeas` takes the `showingAllFallback` branch for *every* team,
the Stage silently shows every active idea, and — since Round 16 wired the ballot to the
same gate — **the phone ballot silently widens to every active idea in the category**.
The room votes on a set it was never shown, and nothing in the UI says so.

### 1.3 What the shim tolerates that Postgres/PostgREST will not

| # | Shim behaviour | Real behaviour | Blast radius |
|---|---|---|---|
| a | `update`/`insert` with unknown keys → `Object.assign` | 400 `PGRST204` | All six new columns; see above |
| b | `select(cols)` **ignores the column list entirely** | 400 `column … does not exist` | No select list in the app is validated by the showcase, ever. Audited all of them against `schema.sql` — all currently legal. This is a permanent trap for the next field. |
| c | `.single()` on 0 rows → `{data:null,error:null}` | `PGRST116` with `error` set | Sites that branch on `error` flip from success to failure: `/api/settings?key=`, `/api/settings/briefs?category=`, `/api/settings/coach-prompts?coach_type=` return 404 for any key/brief/override row that was never created. Sites that read only `data` (the great majority) degrade correctly. |
| d | `insert` applies **no column defaults** | `status`, `source`, `presenting`, `created_at`, `updated_at` all default | `AddIdeaModal` omits `status` and `source`; in showcase those rows carry `undefined`, so stamps and `source === "ai_scouted"` counts read differently than they will live. |
| e | No CHECK constraints, no unique constraints, no FKs | enforced | `votes.unique(idea_id, voter_id)` is emulated *inside* `showcaseRpc('cast_vote')` only — a direct `votes.insert` would double in showcase and fail live. Nothing does that today. |
| f | `delete` cascades nothing | `votes.idea_id` cascades; **`training_notes.idea_id` does not** | Both delete paths (`/api/ideas/[id]` DELETE, `ExpandedCard.handleDelete`) delete notes first — correct. A future delete that forgets will hit an FK violation live and succeed in showcase. |
| g | `rpc(name)` for an unknown name → `{data:null,error:null}` | 404 | Only `cast_vote` and `merge_ideas` are implemented. A new RPC would *silently succeed* in showcase. |
| h | `count:'exact'` counted **after** `limit` | counted over the whole filtered set | No current caller combines them. |
| i | ordering compares raw JS values | `NULLS LAST` on ASC | `report/page.tsx` orders by `wave`, which is mostly null. Cosmetic. |
| j | `upsert(...).select().single()` returned an **array** | returns the row | **Fixed** (§8). |
| k | `.like()` did not exist → `TypeError` before the query ran | supported | **Fixed** (§8). |

---

## 2. Query inventory

Every `supabase.from(...)` in `app/`, `components/`, `lib/`. Verdict column: ✅ works
against `schema.sql` as written · ⚠️ works but wasteful or fragile · ❌ would fail.

### 2.1 Reads

| Surface | Table · columns | Filters | Verdict |
|---|---|---|---|
| `app/page.tsx` (entry) | `workshop_settings.value` | `key=room_code`, `.single()` | ✅ (row seeded; if deleted, `data` null → no code required) |
| `app/page.tsx` | `teams.slug, creative_platform_name, creative_platform_brief` | — | ✅ |
| `app/[team]/page.tsx` | `teams.*` | `slug=eq`, `.single()` | ✅ falls back to a local team when absent |
| `app/[team]/page.tsx` | `ideas.*` | `team_id=eq`, order `created_at` | ⚠️ `*` now drags `print_source`/`print_note`/`print_options`; needed in full for the stable № |
| `app/[team]/page.tsx` | `training_notes.*` | `idea_id=eq` | ✅ |
| `app/[team]/quick-add` | `teams.id, slug` / `teams.id` | — / `slug=eq` `.single()` | ✅ |
| `app/[team]/quick-add` | `ideas.*` | `category=eq`, order `created_at` | ⚠️ whole category incl. set-aside (needed by `ideaNumbers`), `*` on a phone |
| `app/[team]/quick-add`, `app/vote` | `votes.idea_id` | `category=eq`, `voter_id=eq` | ✅ hits `idx_votes_voter_category` |
| `app/vote` | `workshop_settings.value` ×3 | `key=eq` `.single()` | ✅ |
| `app/vote` | `ideas.*` | `category=eq` | ⚠️ same as quick-add |
| `app/[team]/training-room` | `ideas.*` `.single()` / `category_briefs.brief_context` | `id=eq` / `category=eq` | ✅ |
| `center-court/useCenterCourtData` | `teams.*`, `ideas.*`, `votes.idea_id, voter_id`, `workshop_settings.value` ×3 | `category=eq` on votes | ⚠️ **hottest path in the app** — `ideas.*` refetched on every realtime idea event (500ms debounce) *and* every 60s reconciliation |
| `big-board` | `teams.*`, `ideas.*`, `training_notes.id` head-count | — | ⚠️ `ideas.*` on a 1s debounce, on a screen that only needs `id, team_id, status, source, name, created_at, updated_at` |
| `components/LiveTicker` | `teams.id,slug` · `ideas.id, name, status, source, team_id, created_at, updated_at` · `ticker_messages.*` | `is_active=eq true` | ✅ **the one narrow select in the app — the pattern the others should copy.** Still refetches all ideas on every ideas event (1.5s debounce) on every open surface. |
| `report/page.tsx` | `teams.*`, `ideas.*` (order category→wave→created_at), `votes.idea_id` | — | ⚠️ full table scan of votes; fine at workshop scale |
| `admin/page.tsx` | `teams`, `category_briefs.*`, `workshop_settings.value` ×10 (one query per key), `coach_prompt_overrides`, `ticker_messages`, `ideas` head-counts, `workshop_settings.key,value like 'team_vision_%'` | | ⚠️ **ten separate single-key round trips** where one `.in("key", [...])` would do |
| `/api/teams` | `teams.*` + `ideas.id, team_id, category, status` | — | ✅ two queries, stats computed in memory — the right shape |
| `/api/teams/[slug]`, `/api/ideas`, `/api/ideas/[id]`, `/api/training-notes`, `/api/ticker`, `/api/settings*` | as named | | ✅ |
| `/api/coach` | 6 parallel reads: `coach_prompt_overrides`, `workshop_settings` ×4, `category_briefs`, `teams` | all `.single()` | ✅ all `.single()` results are read as `x?.y \|\| fallback`, so `PGRST116` on a missing row degrades correctly |
| `/api/scout`, `/api/merge`, `/api/report`, `/api/breaking-news` | see §4 | | ✅ |

### 2.2 N+1s and serial round trips

- **`center-court/page.tsx` `linkSelected`** — one `UPDATE` per selected id inside a `for`
  loop, plus one more per merged group. A 6-idea link is 6+ sequential round trips.
  Collapse to `.in("id", [...])`.
- **`/api/ideas/[id]` DELETE** — 4 sequential round trips (exists-check, notes, votes,
  idea). **`ExpandedCard.handleDelete`** — 3. Neither is transactional: a refresh between
  statements leaves the idea alive with its votes gone. A `delete_idea(uuid)` RPC would
  make it one atomic call.
- **`admin/page.tsx` settings load** — ten `.eq("key", …).single()` queries on mount.

### 2.3 Over-fetching on hot paths

`select("*")` on `ideas` runs on the Stage, the Newsroom, the report, the admin export,
the team Board **and both phone ballots**. Since the Darkroom landed, an idea row carries
`print_source` (a full name+description snapshot), `print_note`, and a `print_options`
array — the largest text on the row, and needed by exactly two components. At 150 ideas
× 69 phones this is the payload most worth trimming. The ballot in particular needs only
`id, name, description, team_id, category, status, created_at, presenting`.

### 2.4 Queries that silently depend on shim behaviour

- **Both phone ballots and the Stage gate `presenting` in JavaScript, not in SQL.** With
  the migration missing the field is `undefined` everywhere and the gate opens wide
  (§1.2). Moving the gate into the query (`.or("presenting.eq.true,…")`) is *not*
  recommended — the fallback rule ("a team that marked nothing presents its whole board")
  is per-team and cannot be expressed in one filter without losing the ruling.
- **`/api/phase` and `/api/merge` never touch the shim.** They build their own client from
  `process.env.NEXT_PUBLIC_SUPABASE_URL!`. With no env, `createClient` throws
  `supabaseUrl is required` → 500. `setPhase` and `combineSelected` branch on
  `isShowcaseMode` before calling them, so the app is safe — but `GET /api/phase` is
  publicly reachable and 500s in showcase.
- **`app/[team]/page.tsx` `isLocal`** — when the team row is missing, ideas live in React
  state only and no write is attempted. A real deployment with an unseeded `teams` table
  looks like it is working and persists nothing.

---

## 3. Realtime

### 3.1 Channel inventory

| Channel | Surface | Listens to |
|---|---|---|
| `ideas-realtime` | `/[team]` Board | `ideas` `*` **filtered `team_id=eq.<uuid>`** |
| `center-court-<pillar>` | The Stage | `ideas` `*`; `workshop_settings` **UPDATE only**; `votes` `*` |
| `big-board` | The Newsroom | `ideas` `*` |
| `ticker-messages-realtime` | `LiveTicker` (global chrome) | `ticker_messages` `*`; `ideas` `*` |
| `vote-page` | `/vote` | `workshop_settings` **UPDATE only** |
| `quick-add-voting` | `/[team]/quick-add` | `workshop_settings` **UPDATE only** |

Publication (`schema.sql:172-176`): `ideas`, `votes`, `pillar_visions`,
`ticker_messages`, `workshop_settings`. Every subscribed table is published. ✅
`training_notes` is deliberately unpublished; the Newsroom polls its count every 30s.

### 3.2 Payload-shape assumptions

**There are none, and that is the single most robust thing about this layer.** Every
handler ignores the payload and refetches (`() => debouncedFetchIdeas()`). No code reads
`payload.new.*`, so no `replica identity`, column-rename or new-column change can break a
subscriber. Keep it that way.

### 3.3 Live-deployment gaps

1. **DELETE never reaches the Board.** `filter: team_id=eq.<uuid>` is evaluated against
   the replicated record; with Postgres's default `REPLICA IDENTITY DEFAULT` a DELETE
   carries only the primary key, so `team_id` is absent and the filter cannot match. A
   killed idea stays on the team wall until an unrelated event or a reload. Fix:
   `alter table ideas replica identity full;` — or drop the filter and let the existing
   refetch handle it (the Board refetches its own team anyway).
2. **`workshop_settings` subscribers listen for `UPDATE` only.** An `upsert` against a
   **missing** key emits `INSERT`, which nobody hears. `workshop_state` is seeded, so the
   happy path works — but any deployment seeded without it (or cleared by
   `scripts/clear-data.ts`, which deletes every setting row) has a facilitator pushing
   phases into silence. Fix: `event: "*"`.
3. **`voting_enabled` is fetched once, on mount, and never re-read.** `/vote` subscribes
   to `workshop_settings` but its handler only refreshes `workshop_state` and
   `max_votes_per_pillar`. A phone already open when the facilitator enables voting sits
   on the "The ballot opens when the facilitator calls the vote" screen until it is
   reloaded. One line in `fetchPhase`; not applied here because `app/vote/page.tsx` is
   under concurrent edit.
4. **RLS interaction.** `postgres_changes` respects RLS. Enable RLS without policies and
   every subscription goes quiet *and* every read returns `[]` — the app renders an empty,
   error-free workshop. See §6.
5. **Client rate limit.** `createClient(..., { realtime: { params: { eventsPerSecond: 10 } } })`.
   A 69-voter burst exceeds that; events are dropped, not queued. The Stage's 60s
   reconciliation is what actually guarantees the returns are right — keep it.

### 3.4 The showcase divergence (why a real phone never sees the ballot)

Showcase "realtime" is a `BroadcastChannel('basecamp-showcase')` plus a per-tab
`store`. `BroadcastChannel` is **same-origin, same-browser, same-machine**. A phone that
scans the QR gets a *different* JS runtime with its *own* store seeded from
`showcase-data.ts`, whose `workshop_state` says `voting_open: false`. The join handshake
(`hello` → `snapshot`) rides the same channel, so it cannot cross devices either. The
facilitator opening the ballot on the Stage is therefore invisible to every real phone —
exactly what the UX review found, and it is a property of the transport, not a bug in the
gate.

What a live deployment needs: nothing — Supabase realtime already carries
`workshop_settings` to every device. What a **showcase demo on real phones** needs: a
shared store. Options, cheapest first — (a) run the showcase with Supabase env configured
and use the real path (recommended; costs one project); (b) put `workshop_state` behind a
tiny server route with SSE or 2s polling, leaving the rest of the shim in memory; (c) keep
BroadcastChannel and state in the demo script that the ballot is driven from a second tab
on the same laptop. Do not fake it with `localStorage` events — those are also same-origin
per-device.

---

## 4. API routes

All under `app/app/api/`. **None of them authenticate anything** (§6.4).

| Route | In | Out | Error paths | Notes |
|---|---|---|---|---|
| `POST /api/coach` (edge) | `coachType, ideaName, ideaDescription, ideaCategory, ideaFramework, teamName, teamSlug, prompt, conversationHistory` | text stream | 503 no key · 400 unknown coach · 500 on stream throw | Prompt caps input (2000/5000 chars) and last 10 history turns. `streamText` throws *after* the response starts on most failures, so the 500 branch rarely fires — the client sees a truncated stream. **`teamSlug` was never sent by the client (fixed, §8)** — the route's `teams` lookup was dead and every live reply called the platform "the creative platform". |
| `POST /api/scout` | `teamId, pillar, existingIdeas[]` | `{ideas: [{name, insight, description, bbeiConnection}]}` | 503 · 400 no pillar · 500 with `detail: String(err)` | Zod-pinned to exactly 3. Board falls back to `SHOWCASE_SCOUT_PITCHES` on any non-OK. ⚠️ `detail: String(err)` leaks provider error text to the client. |
| `POST /api/report` | `{facilitatorNotes}` | `{success:true}` | 503 · 500 "Failed to fetch data" · 500 with `detail: err.message` | `maxDuration = 120`. Fire-and-forget: a timeout leaves no record and no partial. |
| `GET /api/report` | — | `{report, generatedAt}` | never errors (`.single()` misses read as null) | ✅ |
| `POST /api/merge` | `{idea_ids[], category, team_id}` | `{ok, id, name, description}` | 503 · 400 ×3 · 500 rpc/AI | Own admin client; 500s with no env. |
| `POST/GET /api/phase` | `WorkshopState` | `{ok, state}` | 400 ×4 validation · 500 | Validation is strict and correct (idle shape, voting only in pillar view, no counts while voting). GET degrades to idle. Own admin client; 500s with no env. |
| `POST /api/breaking-news` | `{force?}` | `{message, reporter}` \| `{skipped}` | 503 · 500 | 10-min cooldown read from `ticker_messages`. |
| `GET/POST /api/ideas`, `GET/PATCH/DELETE /api/ideas/[id]` | | | 400/404/500 | See below. |
| `POST/DELETE /api/votes` | `{idea_id, category, voter_id}` | `{success}` | 400 · 409 limit · 500 | 409 conflates "limit reached" with "already voted" (§5.1). |
| `GET/POST/DELETE /api/ticker`, `GET/PUT /api/settings`, `/api/settings/briefs`, `/api/settings/coach-prompts`, `GET /api/teams`, `GET /api/teams/[slug]`, `GET/POST /api/training-notes` | | | | ✅ shapes match schema |

### 4.1 Vocabulary and idea-shape drift

- **Config vocabulary (`PAGE_NAMES`, `IMAGE_VOCAB`) is not referenced by any route.** Correct
  — routes speak to a model, not to the room, and `IMAGE_VOCAB` is explicitly skin. No drift.
- **`/api/coach`** still describes the framework as "Connection to *{platform}*" and "Key
  Players & Partners", matching `bbei_connection` / `key_partners`. ✅ It knows nothing about
  `presenting` or prints — correct; the coach coaches the idea, not its stage state.
- **`/api/report`** selects an explicit column list and never mentions the new fields. It
  will **not** 500 on them. It reports `starting_lineup`, deliberately ignoring the present
  gate — the Edition reports the shortlist, not the wall. Confirmed intentional against the
  design doc.
- **`/api/ideas` PATCH allow-list** is `["name","description","status","category","wave","bbei_connection","key_partners"]`
  — **`presenting` and the five print columns cannot be set through the documented REST
  surface.** The app writes them directly with supabase-js, so nothing is broken today; it
  is an API-surface gap to close deliberately (needs the migration first).
- **Stale category vocabulary in two error strings** (`"Valid: commercial, mass_media, live_xp"`)
  — Sprite-era slugs that no longer exist. **Fixed** (§8).
- **`/api/breaking-news`** enumerates `reporter_a`/`reporter_b` and is flagged in-file as the
  bespoke layer. No schema dependency.

### 4.2 Secrets

Audited every `process.env` reference. `GOOGLE_GENERATIVE_AI_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` and `ELEVENLABS_API_KEY` appear **only** in
route handlers, `middleware.ts`, and `scripts/` — never in a client component, never
`NEXT_PUBLIC_`. `.env.local` is gitignored; only `.env.local.example` is tracked. ✅ No
secret reaches the browser bundle.

The one real credential problem is not a leak but a design: the admin cookie **is** the
plaintext password (§6.4).

---

## 5. RPCs and writes — a live room's concurrency

### 5.1 `cast_vote(p_idea_id uuid, p_category text, p_voter_id text) → boolean`

**The vote limit is not actually enforced under concurrency.**

```sql
perform from votes where voter_id = p_voter_id and category = p_category for update;
select count(*) into current_count from votes where …;
if current_count >= vote_limit then return false; end if;
```

`FOR UPDATE` locks **rows that exist**. A voter casting their first votes has no rows, so
two concurrent calls lock nothing, both read `count = 0`, and both insert. The limit is
exceeded by the number of concurrent requests. Mitigating in practice: one phone
serializes its own taps (`mutatingIds` guard plus `await`), so it takes two devices
sharing a `voter_id`, or a retried request. Fix (pick one): a transaction-scoped advisory
lock — `perform pg_advisory_xact_lock(hashtext(p_voter_id || p_category));` as the first
statement — or make the insert conditional in a single statement
(`insert … select … where (select count(*) …) < vote_limit`).

Other findings on this RPC:

- **Idempotency inverted.** `on conflict (idea_id, voter_id) do nothing; return found;`
  returns **false** for an already-cast vote. Both clients treat false as rejection and
  revert the optimistic tick — so a double-submit *removes the checkmark for a vote that
  exists*. `/vote` self-heals on reload (`fetchMyVotes`), quick-add reconciles only on
  un-vote. Recommend returning true when the conflict row belongs to this voter, or
  returning an enum so `/api/votes` can stop conflating 409 "limit" with "duplicate".
- **`voter_id` is client-minted** (`crypto.randomUUID()` in `localStorage`). Anyone can
  clear storage and vote again, unlimited. There is no server-side notion of a
  participant. Accept it, or bind voting to the room code.
- **`nullif(value,'')::int` raises 22P02** on a non-numeric `max_votes_per_pillar`; the
  admin field is free text. One bad character makes every vote in the room fail.
- **Un-voting is a raw client DELETE** (`votes.delete().eq(idea_id).eq(voter_id)`) with the
  anon key. With no RLS, any client can delete any voter's votes by guessing nothing at
  all — `voter_id` values are visible to anyone who can read the table.

### 5.2 `merge_ideas(uuid[], text, text, text, uuid) → uuid`

- **Not idempotent.** Two facilitators pressing Combine on the same selection produce two
  merged ideas; the originals are benched twice (harmless) but the wall gains a duplicate.
  There is no request key and no guard. A live room with two operators will hit this.
- Ordering is correct: `/api/merge` generates first, then calls the RPC, so a model failure
  never benches anything.
- The insert omits `presenting` and every print column — a merged idea correctly arrives
  off-stage and unpictured.
- No validation that `p_original_ids` exist or share a category; the route checks category
  but not existence (it does verify ≥2 rows came back). Acceptable.

### 5.3 Idea autosave — last write wins, silently

Three surfaces debounce-save the same row: `ExpandedCard` (700ms), `CoachTakeover`
(700ms), `training-room` (800ms). All write `name`, `description`, `bbei_connection`,
`key_partners` with no precondition on `updated_at`. The Stage's open card and the team
Board's open card are **the same row on two screens** — a facilitator tidying a title while
the team rewrites the description clobbers one of them with no conflict signal. Cheapest
mitigation: field-level writes (only send what changed) plus an `.eq("updated_at", seen)`
precondition that surfaces a "someone else edited this" note. Needs a product call on what
the room should see.

### 5.4 The Darkroom develop is a browser timer

`commissionPrint` stamps `print_status='developing'`, then `setTimeout(20–30s)` **in the
commissioning tab**. Close it, refresh it, or lose the network and the row is stranded
`developing` forever: no code path writes `print_status` back to `null`, and
`commissionPrint` refuses to start when it sees `developing` — so the idea can never be
pictured again. `lib/darkroom.ts` documents this as acceptable for a showcase; for a live
deployment it must be a server job (the file's own "REAL IMPLEMENTATION PLUG-IN" note is
accurate and should be followed), plus a reaper for rows stuck `developing` beyond a
timeout.

### 5.5 Deletes are not transactional

`ExpandedCard.handleDelete` and `/api/ideas/[id]` DELETE each issue 3–4 sequential
statements. A refresh mid-sequence leaves votes/notes deleted and the idea alive.
`training_notes.idea_id` has no `ON DELETE CASCADE`, so the order matters and is currently
right in both places. Recommend a `delete_idea(uuid)` RPC, or add the cascade and let the
FK do it.

---

## 6. Environment and deploy

### 6.1 Required variables

| Var | Consumer | Missing → |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts`, both admin routes, every script | **Showcase mode** — silently, with no banner |
| `GOOGLE_GENERATIVE_AI_API_KEY` | coach, scout, report, merge, breaking-news | 503 from each; every caller has a scripted fallback except `/api/report` and `/api/breaking-news` |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/merge`, `/api/phase`, `scripts/` | Falls back to the **anon** key. The "admin" client is therefore not privileged — the moment RLS exists, both routes break |
| `ADMIN_PASSWORD` | `middleware.ts` | **Fails open** — `/admin` is public to anyone |
| `ELEVENLABS_API_KEY` | `scripts/generate-coach-voices.mjs` only | Voice regeneration script unusable; the app ships pre-rendered mp3s |

`.env.local` in this checkout has only `ADMIN_PASSWORD` and `ELEVENLABS_API_KEY` — so
local dev is showcase, as intended.

### 6.2 Is showcase-mode detection robust? No.

```ts
export const isShowcaseMode = !ENV_URL || !ENV_KEY;
```

- The two vars are `NEXT_PUBLIC_`, which Next **inlines at build time** into the client
  bundle. A deploy that supplies env only at *runtime* (a container, a self-host, a
  platform where the build and the run see different environments) ships a browser stuck
  in showcase mode while the server routes talk to the real database. Every write the room
  makes goes into per-tab memory and vanishes; the app looks perfect.
- A **partial** config (URL set, key missing, or a typo'd key name) silently downgrades the
  whole engagement to a demo. Nothing logs, nothing renders, nothing warns.
- Inside API routes the shim is **per server instance**: a mutation on one lambda is
  invisible to the browser and to the next request, and dies on cold start.

Recommend: log the resolved mode once on boot (server and client), fail the build when
exactly one of the pair is set, and render a persistent "SHOWCASE — no backend" chip on
facilitator surfaces. Three small changes that would have made this whole class of
problem self-reporting.

### 6.3 Row-level security — the biggest open question

`supabase/schema.sql` contains **no `enable row level security` and no policy**. Two
outcomes, both bad, and which one you get depends on how the project was created:

- **RLS off** (raw `schema.sql` applied): Supabase grants `anon` full DML on `public`, so
  the anon key printed into every phone's JS bundle can `delete from ideas`, rewrite
  `workshop_settings`, and read every vote. In a room of 69 people this is one curious
  participant away from a ruined workshop.
- **RLS on with no policies** (Supabase's default posture for tables created through the
  dashboard/CLI templates): every read returns `[]`, every write fails, every realtime
  subscription is silent — and because almost no read checks `error`, the app renders a
  blank, error-free workshop.

This needs an explicit decision before any deployment. The pragmatic shape for a one-day
workshop: RLS on; `select` open to `anon` on every table; `insert`/`update` open on
`ideas`, `votes`, `training_notes`; `delete` and all of `workshop_settings`,
`category_briefs`, `coach_prompt_overrides`, `teams` restricted to the service role, with
the facilitator's writes moved behind API routes that hold it.

### 6.4 Auth

- **No API route authenticates.** `PUT /api/settings` will overwrite *any* setting —
  including `workshop_state` (hijack the room's screen) and, via
  `/api/settings/coach-prompts`, the coaches' system prompts. `DELETE /api/ideas/[id]`,
  `DELETE /api/votes`, `DELETE /api/ticker` are open. `POST /api/report` triggers a 120s
  model call, `POST /api/scout` and `/api/coach` burn tokens — all unauthenticated and
  unrate-limited on a public URL.
- **The admin cookie is the password.** `admin-login` does
  `document.cookie = "admin_auth=" + password` (not httpOnly, no `Secure`, no `SameSite`,
  `path=/`, 24h) and `middleware.ts` string-compares it to `ADMIN_PASSWORD`. The secret is
  readable by any script on the origin, sent to every path including static assets, and
  cannot be revoked without changing the env var. Replace with a `POST /api/admin-login`
  that verifies server-side and sets a signed, httpOnly, `SameSite=Lax` session cookie.
- `middleware.ts` matches `/admin/:path*` only — the API surface is not covered at all.

### 6.5 Platform notes

`/api/coach` is `runtime = "edge"`; `maxDuration` is 15 (merge), 60 (scout), 120 (report).
120s exceeds Vercel's Hobby function ceiling — the report route requires Pro. Report
generation has no progress channel: on timeout the admin sees a generic failure and the
room gets nothing.

---

## 7. Prioritised defect list

Ranked by what actually breaks a live room, not by tidiness.

| # | Defect | Impact | Fix |
|---|---|---|---|
| **1** | `presenting`, `print_status`, `print_options`, `print_url`, `print_source`, `print_note` exist in no migration | Every Present toggle and every Darkroom write 400s **silently**; a failed `commissionPrint` also drops the participant's unsaved text. With the columns absent the present gate opens wide, so **the ballot offers ideas the room never saw** — the exact failure Round 16 was written to prevent | Apply the DDL in §1.1, then check `error` on the two writers in `ExpandedCard.handleTogglePresent` and `lib/darkroom.ts` |
| **2** | No RLS and no policies (§6.3) | Either the anon key in every phone can wipe the workshop, or the app renders blank with no error | Decide, then ship policies with the schema |
| **3** | Every mutating and every AI route is unauthenticated (§6.4) | Anyone with the URL can rewrite `workshop_state`, edit coach prompts, delete ideas, or burn the token budget | Gate mutating + model routes behind the admin session; add the session cookie while you're there |
| **4** | `cast_vote`'s `FOR UPDATE` locks nothing on a voter's first votes (§5.1) | The vote limit is advisory under concurrency; `voter_id` is client-minted so the ballot is stuffable regardless | `pg_advisory_xact_lock(hashtext(voter_id \|\| category))` as the RPC's first statement |
| **5** | `ADMIN_PASSWORD` missing → middleware **fails open** | `/admin` public on any deploy that forgets one env var | Deny when unset; make it a required var |
| **6** | Realtime DELETE never matches the Board's `team_id` filter (§3.3) | A killed idea stays on the team wall until reload | `alter table ideas replica identity full;` or drop the filter |
| **7** | Darkroom develop is a `setTimeout` in the commissioning tab (§5.4) | Refresh mid-develop strands the idea in `developing` **permanently** — no code path clears it | Server-side job per `darkroom.ts`'s own plug-in note; plus a reaper for stale `developing` rows |
| **8** | `workshop_settings` subscribers listen to `UPDATE` only; `voting_enabled` never re-read (§3.3) | First write of a missing key is silent; a phone open before voting is enabled never sees the ballot without a reload | `event: "*"`, and read `voting_enabled` inside `fetchPhase` |
| **9** | Showcase-mode detection is build-time and silent (§6.2) | A runtime-env deploy runs a live server behind a demo browser — the room's work vanishes with no error | Log the mode, fail the build on a half-set pair, show a showcase chip |
| **10** | Idea autosave is last-write-wins across three surfaces (§5.3) | Facilitator and team clobber each other's edits silently | Send only changed fields; add an `updated_at` precondition |
| **11** | `merge_ideas` is not idempotent (§5.2) | Two facilitators → duplicate merged idea on the wall | Request key, or a uniqueness guard on the merge |
| **12** | `/api/phase` and `/api/merge` throw `supabaseUrl is required` with no env (§2.4) | `GET /api/phase` 500s in showcase; both are landmines if the showcase guards are ever removed | Return 503 with a clear message when unconfigured |
| **13** | `scripts/clear-data.ts` updates `teams.brief_context`, `portfolio_thread`, `portfolio_coach_response` — **none exist in `schema.sql`** | The statement can only ever 400, unchecked, while printing `✓`; and it is what `npm run seed:clear` runs, with the **anon** key | Delete the statement (or the whole script — `clear-workshop-data.ts` supersedes it and uses the service role). Left unfixed: which columns a given deployment actually has is a schema question |
| **14** | `select("*")` on `ideas` across Stage / Newsroom / ticker / report / both ballots (§2.3) | Ships `print_source`, `print_note`, `print_options` to 69 phones on every refetch | Narrow the select lists; `LiveTicker` is the in-repo pattern |
| **15** | `/api/ideas` PATCH allow-list omits all six new fields (§4.1) | The documented REST surface cannot set `presenting` or any print field | Extend the allow-list once the migration exists |
| **16** | `nullif(value,'')::int` in `cast_vote` (§5.1) | One non-numeric character in the admin's max-votes field breaks every vote in the room | Validate on write, or `coalesce(nullif(regexp_replace(...)))` |
| **17** | `/api/scout` returns `detail: String(err)` to the client (§4) | Provider error text leaks to the browser | Log server-side, return a generic message |
| **18** | `/api/report` interpolates idea names/descriptions into XML unescaped | A `<` in an idea name corrupts the prompt structure | Escape the five XML entities |
| **19** | `pillar_visions` is seeded, cleared, and published to realtime — and read by nothing | Dead table carrying maintenance cost | Remove, or wire the Edition to it |

---

## 8. What was fixed in this pass

Only unambiguous, local defects. Nothing here required a schema or product decision.

| Fix | File | Why it was unambiguous |
|---|---|---|
| The phone quick-add ballot bypassed the present gate — it offered every active idea in the category while `/vote`, the Stage wall and the returns offered only what was presented | `app/app/[team]/quick-add/page.tsx` | Round 16's ruling is that the gate lives in **one** function read by every surface that shows or collects the ballot; two ballots disagreeing is the drift `lib/present-gate.ts` exists to prevent. *(This file was under concurrent edit; the gate is now applied there through the shared `components/Ballot` — see the note below.)* |
| `/api/coach` looks the team's creative platform up by `teamSlug`, and no client ever sent one — every live coach reply called the platform literally "the creative platform" | `app/app/[team]/training-room/page.tsx` (both call sites) | The route already implements the lookup; the field was simply absent from the request body, and `teamSlug` is in scope |
| Shim had no `.like()` — `admin`'s PPTX export threw `TypeError` before its query ran | `app/lib/supabase.ts` | Missing builder method causing a hard crash on a working feature |
| Shim's `upsert` ignored `.single()`, returning an array where PostgREST returns the row | `app/lib/supabase.ts` | `/api/settings`, `/api/settings/briefs` and `/api/settings/coach-prompts` PUT all read `data.key` — showcase and live returned different shapes |
| Two API error strings named Sprite-era categories that no longer exist (`"Valid: commercial, mass_media, live_xp"`) | `app/app/api/ideas/route.ts`, `app/app/api/ideas/[id]/route.ts` | Derived from `PILLAR_SLUGS` / `IDEA_SOURCES` / `IDEA_STATUSES` instead of hardcoded |

Deliberately **not** fixed, per the audit's brief: the migration (§1.1), RLS policies,
route auth, the `cast_vote` lock, `replica identity`, the realtime event masks, the
Darkroom server job, and `scripts/clear-data.ts` — each needs a schema or product ruling.

**Verification:** `NODE_OPTIONS= npx tsc --noEmit` → clean.
`node scripts/visual-qa-board-stage-newsroom.mjs all http://localhost:3005` → **704
passed, 0 failed, 77 captures**, including the `identity` suite's ballot-scope checks
("the ballot is exactly the set the Stage presented — no more, no less", at 390×844 and
1280×720).

**Concurrency note:** `app/app/[team]/quick-add/page.tsx`, `app/app/vote/page.tsx`,
`app/components/Ballot.tsx`, `app/app/admin/page.tsx`, `app/app/admin-login/page.tsx` and
`app/lib/export-pptx.ts` were being edited by other work during this audit. Both ballots
now fetch the whole category (all statuses — the `ideaNumbers` caller contract) and gate
through `presentedInCategory` before rendering, which is the correct end state. This
audit's commit contains only the files listed above that this pass owns.
