import type { PillarSlug, IdeaStatus, IdeaSource, CoachType, Wave } from './config';

export type { PillarSlug, IdeaStatus, IdeaSource, CoachType, Wave };

// Re-export Category as an alias for PillarSlug (used interchangeably in the codebase)
export type Category = PillarSlug;

export interface Team {
  id: string;
  name: string;
  slug: string;
  display_name: string | null;
  color: string;
  assigned_pillars: PillarSlug[];
  facilitator_notes: string | null;
  creative_platform_name: string | null;
  creative_platform_brief: string | null;
  created_at: string;
}

export interface Idea {
  id: string;
  team_id: string | null;       // null for tissue ideas
  category: PillarSlug;
  name: string;
  description: string | null;
  status: IdeaStatus;
  wave: Wave | null;
  bbei_connection: string | null;
  key_partners: string | null;
  source: IdeaSource;
  link_group: string | null;
  gifted_from_team_id: string | null;
  // ── SCHEMA ADDITION (dev team) ─────────────────────────────
  // Five new columns on `ideas` behind the Present gate + Darkroom:
  //   presenting   boolean not null default false  — team chose to bring
  //                this idea to the Stage
  //   print_status text null check (print_status in ('developing','developed'))
  //   print_options text[] null — the developed CONTACT SHEET: the three
  //                candidate frames one commission returns. The sheet is
  //                KEPT after a frame is chosen, so the team can
  //                re-choose on taste without a re-commission.
  //   print_url    text null — the frame the team chose from the sheet
  //                (the idea's visual header). Null while a developed
  //                sheet awaits its choice.
  //   print_source text null — snapshot of the name+description the sheet
  //                was commissioned from ("name\ndescription"); lets the
  //                UI mark prints from an earlier draft (lib/darkroom
  //                isPrintStale)
  //   print_note   text null — THE NOTE TO THE DARKROOM: the optional
  //                free-text direction the team sent along with this
  //                commission ("Warmer. Put people in it."). Written at
  //                commission time, cleared when a commission carries no
  //                note, and kept afterwards as the print's provenance.
  //                A real implementation appends it to the engagement's
  //                art-direction prompt (lib/darkroom commissionPrint).
  // Dev note: the real implementation generates the three frames IN
  // PARALLEL — same wall-clock latency as one render.
  // The showcase's in-memory shim tolerates the new keys; a real
  // deployment needs the migration. Optional here so existing local
  // constructors stay valid.
  presenting?: boolean;
  print_status?: 'developing' | 'developed' | null;
  print_options?: string[] | null;
  print_url?: string | null;
  print_source?: string | null;
  print_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  idea_id: string;
  category: PillarSlug;
  voter_id: string;
  created_at: string;
}

export interface TrainingNote {
  id: string;
  idea_id: string;
  coach_type: CoachType;
  team_slug: string | null;
  user_prompt: string | null;
  ai_response: string;
  is_saved: boolean;
  created_at: string;
}

export interface CategoryBrief {
  category: PillarSlug;
  brief_context: string | null;
  updated_at: string;
}

export interface Coach {
  type: CoachType;
  name: string;
  emoji: string;
  title: string;
  description: string;
  shortDescription: string;
  avatar: string;
  color: string;
  systemPrompt: string;
}

export interface ScoreboardTeamStats {
  team: Team;
  totalIdeas: number;
  coachedIdeas: number;
  startingLineupIdeas: number;
  byPillar: Partial<Record<PillarSlug, number>>;
}

// Workshop settings keys. `partnership_guardrails` is canonical;
// `nba_rights` is the pre-rename alias readers still accept (D-11).
export type WorkshopSettingKey = 'room_code' | 'insights' | 'partnership_guardrails' | 'nba_rights' | 'workshop_phase' | 'workshop_state' | 'total_participants';
