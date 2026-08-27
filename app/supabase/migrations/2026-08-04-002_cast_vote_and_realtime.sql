-- ============================================================
-- 2026-08-04-002 — cast_vote under concurrency + realtime DELETE
-- ============================================================
-- U1 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
-- Analysis: docs/backend-audit.md §5.1 (the lock), §3.3 (replica
-- identity), defect #16 (the limit parse).
--
-- THIS FILE HAS NEVER BEEN EXECUTED AGAINST A DATABASE. See
-- ../README.md for the apply order and the verification procedure —
-- step 7 (the parallel-vote probe) is the only real test of the lock,
-- and it cannot be run in this repository.
--
-- APPLIES TO BOTH PATHS (fresh after 001; Sprite-era delta — the
-- Sprite instance carries the same broken cast_vote body, and
-- `create or replace` swaps it in place).
--
-- IDEMPOTENT: yes. `create or replace function`; `replica identity`
-- and the grants are absolute settings, not accumulating ones.
-- ============================================================


-- ── 1. cast_vote — the vote limit must HOLD under concurrency ───
--
-- THE DEFECT (audit §5.1): the previous body's
--   perform from votes where voter_id = ... for update;
-- locks rows that EXIST. A voter casting their first votes has no
-- rows, so two concurrent calls lock nothing, both read count = 0,
-- and both insert — the limit is exceeded by the number of concurrent
-- requests. The failure needs two devices sharing a voter_id or a
-- retried request, which is exactly what a live room produces.
--
-- THE FIX: a transaction-scoped advisory lock keyed on
-- (voter_id, category), taken as the function's FIRST statement. It
-- exists independent of any rows, so a voter's first ballot serializes
-- exactly like their fourth. Released automatically at commit/rollback.
--
-- Three properties of the key, on the record:
--   · ':' separates the operands so ('ab','c') and ('a','bc') cannot
--     alias into one key. An alias would only OVER-serialize (two
--     voters taking turns) — never under — but it is free to avoid.
--   · hashtext() maps to int4, so distinct voters CAN collide. A
--     collision also only over-serializes; at workshop scale (~69
--     voters) the cost is unmeasurable and correctness is unaffected.
--   · The lock is per (voter, category): two different voters, or one
--     voter in two categories, never wait on each other.
--
-- ALSO CHANGED — the limit parse (audit #16): the old
-- `nullif(value,'')::int` raised 22P02 on any non-numeric character in
-- the admin's free-text max-votes field, which broke EVERY vote in the
-- room. Now: strip non-digits, cap at 4 digits (overflow guard), fall
-- back to 3 when nothing numeric survives. Semantics change, stated
-- plainly: ' 4' and '4 votes' now read as 4; 'four' now reads as the
-- default 3 instead of an error. '0' is respected (a room with voting
-- closed by configuration).
--
-- SECURITY DEFINER, deliberately: policies.sql denies `anon` direct
-- INSERT on votes — the ballot's only write path is this RPC, so the
-- limit cannot be bypassed by a hand-rolled insert with the room's
-- anon key. The function must therefore carry the table owner's
-- rights. Standard definer hygiene applies: search_path is pinned, and
-- EXECUTE is granted explicitly below. (The owner — the role running
-- this migration — bypasses RLS on votes as table owner; do not set
-- FORCE ROW LEVEL SECURITY on votes.)
--
-- SIGNATURE AND RETURN CONTRACT: unchanged. Same three arguments the
-- app already sends (app/vote/page.tsx, app/[team]/quick-add/page.tsx,
-- /api/votes); still returns boolean; still returns false at the
-- limit.
--
-- KNOWN BEHAVIOUR, KEPT: the inverted idempotency. `on conflict do
-- nothing` leaves FOUND false, so an already-cast vote returns FALSE —
-- and both ballots treat false as rejection, so a double-submit
-- removes the checkmark for a vote that exists (/vote self-heals on
-- reload; quick-add reconciles on un-vote). Changing it touches both
-- ballots and /api/votes' 409, which is a product ruling this pass was
-- not asked to make. The fix, written out for the pass that is:
--
--   insert into votes (idea_id, category, voter_id)
--   values (p_idea_id, p_category, p_voter_id)
--   on conflict (idea_id, voter_id) do nothing;
--   if found then return true; end if;
--   -- the conflict row is this voter's own standing vote:
--   return exists (
--     select 1 from votes
--      where idea_id = p_idea_id and voter_id = p_voter_id
--   );

create or replace function cast_vote(p_idea_id uuid, p_category text, p_voter_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
  vote_limit int;
begin
  -- FIRST statement: serialize this voter's inserts in this category.
  perform pg_advisory_xact_lock(hashtext(p_voter_id || ':' || p_category));

  -- Hardened read of the configurable limit (see header).
  select left(nullif(regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g'), ''), 4)::int
    into vote_limit
    from workshop_settings
   where key = 'max_votes_per_pillar';
  if vote_limit is null then vote_limit := 3; end if;

  select count(*) into current_count
    from votes
   where voter_id = p_voter_id and category = p_category;
  if current_count >= vote_limit then
    return false;
  end if;

  insert into votes (idea_id, category, voter_id)
  values (p_idea_id, p_category, p_voter_id)
  on conflict (idea_id, voter_id) do nothing;
  return found;
end;
$$;

-- Definer hygiene: no ambient EXECUTE. The room's clients (anon) and
-- the API's admin client (service_role) call it; nothing else does.
revoke execute on function cast_vote(uuid, text, text) from public;
grant execute on function cast_vote(uuid, text, text) to anon, authenticated, service_role;

-- merge_ideas is deliberately NOT touched here. It runs as invoker and
-- stays within verbs policies.sql opens to anon (ideas insert/update),
-- so it works under either key. Its non-idempotency — two facilitators
-- pressing Combine produce two merged ideas (audit #11) — is a known,
-- deferred defect, not an oversight.


-- ── 2. Realtime DELETE must reach the Board ─────────────────────
--
-- THE DEFECT (audit §3.3): the Board subscribes to ideas with
-- `filter: team_id=eq.<uuid>`. The filter is evaluated against the
-- replicated record, and under Postgres's default REPLICA IDENTITY a
-- DELETE carries only the primary key — team_id is absent, the filter
-- can never match, and a killed idea stays on the team wall until an
-- unrelated event or a reload.
--
-- With REPLICA IDENTITY FULL the old row ships whole, the filter
-- matches, and the Board's existing refetch-on-event handles the rest
-- (no handler reads payload.new — audit §3.2 — so this is additive).
--
-- COST, stated: full old-row images in WAL for every UPDATE and DELETE
-- on ideas — the autosave-heavy table. At workshop scale (~150 rows,
-- ~70 clients, 700ms-debounced saves) this is noise. The alternative
-- (drop the Board's filter and let its own-team refetch absorb every
-- event) was considered by the audit; the plan chose the identity fix
-- because it keeps the subscription's meaning intact.
alter table ideas replica identity full;

-- Only ideas needs this. Every other subscribed channel (votes, ticker,
-- workshop_settings) is unfiltered, and every handler ignores the
-- payload and refetches — a PK-only DELETE image is sufficient there.

-- No publication changes: both lineages and ../schema.sql already add
-- ideas, votes, pillar_visions, ticker_messages and workshop_settings
-- to supabase_realtime. Verify membership with README step 8.
