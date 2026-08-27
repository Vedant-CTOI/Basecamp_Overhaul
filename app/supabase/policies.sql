-- ============================================================
-- Row-level security — every table, every verb, decided
-- ============================================================
-- U1 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
-- The decision: docs/backend-audit.md §6.3. The posture below was
-- derived by reading every `supabase.from(...)` call site in the app
-- (2026-08-04) — each anon permission maps to a named surface, not to
-- a guess.
--
-- THIS FILE HAS NEVER BEEN EXECUTED AGAINST A DATABASE. See README.md.
-- Apply AFTER the migrations; verify with README steps 4–6 BEFORE the
-- room arrives — RLS enabled with a policy missing renders a blank,
-- error-free workshop (audit §6.3), which is why every table below
-- carries an explicit per-verb ruling and silence is not permitted.
--
-- IDEMPOTENT: yes — `drop policy if exists` before every create.
--
-- ROLES (Supabase's model, identical on supabase.com and self-hosted):
--   anon          — the key in every phone's JS bundle. "Someone in
--                   the room." This whole file assumes a DEDICATED
--                   project per engagement; on a shared project this
--                   posture is wrong (plan, Genuinely Uncertain #1).
--   authenticated — UNUSED. The app never signs anyone in. No policies
--                   are written for it, so under RLS it can do nothing.
--   service_role  — holds BYPASSRLS in Supabase's role model (cloud
--                   and self-host), so it is unaffected by everything
--                   in this file. "service_role: everything" below is
--                   that fact, not a policy.
--
-- ============================================================
-- THE POSTURE (anon), one line per table:
--
--   table                   select  insert  update   delete
--   teams                   yes     -       -        -
--   ideas                   yes     yes     columns  yes
--   votes                   yes     RPC     -        yes
--   training_notes          yes     yes     -        yes
--   coach_prompt_overrides  yes     -       -        -
--   ticker_messages         yes     narrow  -        -
--   workshop_settings       yes     -       -        -
--   category_briefs         yes     -       -        -
--   pillar_visions          yes     -       -        -
--
-- ============================================================
-- ACCEPTED EXPOSURES — deliberate, not oversights. There is no
-- server-side participant identity (voter_id is client-minted in
-- localStorage), so nothing below can tell one phone from another:
--
--   1. anon can UPDATE any ideas row's content columns. Closing this
--      breaks the Board's autosave, the Present toggle, the Darkroom,
--      the coach's mark and the Stage's operator moves — all of which
--      write direct from the browser. It IS narrowed: the column grant
--      below withholds id, created_at (a rewrite would silently
--      renumber the team's wall — the stable № derives from it),
--      source (a rewrite would forge the Newsroom's scouted counts)
--      and gifted_from_team_id. Residual: any phone can rewrite or
--      re-stage any idea's text and state. A room of colleagues, per
--      the plan's ruling — and it is on the record here.
--   2. anon can DELETE any idea, its votes and its notes. The kill
--      path lives on the open card (participant surface) and issues
--      three direct deletes with the anon key. Denying it breaks a
--      participant flow, so it stays open — the plan's "all deletes to
--      the service role" is deliberately overruled for these three
--      tables, and this line is the record of that ruling.
--   3. anon can DELETE any voter's votes (un-vote is a direct client
--      delete, and voter_id cannot be verified). Vote INSERTS go
--      through cast_vote alone; vote deletes cannot.
--   4. Every vote — including voter_id — is readable by the room, and
--      the coach system-prompt overrides are readable by the room
--      (/api/coach reads them with the anon key).
--
-- ============================================================
-- WHAT THIS FILE REQUIRES FROM THE APP — REWIRED 2026-08-04.
-- There is NO policy that can admit the admin's browser and refuse
-- the room's phones: they present the same anon JWT. The app was
-- therefore rewired so that no admin-gated mutation reaches Postgres
-- on the anon key:
--
--   · Every session-gated route that writes a restricted table —
--     PUT /api/settings, /api/settings/briefs,
--     /api/settings/coach-prompts; POST/PATCH/DELETE /api/ticker;
--     POST /api/breaking-news; POST /api/report (its
--     workshop_settings storage); POST/GET /api/phase; POST
--     /api/merge; PATCH /api/teams/<slug> — now writes through
--     `app/lib/supabase-server.ts`, which holds
--     SUPABASE_SERVICE_ROLE_KEY. THE KEY IS REQUIRED once this file
--     is applied: unset, those routes fall back to the shared anon
--     client and their restricted writes FAIL — loudly, through
--     lib/db.ts, which is the correct signal that the env var is
--     missing. The key never reaches the browser (the module throws
--     in a browser context, and scripts/check-write-errors.mjs fails
--     the build on any client-side import).
--   · The admin console (app/app/admin/page.tsx) no longer writes
--     restricted tables from the browser on a live deployment: its
--     settings/briefs/coach-prompt/ticker/teams/phase mutations go
--     through the session-gated routes above. Its direct store writes
--     survive ONLY in showcase mode, where there is no Postgres and
--     the in-memory shim is the store.
--
-- Participant surfaces need none of this — every room-facing flow
-- (capture, autosave, present, darkroom, coach, ballot, un-vote,
-- kill, arrival line) works under this file with the anon key alone.
-- ============================================================


-- ── teams ───────────────────────────────────────────────────────
-- select: anon — every surface resolves teams (entry ring, Board,
--         Stage, Newsroom, /api/coach's platform lookup).
-- insert/update/delete: service role only. No participant surface
--         writes teams; the admin console's direct edits are in the
--         breaks-list above.
alter table teams enable row level security;

drop policy if exists teams_select_anon on teams;
create policy teams_select_anon on teams
  for select to anon using (true);


-- ── ideas ───────────────────────────────────────────────────────
-- select: anon — the wall, the Stage, the Newsroom, both ballots.
-- insert: anon — quick-add, AddIdeaModal, the Stage's inline add, and
--         the Board's scout acceptances (source 'ai_scouted') all
--         insert from the browser.
-- update: anon, COLUMN-NARROWED by the grant below — autosave (name,
--         description, framework fields, updated_at), the pillar move
--         (category), the Present toggle (presenting), the Darkroom
--         (all five print columns), the coach's mark and the Stage's
--         moves (status, wave, team_id, link_group).
-- delete: anon — the kill path on the open card. Accepted exposure #2.
alter table ideas enable row level security;

drop policy if exists ideas_select_anon on ideas;
create policy ideas_select_anon on ideas
  for select to anon using (true);

drop policy if exists ideas_insert_anon on ideas;
create policy ideas_insert_anon on ideas
  for insert to anon with check (true);

drop policy if exists ideas_update_anon on ideas;
create policy ideas_update_anon on ideas
  for update to anon using (true) with check (true);

drop policy if exists ideas_delete_anon on ideas;
create policy ideas_delete_anon on ideas
  for delete to anon using (true);

-- The narrowing (accepted exposure #1): RLS gates rows, grants gate
-- columns. Withheld from anon UPDATE: id, created_at, source,
-- gifted_from_team_id. Every column a room surface actually writes is
-- granted. New columns (e.g. an applied 003/idea_no) are NOT covered
-- until added here — deliberate, no room surface may write them.
revoke update on table ideas from anon, authenticated;
grant update (
  name, description, category, status, wave,
  bbei_connection, key_partners, team_id, link_group, updated_at,
  presenting, print_status, print_options, print_url, print_source, print_note
) on table ideas to anon;


-- ── votes ───────────────────────────────────────────────────────
-- select: anon — the Stage's returns and both ballots' own-vote reads.
--         Accepted exposure #4.
-- insert: NO anon policy, deliberately. The only write path is the
--         cast_vote RPC (SECURITY DEFINER, migration 002), so the vote
--         limit cannot be bypassed by a hand-rolled insert with the
--         room's key. A direct anon insert must FAIL — README step 6
--         proves it.
-- update: nothing updates votes. Denied.
-- delete: anon — un-vote is a direct client delete from both ballots,
--         and /api/ideas/[id]'s cascade also runs on the shared
--         client. Accepted exposure #3.
alter table votes enable row level security;

drop policy if exists votes_select_anon on votes;
create policy votes_select_anon on votes
  for select to anon using (true);

drop policy if exists votes_delete_anon on votes;
create policy votes_delete_anon on votes
  for delete to anon using (true);


-- ── training_notes ──────────────────────────────────────────────
-- select: anon — the Board's coaching record, the Newsroom's count.
-- insert: anon — the training room and the coach takeover both insert
--         from the browser (and /api/training-notes runs on the shared
--         client).
-- update: nothing updates notes. Denied.
-- delete: anon — the kill path clears an idea's notes before the row
--         (training_notes.idea_id carries no cascade; the order is
--         load-bearing). Accepted exposure #2.
alter table training_notes enable row level security;

drop policy if exists training_notes_select_anon on training_notes;
create policy training_notes_select_anon on training_notes
  for select to anon using (true);

drop policy if exists training_notes_insert_anon on training_notes;
create policy training_notes_insert_anon on training_notes
  for insert to anon with check (true);

drop policy if exists training_notes_delete_anon on training_notes;
create policy training_notes_delete_anon on training_notes
  for delete to anon using (true);


-- ── coach_prompt_overrides ──────────────────────────────────────
-- select: anon — /api/coach reads overrides on the shared client.
--         Accepted exposure #4 (the room can read the system prompts).
-- insert/update/delete: service role only (admin console edits are in
--         the breaks-list).
alter table coach_prompt_overrides enable row level security;

drop policy if exists coach_prompt_overrides_select_anon on coach_prompt_overrides;
create policy coach_prompt_overrides_select_anon on coach_prompt_overrides
  for select to anon using (true);


-- ── ticker_messages ─────────────────────────────────────────────
-- select: anon — the wire runs on every surface.
-- insert: anon, NARROWED to style 'standard' — the entry page writes
--         an arrival line from the browser ("<TEAM> — enters the
--         board.", style 'standard'). The check stops a phone forging
--         a BREAKING takeover of the room's wire; 'breaking' rows are
--         the admin routes' business (breaks-list until they hold the
--         service role).
-- update: nothing updates ticker rows. Denied.
-- delete: service role only — retiring wire copy is an admin move
--         (breaks-list: the console's direct delete and
--         DELETE /api/ticker).
alter table ticker_messages enable row level security;

drop policy if exists ticker_messages_select_anon on ticker_messages;
create policy ticker_messages_select_anon on ticker_messages
  for select to anon using (true);

drop policy if exists ticker_messages_insert_anon on ticker_messages;
create policy ticker_messages_insert_anon on ticker_messages
  for insert to anon with check (style = 'standard');


-- ── workshop_settings ───────────────────────────────────────────
-- select: anon — room code at the door, workshop_state on every
--         surface, voting_enabled and max_votes_per_pillar on the
--         ballots. Realtime subscriptions read through this policy.
-- insert/update/delete: service role only. THIS IS THE HEADLINE LOCK:
--         workshop_state is the room's screen, and with this file
--         applied the anon key in 69 phones cannot rewrite it
--         (audit §6.4's hijack). The Stage's live phase changes
--         already go through /api/phase — which must hold a REAL
--         service key, because its anon fallback now fails. The admin
--         console's direct settings writes are in the breaks-list.
alter table workshop_settings enable row level security;

drop policy if exists workshop_settings_select_anon on workshop_settings;
create policy workshop_settings_select_anon on workshop_settings
  for select to anon using (true);


-- ── category_briefs ─────────────────────────────────────────────
-- select: anon — the training room reads the pillar brief.
-- insert/update/delete: service role only (breaks-list).
alter table category_briefs enable row level security;

drop policy if exists category_briefs_select_anon on category_briefs;
create policy category_briefs_select_anon on category_briefs
  for select to anon using (true);


-- ── pillar_visions ──────────────────────────────────────────────
-- select: anon — nothing reads this table today (audit #19: seeded,
--         published, read by nothing), but the plan's posture is
--         select-open everywhere and an open read of a dead table
--         costs nothing.
-- insert/update/delete: service role only.
alter table pillar_visions enable row level security;

drop policy if exists pillar_visions_select_anon on pillar_visions;
create policy pillar_visions_select_anon on pillar_visions
  for select to anon using (true);
