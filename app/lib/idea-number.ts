import type { Idea } from "./types";

// ── THE STABLE № ─────────────────────────────────────────────
// USER RULING 2026-08-03: an idea's number is its IDENTITY, not its
// position. It is assigned at creation within its own team + category
// and never changes again. Coach an idea and the Board re-sorts around
// it; set one aside and the wall closes up — "Touffou 03" is still
// Touffou 03, on the Board, on the Stage, in the returns, and in the
// room's mouth. The Board's masonry may sort however it sorts; the
// number no longer follows the sort.
//
// WHY A DERIVATION AND NOT A COLUMN. `created_at` already records the
// order the room filed in, so the number is a pure function of rows the
// database already holds: bucket by team + category, sort by created_at
// (the id breaks a same-millisecond tie), count from one. No migration,
// no write path, and no way for a stored number to drift from the row it
// labels. The one thing a stored column would buy is permanence across a
// DELETE — kill idea 02 and everything filed after it in that bucket
// steps down one. That cost is recorded rather than hidden: killing an
// idea is rare, deliberate, and already removes the thing the number
// named. If a future engagement needs numbers that survive a kill, add
// `idea_no int` at insert time and read it here — every consumer already
// takes its number from this one function.
//
// CONTRACT FOR CALLERS: pass every idea of the buckets you will look up
// — all statuses, set-aside included, and never a filtered, sorted or
// present-gated slice. A number derived from a subset is a position
// again, which is the bug this replaces.
export function ideaNumbers(ideas: Idea[]): Map<string, number> {
  const buckets = new Map<string, Idea[]>();
  for (const idea of ideas) {
    const key = `${idea.team_id ?? "—"}::${idea.category}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(idea);
    else buckets.set(key, [idea]);
  }

  const numbers = new Map<string, number>();
  for (const bucket of buckets.values()) {
    bucket
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .forEach((idea, i) => numbers.set(idea.id, i + 1));
  }
  return numbers;
}

/** The number as every surface prints it: two digits, always. */
export function ideaNo(n: number | null | undefined): string | null {
  return n == null ? null : String(n).padStart(2, "0");
}

/**
 * QUALIFICATION. Three teams each own a №01, so any surface that shows
 * more than one team names the team beside the number — `TOUFFOU 03`,
 * which is how a room already talks ("Touffou's number three"). A
 * single-team surface (the Board, the Stage's active-team wall) stays
 * bare: `№ 03`. Pass `teamTag` only where teams actually sit together.
 */
export function qualifiedIdeaNo(n: number | null | undefined, teamTag?: string | null): string | null {
  const no = ideaNo(n);
  if (!no) return null;
  return teamTag ? `${teamTag} ${no}` : no;
}

/**
 * The unnamed-idea fallback follows the SAME stable identity: idea 04 is
 * "Idea D" wherever it appears and whatever the wall is sorted by. (It
 * used to count off the rendered grid, so coaching a neighbour renamed
 * an untitled idea under the room.)
 */
export function unnamedIdeaLabel(n: number | null | undefined): string {
  const i = Math.max(0, (n ?? 1) - 1);
  const letters =
    i < 26
      ? String.fromCharCode(65 + i)
      : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
  return `Idea ${letters}`;
}
