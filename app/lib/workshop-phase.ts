// ============================================================
// Workshop State Machine
// ============================================================
// Single JSON blob stored in workshop_settings as 'workshop_state'.
// One row, one Realtime event — no race conditions.
// ============================================================

import { type PillarSlug, isPillarSlug, type GroupSlug } from './config';

export const VIEWS = ['pillar', 'lineup', 'full_lineup'] as const;
export type WorkshopView = (typeof VIEWS)[number];

/**
 * Complete workshop state — stored as a single JSON blob.
 * pillar + view control what Center Court shows.
 * voting_open + show_counts are decoupled toggles within pillar view.
 */
export type WorkshopState = {
  readonly pillar: PillarSlug | null;
  readonly team: string | null;          // team slug (e.g. 'group-1') — additive context alongside pillar
  readonly view: WorkshopView | null;
  readonly voting_open: boolean;
  readonly show_counts: boolean;
};

const VIEW_SET = new Set<string>(VIEWS);

const IDLE_STATE: WorkshopState = {
  pillar: null,
  team: null,
  view: null,
  voting_open: false,
  show_counts: false,
};

function safeJsonParse(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Parse workshop state from a workshop_settings value (TEXT column).
 * Returns idle state for invalid input — never returns null.
 */
export function parseWorkshopState(raw: unknown): WorkshopState {
  if (raw === null || raw === undefined) return IDLE_STATE;

  const parsed = typeof raw === 'string' ? safeJsonParse(raw) : raw;
  if (typeof parsed !== 'object' || parsed === null) return IDLE_STATE;

  const obj = parsed as Record<string, unknown>;

  // Idle state
  if (obj.pillar === null || obj.view === null) {
    return IDLE_STATE;
  }

  // Active state — pillar + view required; team is optional additive context
  if (
    typeof obj.pillar === 'string' &&
    isPillarSlug(obj.pillar) &&
    typeof obj.view === 'string' &&
    VIEW_SET.has(obj.view)
  ) {
    return {
      pillar: obj.pillar,
      team: typeof obj.team === 'string' ? obj.team : null,
      view: obj.view as WorkshopView,
      voting_open: obj.voting_open === true,
      show_counts: obj.show_counts === true,
    };
  }

  return IDLE_STATE;
}

/**
 * Serialize workshop state for storage.
 */
export function serializeWorkshopState(state: WorkshopState): string {
  return JSON.stringify(state);
}

/**
 * Check if state is active (has a pillar + view set).
 */
export function isActiveState(state: WorkshopState): boolean {
  return state.pillar !== null && state.view !== null;
}

/**
 * Get idle state constant.
 */
export function getIdleState(): WorkshopState {
  return IDLE_STATE;
}

/**
 * Get a display label for the current state.
 */
export function getStateLabel(state: WorkshopState): string {
  if (!isActiveState(state)) return 'Ready';
  if (state.voting_open) return 'Voting Open';
  if (state.show_counts) return 'Results';
  switch (state.view) {
    case 'pillar': return 'Presenting';
    case 'lineup': return 'Shortlist';
    case 'full_lineup': return 'Full Shortlist';
    default: return 'Ready';
  }
}

// ── Backwards compatibility ──
// These keep existing code working during migration.
// TODO: Remove after all consumers are updated.

export type PillarMode = 'present' | 'vote';
export type WorkshopPhase = WorkshopState;

export function parseWorkshopPhase(raw: unknown): WorkshopState | null {
  const state = parseWorkshopState(raw);
  return isActiveState(state) ? state : null;
}

export function isActivePhase(state: WorkshopState | null): boolean {
  return state !== null && isActiveState(state);
}
