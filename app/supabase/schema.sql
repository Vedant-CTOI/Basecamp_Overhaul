-- ============================================================
-- Basecamp Workshop Platform — Database Schema
-- ============================================================

-- Teams (generic groups)
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_name text,
  color text not null,
  assigned_pillars text[] not null default '{}',
  facilitator_notes text,
  creative_platform_name text,
  creative_platform_brief text,
  created_at timestamptz default now()
);

-- Ideas (3 pillars, new statuses, nullable team_id for tissue)
create table ideas (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id),
  category text not null,  -- categories configurable per engagement; constraint relaxed
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'coached', 'starting_lineup', 'bench')),
  wave text check (wave in ('wave_1', 'wave_2')),
  bbei_connection text,
  key_partners text,
  source text not null default 'team' check (source in ('team', 'quick_toss', 'tissue', 'ai_scouted')),
  link_group text,
  gifted_from_team_id uuid references teams(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Votes (cross-pillar, whole-room)
create table votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  category text not null,  -- categories configurable per engagement; constraint relaxed
  voter_id text not null,
  created_at timestamptz default now(),
  unique(idea_id, voter_id)
);

-- Training notes (AI coaching conversations)
create table training_notes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references ideas(id),
  coach_type text not null,
  team_slug text,
  user_prompt text,
  ai_response text not null,
  is_saved boolean default false,
  created_at timestamptz default now()
);

-- Coach prompt overrides (admin can edit system prompts live)
create table coach_prompt_overrides (
  coach_type text primary key,
  system_prompt text not null,
  updated_at timestamptz default now()
);

-- Ticker messages (live broadcast + breaking news)
create table ticker_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  style text not null default 'standard' check (style in ('standard', 'breaking')),
  reporter text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Workshop settings (key-value store)
create table workshop_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Category briefs (per-pillar strategic briefs for coach routing)
create table category_briefs (
  category text primary key,  -- categories configurable per engagement; constraint relaxed
  brief_context text,
  fan_context text,
  updated_at timestamptz default now()
);

-- Pillar visions (post-voting synthesis per pillar)
create table pillar_visions (
  category text primary key,  -- categories configurable per engagement; constraint relaxed
  vision_text text,
  ai_draft text,
  updated_at timestamptz default now()
);

-- ============================================================
-- Indexes (prevent full table scans under concurrent load)
-- ============================================================

create index idx_ideas_team_id on ideas(team_id);
create index idx_ideas_category on ideas(category);
create index idx_ideas_category_status on ideas(category, status);
create index idx_votes_voter_category on votes(voter_id, category);
create index idx_votes_idea_id on votes(idea_id);
create index idx_training_notes_idea_id on training_notes(idea_id);
create index idx_ticker_active on ticker_messages(is_active, created_at desc);

-- ============================================================
-- Database Functions
-- ============================================================

-- Atomic vote function with limit enforcement + row-level locking
-- Reads max_votes_per_pillar from workshop_settings (default 3)
create or replace function cast_vote(p_idea_id uuid, p_category text, p_voter_id text)
returns boolean as $$
declare
  current_count int;
  vote_limit int;
begin
  -- Read configurable vote limit from settings
  select coalesce(nullif(value, '')::int, 3) into vote_limit
  from workshop_settings where key = 'max_votes_per_pillar';
  if vote_limit is null then vote_limit := 3; end if;

  -- Lock existing votes for this voter+category to prevent concurrent inserts
  perform from votes
  where voter_id = p_voter_id and category = p_category
  for update;

  select count(*) into current_count from votes
  where voter_id = p_voter_id and category = p_category;
  if current_count >= vote_limit then return false; end if;

  insert into votes (idea_id, category, voter_id)
  values (p_idea_id, p_category, p_voter_id)
  on conflict (idea_id, voter_id) do nothing;
  return found;
end;
$$ language plpgsql;

-- Atomic merge: bench originals, create combined idea
create or replace function merge_ideas(
  p_original_ids uuid[],
  p_new_name text,
  p_new_description text,
  p_category text,
  p_team_id uuid
)
returns uuid as $$
declare new_id uuid;
begin
  -- Bench all originals
  update ideas set status = 'bench', updated_at = now()
  where id = any(p_original_ids);

  -- Create combined idea
  insert into ideas (category, name, description, team_id, source, status)
  values (p_category, p_new_name, p_new_description, p_team_id, 'team', 'draft')
  returning id into new_id;

  return new_id;
end;
$$ language plpgsql;

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table ideas;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table pillar_visions;
alter publication supabase_realtime add table ticker_messages;
alter publication supabase_realtime add table workshop_settings;

-- ============================================================
-- Seed Data
-- ============================================================

-- Placeholder seed data. Replace per engagement (team names + colors,
-- category slugs + briefs, partnership guardrails, etc.).

-- TEAMS: these rows MIRROR `GROUPS` in app/lib/config.ts — config is
-- the single source of team identity (D-7). A fresh deploy seeded from
-- this file must show the same names and colors the config-driven
-- surfaces (medallions, ticker chips, Board band) already show.
-- `scripts/build-schema-manifest.mjs` fails the build when these values
-- and GROUPS disagree, so edit the config first and copy the values here.
-- Precedence rule, decided once: where a surface reads teams from the
-- DB, the DB row's display_name/color win when present; GROUPS is what
-- the DB is seeded FROM and what config-driven surfaces read directly.

insert into teams (name, slug, display_name, color, assigned_pillars) values
  ('Realness', 'group-1', 'Realness', '#2438D6', array['category_1', 'category_2', 'category_3']),
  ('Confidence', 'group-2', 'Confidence', '#B78938', array['category_1', 'category_2', 'category_3']),
  ('Skinfirst', 'group-3', 'Skinfirst', '#7A5C3E', array['category_1', 'category_2', 'category_3']);

insert into category_briefs (category) values
  ('category_1'), ('category_2'), ('category_3');

insert into pillar_visions (category) values
  ('category_1'), ('category_2'), ('category_3');

insert into workshop_settings (key, value) values
  ('room_code', ''),
  ('insights', ''),
  ('partnership_guardrails', ''),  -- the partnership/IP guardrails string injected into the guardrails coach. Readers also alias the pre-rename `nba_rights` key for old DBs (D-11).
  ('workshop_state', '{"pillar":null,"team":null,"view":null,"voting_open":false,"show_counts":false}'),
  ('total_participants', '20'),
  ('max_votes_per_pillar', '3'),
  ('enabled_idea_fields', '["bbei_connection","key_partners"]'),
  ('voting_enabled', 'false');
