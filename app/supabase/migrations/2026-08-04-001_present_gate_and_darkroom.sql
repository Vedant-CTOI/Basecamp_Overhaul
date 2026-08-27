-- ============================================================
-- 2026-08-04-001 — The Present gate + the Darkroom columns
-- ============================================================
-- U1 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
-- DDL and column-by-column reasoning: docs/backend-audit.md §1.1.
--
-- THIS FILE HAS NEVER BEEN EXECUTED AGAINST A DATABASE. This checkout
-- has no Supabase project attached; the file is authored for review
-- here and applied by the deployment team. See ../README.md for the
-- apply order and the verification procedure.
--
-- APPLIES TO BOTH PATHS:
--   fresh instance      — run immediately after ../schema.sql
--   Sprite-era instance — run as-is; this file IS the schema delta
--                         between sprite-workshop/app/supabase/schema.sql
--                         and what the current app reads and writes.
--                         (A Coke-era instance is NOT a supported delta
--                         target — stand up a fresh instance instead.)
--
-- IDEMPOTENT: yes. `add column if not exists` throughout; constraints
-- are dropped and re-added; the category-check drops are `if exists`.
-- Safe to re-run.
-- ============================================================


-- ── 1. The six columns behind the Present gate and the Darkroom ──
--
-- Without these, every Present toggle and every Darkroom commission
-- returns HTTP 400 PGRST204 ("Could not find the '<col>' column of
-- 'ideas' in the schema cache"), the row is untouched — and because
-- `commissionPrint` carries `name` and `description` in the same
-- statement, a rejected commission also used to discard the
-- participant's text edits (now split by U3, but the columns are still
-- required). With `presenting` unreadable, `teamStageIdeas` used to
-- take its fallback for every team and the ballot silently widened to
-- ideas the room was never shown (now refused by U4's third state, but
-- the refusal stops the vote — the column is what lets it proceed).

-- presenting: NOT NULL DEFAULT FALSE, deliberately. Every read is
-- `!!idea.presenting`, so nullable would also work — but not-null keeps
-- the present gate's fallback meaning "this team CHOSE nothing", never
-- "unknown". The default backfills existing rows (PG11+ fast default;
-- no table rewrite).
alter table ideas add column if not exists presenting boolean not null default false;

-- print_status: only ever written 'developing' then 'developed'. The
-- CHECK below must permit null for every pre-Darkroom row, and null is
-- also the value the U6 recovery path writes back when a stranded
-- develop is abandoned and re-commissioned.
alter table ideas add column if not exists print_status text;

-- print_options: the developed CONTACT SHEET — exactly three URLs
-- today, written as a JS string[]. PostgREST maps a JSON array to
-- text[] cleanly; values are /-prefixed asset paths with no commas or
-- braces, so array-literal quoting is not a hazard. text[] (not jsonb)
-- to match the declared TS type in lib/types.ts.
alter table ideas add column if not exists print_options text[];

-- print_url: the frame the team chose from the sheet. Deliberately set
-- BACK to null on every re-commission (lib/darkroom.ts) — a developed
-- sheet awaiting its choice. The nullability is load-bearing, not
-- incidental.
alter table ideas add column if not exists print_url text;

-- print_source: "name\ndescription" snapshot the sheet was
-- commissioned from; lets the UI mark prints from an earlier draft
-- (isPrintStale splits on the FIRST newline — names are single-line
-- inputs, so this is a note, not a defect).
alter table ideas add column if not exists print_source text;

-- print_note: the optional free-text direction sent with a commission.
-- An empty string must never be stored or the NOTE chip renders empty —
-- darkroom.ts already writes `note?.trim() || null`.
alter table ideas add column if not exists print_note text;

-- The CHECK permits null (pre-Darkroom rows, and the U6 abandon path).
alter table ideas drop constraint if exists ideas_print_status_check;
alter table ideas
  add constraint ideas_print_status_check
  check (print_status is null or print_status in ('developing', 'developed'));

-- INDEXES: none — deliberately. No query in the app filters, orders,
-- or joins on any of the six columns. The present gate is computed
-- client-side over rows already fetched (lib/present-gate.ts), and the
-- print columns are select-list payload only. If the gate ever moves
-- into the query, add:
--   create index idx_ideas_presenting on ideas (category) where presenting;
-- and not before — an index nothing reads is pure write cost on the
-- room's hottest table.


-- ── 2. Sprite-era divergence: the pinned category CHECKs ────────
--
-- The Sprite-era schema pinned category slugs in four CHECK constraints:
--   check (category in ('commercial', 'mass_media', 'live_xp'))
-- The current app treats categories as engagement configuration
-- (lib/config.ts PILLAR_SLUGS — 'category_1'..'category_3' for this
-- engagement), and ../schema.sql already ships these columns
-- unconstrained ("categories configurable per engagement; constraint
-- relaxed"). Where the Sprite schema and the app disagree, the app
-- wins: on a Sprite-era instance every insert with a current slug
-- would raise 23514 on all four tables. On a fresh basecamp instance
-- these drops are no-ops.
--
-- Constraint names are Postgres's defaults for inline column checks
-- (<table>_<column>_check). If a deployment renamed them, these drops
-- silently no-op — README verification step 2 lists any surviving
-- category CHECKs so that cannot pass unnoticed.
alter table ideas           drop constraint if exists ideas_category_check;
alter table votes           drop constraint if exists votes_category_check;
alter table category_briefs drop constraint if exists category_briefs_category_check;
alter table pillar_visions  drop constraint if exists pillar_visions_category_check;

-- NOT dropped, because the app's vocabulary matches them exactly
-- (lib/config.ts, verified 2026-08-04):
--   ideas_status_check  — ('draft','coached','starting_lineup','bench') = IDEA_STATUSES
--   ideas_source_check  — ('team','quick_toss','tissue','ai_scouted')   = IDEA_SOURCES
--   ideas_wave_check    — ('wave_1','wave_2')                            = WAVES
-- An engagement that reconfigures statuses, sources or waves must ship
-- its own constraint migration alongside the config change.

-- `idea_no` is NOT added here. Round 16 ruled the № stays derived, and
-- that ruling stands. The stored-column escape hatch — for an engagement
-- that expects to kill ideas in front of the room, where a derived №
-- shifts every later card — was PLANNED as 2026-08-04-003 and WAS NEVER
-- WRITTEN: no migration file, no `idea_no` in lib/types.ts, no stored
-- branch in lib/idea-number.ts. Do not go looking for it. If an
-- engagement needs it, it is roughly a day (column + backfill + a stored
-- branch in ideaNumbers()); tracked in docs/open-items.md.
