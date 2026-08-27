# Deployment SQL — read this before applying anything

**Nothing in this directory has been executed against a database.** This checkout has no Supabase project attached — every run of the app here uses the in-memory shim, never Postgres. These files were authored for review, not from a passing test, and the verification procedure below exists because of that: it is the first time any of this SQL meets a real server, and every step maps to a claim the repository could not prove. Run it before the room arrives, not after.

The target is **Supabase Postgres** — a sandbox project now, possibly self-hosted Supabase on GCP later. Nothing here is Supabase-Cloud-exclusive: RLS, advisory locks, `replica identity`, the `supabase_realtime` publication and the `anon`/`authenticated`/`service_role` role model are identical on cloud and self-host. The only differences are operational (how you reach psql / the SQL editor, and that self-host must have the Realtime service running for step 8).

## What is in this directory

| File | What it is | Idempotent |
|---|---|---|
| `schema.sql` | The base schema for a **fresh** instance: tables, indexes, functions, realtime publication, placeholder seed | **No** — `create table`, seed inserts. Run once, on an empty database |
| `migrations/2026-08-04-001_present_gate_and_darkroom.sql` | The six `ideas` columns (Present gate + Darkroom) and the Sprite-era category-CHECK drops | Yes |
| `migrations/2026-08-04-002_cast_vote_and_realtime.sql` | `cast_vote` rewritten to hold its limit under concurrency; `replica identity full` on `ideas` | Yes |
| `policies.sql` | RLS on all nine tables, an explicit per-verb posture for `anon`, the ideas column-grant narrowing | Yes |
| `migrations/2026-08-04-003_*` | **Never written.** Reserved for the optional stored `idea_no` escape hatch (an engagement that expects to kill ideas in front of the room, where the derived № shifts every later card). Planned by U10, not built — there is no file, no `idea_no` in `lib/types.ts`, and no stored branch in `lib/idea-number.ts`. Roughly a day if an engagement needs it | — |

## Apply order

**Fresh instance (the normal path):**

1. `schema.sql`
2. `migrations/2026-08-04-001_present_gate_and_darkroom.sql`
3. `migrations/2026-08-04-002_cast_vote_and_realtime.sql`
4. `policies.sql`
5. The engagement's seed (replace `schema.sql`'s placeholder rows: real team names/colors, category briefs, settings)
6. The verification procedure below — **before** the room

**Instance carrying the Sprite-era schema** (`sprite-workshop/app/supabase/schema.sql` lineage) — do **not** run `schema.sql`; run steps 2–6 only. Migration 001 is the full schema delta: it adds the six columns and drops the four pinned category CHECKs (`commercial`/`mass_media`/`live_xp`) that would 23514 every insert from the current app. Existing rows keep their data; re-seeding vocabulary (teams, categories, `enabled_idea_fields`) is a separate, per-engagement step. A **Coke-era** instance (`coke-workshop` lineage: different statuses, no `votes` table) is not a supported delta target — stand up fresh.

If the deployment team seeds from `schema.sql` directly and skips the migrations, `presenting` will not exist and the ballot will refuse to open (U4's unreadable-gate state). That is the designed failure — step 2 below catches it before the room does.

## Required environment

`SUPABASE_SERVICE_ROLE_KEY` is **required**, not optional, once `policies.sql` is applied. Every session-gated route that writes a restricted table — `PUT /api/settings*`, `POST/PATCH/DELETE /api/ticker`, `POST /api/breaking-news`, `POST /api/report`'s storage, `POST/GET /api/phase`, `POST /api/merge`, `PATCH /api/teams/<slug>` — writes through `app/lib/supabase-server.ts`, which resolves to a service-role client when the key is set and falls back to the shared client when it is not. Under this file that fallback **fails loudly** (the anon key cannot write `workshop_settings`), so a missing key costs the admin console and the Stage's phase control their saves — with `NOT SAVED` marks, not silence — until the key is provided. Set it alongside `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both halves of the pair, at **build** time — a half-set pair silently ships a showcase browser; step 1). The service key is server-only: the module throws in a browser context, and `scripts/check-write-errors.mjs` fails the build on any client-side import.

## What `policies.sql` requires of the app, and what it accepts

The head of `policies.sql` carries both lists in full; the short version:

- **The app-side rewiring has landed (2026-08-04):** the API routes above hold the service role, and the admin console no longer writes restricted tables from the browser on a live deployment — its settings, briefs, coach-prompt, ticker, teams and phase mutations go through the session-gated API routes. The console's direct store writes survive only in showcase mode, where the in-memory shim is the store and RLS does not exist. What remains for the deployment team is providing the env: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` (and ideally `ADMIN_SESSION_SECRET`).
- **Accepted exposures, on the record:** any phone can edit or kill any idea (narrowed — `id`, `created_at`, `source`, `gifted_from_team_id` are not grantable); any phone can delete any vote (un-vote has no verifiable identity); `voter_id` is client-minted in localStorage, so the ballot is stuffable by clearing storage regardless of `cast_vote`'s lock; votes and coach system prompts are room-readable; `POST /api/coach` is an unauthenticated model call on a public URL (U5's recorded ruling).

## Verification procedure

Each step names the claim it proves and what failure means for the room. Steps 1–3 catch the expensive failures first. `scripts/verify-deployment.mjs` (U11) automates this list; until it exists, the steps are runnable by hand as written. Use `$URL` for the project URL, `$ANON` for the anon key; REST calls need both `apikey: $ANON` and `Authorization: Bearer $ANON` headers. Write only clearly-marked scratch rows and delete them when done.

1. **Resolved mode** — *claim: the deploy is live, and the browser agrees.* Both `NEXT_PUBLIC_` vars were present at build; the served pages write to Postgres, not to memory. Failure: the room's work vanishes silently into per-tab memory (audit #9 — the worst failure on this list).
2. **Schema** — *claim: the migrations applied.* All six columns exist with the declared types and nullability, the print CHECK is present, and no category CHECK survives:
   ```sql
   select column_name, data_type, is_nullable, column_default
     from information_schema.columns
    where table_name = 'ideas' and column_name in
      ('presenting','print_status','print_options','print_url','print_source','print_note');
   select conrelid::regclass as tbl, conname
     from pg_constraint
    where contype = 'c' and pg_get_constraintdef(oid) ilike '%category%';
   ```
   The first must return six rows (`presenting` not-null, default false; the rest nullable text/text[]). The second must return nothing. Failure: defect #1 — silent 400s on every Present toggle and commission, and (on a Sprite-era instance) 23514 on every insert.
3. **Present-gate write with the anon key** — *claim: defect #1 is closed end-to-end.* Insert a scratch idea, toggle `presenting`, read it back:
   ```
   PATCH $URL/rest/v1/ideas?id=eq.<scratch-id>   body: {"presenting": true}
   GET   $URL/rest/v1/ideas?id=eq.<scratch-id>&select=presenting   → [{"presenting": true}]
   ```
4. **RLS is on, everywhere** — *claim: no table was missed.*
   ```sql
   select relname, relrowsecurity from pg_class
    where relnamespace = 'public'::regnamespace and relkind = 'r';
   ```
   All nine tables `true`. Failure: the anon key in every phone holds full DML on whatever is `false`.
5. **anon reads everything the room reads** — *claim: no blank workshop.* `GET` each of the nine tables with the anon key; every one returns rows (or `[]` only where genuinely unseeded — `teams`, `workshop_settings` and `category_briefs` must be non-empty). Failure: a missing select policy renders an empty, error-free room and silences its realtime.
6. **anon is denied exactly what the posture denies** — *claim: the lock on the room's configuration holds.* Each of these must **fail** (PostgREST 401/403, or a 0-row write result under RLS):
   - `PATCH $URL/rest/v1/workshop_settings?key=eq.workshop_state` — the hijack-the-screen test
   - `POST $URL/rest/v1/workshop_settings`, and `DELETE` of any settings row
   - `PATCH $URL/rest/v1/teams?slug=eq.group-1`, `POST`/`DELETE` on `teams`, `category_briefs`, `coach_prompt_overrides`
   - `POST $URL/rest/v1/votes` (direct insert — votes move through `cast_vote` alone)
   - `POST $URL/rest/v1/ticker_messages` with `{"style":"breaking", ...}` (forged BREAKING banner)
   - `DELETE $URL/rest/v1/ticker_messages?id=eq.<any>`
   - `PATCH $URL/rest/v1/ideas?id=eq.<scratch-id>` with `{"created_at": ...}` or `{"source":"ai_scouted"}` — the column grant (a `created_at` rewrite would silently renumber the team's wall)
   And these must **succeed** (participant flows): `POST` an idea, `PATCH` its `name`, `POST` a `training_notes` row, `POST` a `style:"standard"` ticker row, `DELETE` the scratch idea. Note: this posture deliberately differs from the plan's draft ("all deletes to the service role") — the kill path and un-vote are participant flows; the ruling is recorded in `policies.sql`.
7. **`cast_vote` holds under concurrency** — *claim: migration 002's advisory lock works.* With `max_votes_per_pillar` = N, fire N+2 **parallel** calls for one fresh voter:
   ```bash
   for i in $(seq 1 5); do
     curl -s -X POST "$URL/rest/v1/rpc/cast_vote" \
       -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
       -d "{\"p_idea_id\":\"<scratch-idea-$i>\",\"p_category\":\"category_1\",\"p_voter_id\":\"probe-voter\"}" &
   done; wait
   ```
   Then `select count(*) from votes where voter_id = 'probe-voter';` — **exactly N**. This is the only real test of the lock; it cannot be run in this repository. Also confirm the parse hardening: set `max_votes_per_pillar` to `four`, cast once — the vote must succeed under the default of 3, not 22P02.
8. **Realtime DELETE reaches the Board** — *claim: `replica identity full` took.* `select relreplident from pg_class where relname = 'ideas';` → `f`. Then subscribe as the Board does (`postgres_changes`, table `ideas`, `filter: team_id=eq.<uuid>`), delete a scratch idea in that team, and require the DELETE event. Confirm publication membership too: `select * from pg_publication_tables where pubname = 'supabase_realtime';` (five tables). Failure: a killed idea stays on the wall until reload (audit §3.3).
9. **The `updated_at` precondition round-trips** — *claim: U7's honestly-unverifiable edge holds.* Write a row, read `updated_at` back, update with `.eq("updated_at", <that exact string>)` — exactly one row affected. If this fails, every save on the open card will look like a conflict in the room: remove the precondition (one line, flagged in `ExpandedCard`) and keep field-level writes. Also in `docs/BACKEND-TESTING.md`.
10. **Admin session + service role** — *claim: U5 and the service-role rewire hold in the live environment.* `/admin` denies without a cookie; a gated route (`PUT /api/settings`) returns 401 unauthenticated; `POST /api/votes` and `POST /api/ideas` still work without one. Then, WITH a facilitator session: `PUT /api/settings` with a scratch key returns 200 and the value reads back — this proves the route reached Postgres on the service role, because under RLS the anon key cannot write `workshop_settings` at all. Finally, open `/admin` with the session and save a setting from the console itself (e.g. total participants): the console's saves travel through the gated API, so this one click verifies the whole path — browser session → gated route → service client → policy. If it shows `NOT SAVED`, `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong (see Required environment); the server log names the fallback.
11. **Seed sanity** — *claim: the deployment persists.* `teams.slug` matches the config's group slugs (`group-1`, `group-2`, `group-3`); `workshop_state`, `voting_enabled`, `max_votes_per_pillar` and `room_code` rows exist. An unseeded `teams` table looks like a working app and persists nothing (audit §2.4).

## The Darkroom (handoff)

**Superseded 2026-08-05 — the develop is real work now, and there is no server job left to write.** `app/api/darkroom/route.ts` renders three frames in parallel at 16:9 from the engagement's standing art direction (`IMAGE_ART_DIRECTION` in `lib/config.ts`). Which mode runs is decided by the environment rather than a flag: with `GOOGLE_GENERATIVE_AI_API_KEY` set the route renders; without it the route answers 503 and the client falls back to the pre-rendered prints and the staged 20–30s beat. U6's client-side recovery is correct in both modes.

Three things are still owed before a real room runs on it. They are listed at the top of `lib/darkroom.ts` and repeated here because they are deployment work, not app work:

1. **Storage.** The route returns frames as data URLs, which the in-memory shim holds happily and which is what makes a keyless demo deploy possible at all. Against this Postgres they would bloat `ideas` badly — upload each frame in the route and return public URLs instead. Every surface treats `print_options` as opaque strings, so nothing downstream moves.
2. **A reaper.** A scheduled server-side sweep returning any row stuck `developing` past `DEVELOP_CEILING_MS` (`lib/darkroom.ts` — now 180s, sized for a live render) to `print_status = null`, because a server render can die mid-flight too. The client recovery stays regardless: it is the participant's own way out between sweeps.
3. **A spend bound.** Nothing rate-limits commissioning and every click is three renders. Fine behind a protected demo URL; not fine on an open one.

## Validation status of these files

No database, so: all four SQL files were parse-checked with `libpg-query` v17 (the real Postgres parser compiled to a library — syntax only). That version carries no PL/pgSQL parser, so the `cast_vote` body's four SQL expressions were additionally parse-checked as standalone statements, and its control flow reviewed by hand; the files were also reviewed line-by-line against every `supabase.from(...)`/`.rpc(...)` call site in the app. What syntax checking cannot prove — that the policies permit and deny as intended, that the advisory lock serializes, that the replica identity change reaches the filter — is exactly steps 3–8 above.
