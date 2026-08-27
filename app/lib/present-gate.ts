import type { Idea } from "./types";

// ── THE PRESENT GATE ─────────────────────────────────────────
// What the room actually saw. A team brings ideas to the Stage by
// flagging them `presenting`, and the Stage's wall shows those and only
// those. A team that flagged NOTHING has not opted out — it simply has
// not chosen yet — so its whole active board stands in, and the wall
// says so (`showingAllFallback`). Set-aside ideas are out either way.
//
// USER RULING 2026-08-03: THE BALLOT VOTES ON WHAT THE ROOM SAW. The
// ballot and the returns now run through this same gate, so the phone
// cannot offer an idea the Stage never presented and the returns cannot
// rank one at zero votes. Nothing a team selected is removed, and the
// fallback stands: a team that marked nothing still puts its whole
// board on the ballot.
//
// The rule lives HERE, in one function, precisely because it is read by
// four call sites — the Stage wall, the Stage's prev/next walk, the
// phone ballot and the returns. Three copies of it is how they drifted
// apart in the first place.
//
// ── THE THIRD STATE (U4, R8) ─────────────────────────────────
// "This team chose nothing" and "this deployment cannot read the
// field" are different facts, and they used to produce identical
// behaviour — the fallback — which is the dangerous one: a schema
// problem silently widened the ballot to ideas the room never saw,
// the exact failure Round 16's corollary exists to prevent ("a surface
// that collects a decision may never offer a wider set than the
// surface that presented it").
//
// DETECTION — a contract violation, not a heuristic. The schema
// declares `presenting boolean NOT NULL DEFAULT false`. Under that
// contract NO readable row can lack the field: a store that carries
// the column materialises `false` on every row it returns, whatever
// the team did or didn't choose. So:
//
//   · `presenting === false` on a row  → the team chose nothing FOR
//     THAT ROW. Readable. The fallback is legitimate.
//   · `presenting` absent / not a boolean on EVERY active row of a
//     bucket → the store did not materialise the field at all. That is
//     the signature of a missing column (PostgREST strips an absent
//     column from every row uniformly, never from some rows) or of a
//     malformed backing store. Unreadable.
//   · A MIX inside one bucket is not the missing-column signature — a
//     missing column is missing everywhere — so a partially-present
//     bucket stays readable and rows without the field count as
//     unselected, which can only ever NARROW the set, never widen it.
//
// The contract has one obligation on the other side: every store that
// serves this app must materialise the default on insert. Postgres
// does it via the column default; the showcase shim does it in its
// insert path (lib/supabase.ts, COLUMN_DEFAULTS); any future backing
// store (a document store has no column defaults) must do the same in
// its adapter, or a team's fresh, untouched ideas would read as an
// unreadable deployment.
//
// What the three consumers do with `unreadable` differs, deliberately:
//   · The STAGE keeps its wall (the active board — a room mid-session
//     must not lose its screen over a schema fault) and the header
//     says the selections could not be read instead of "showing all".
//   · The BALLOT — /vote and quick-add's — REFUSES to open, and says
//     why. Refusing stops the vote; widening corrupts it.
//   · The RETURNS refuse the same way, for the same reason.
// This does not make the ballot work without the schema fix. It makes
// the failure visible instead of silent, which is the whole point.

/** Is the field itself readable on this row? The schema's contract is
    a NOT NULL boolean, so anything else is the store failing to carry
    the column — `undefined` from a stripped select, or a malformed
    value from a store with no column types. */
function fieldReadable(idea: Idea): boolean {
  return typeof idea.presenting === "boolean";
}

export type TeamStageResult = {
  ideas: Idea[];
  showingAllFallback: boolean;
  /** True when no active row in this bucket carries a readable
      `presenting` at all — the missing-column signature. Mutually
      exclusive with `showingAllFallback`. */
  unreadable: boolean;
};

/** The gate applied to ONE team's ideas within ONE category. */
export function teamStageIdeas(teamIdeas: Idea[]): TeamStageResult {
  const active = teamIdeas.filter((i) => i.status !== "bench");
  const unreadable = active.length > 0 && !active.some(fieldReadable);
  if (unreadable) {
    // The Stage keeps a wall; the surfaces that collect decisions read
    // the flag and refuse. NOT the fallback: the fallback is a team's
    // legitimate "everything", this is a store's "I don't know".
    return { ideas: active, showingAllFallback: false, unreadable: true };
  }
  const selected = active.filter((i) => i.presenting);
  return {
    ideas: selected.length > 0 ? selected : active,
    showingAllFallback: selected.length === 0 && active.length > 0,
    unreadable: false,
  };
}

export type PresentedResult = {
  ideas: Idea[];
  /** True when ANY team's bucket is unreadable. Partial readability is
      still a set the room cannot trust — the ballot must not quietly
      offer the two readable teams and drop the third. */
  unreadable: boolean;
};

/**
 * The whole category's presented collection, across every team — the
 * ballot's set and the returns' set, in one call. Ideas filed under no
 * team form their own bucket and pass the same gate, so an unfiled idea
 * is never silently dropped from the vote.
 */
export function presentedInCategory(ideas: Idea[]): PresentedResult {
  const buckets = new Map<string, Idea[]>();
  for (const idea of ideas) {
    const key = idea.team_id ?? "—";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(idea);
    else buckets.set(key, [idea]);
  }

  const out: Idea[] = [];
  let unreadable = false;
  for (const bucket of buckets.values()) {
    const gated = teamStageIdeas(bucket);
    if (gated.unreadable) unreadable = true;
    out.push(...gated.ideas);
  }
  return { ideas: out, unreadable };
}
