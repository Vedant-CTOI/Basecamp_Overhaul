// ============================================================
// THE WRITE LAYER — no write fails silently
// ============================================================
// U3 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
// The backend audit's headline finding: not one of the app's ~70
// mutating call sites inspects `error`. Against a real Postgres every
// Present toggle and every Darkroom commission returns 400 and changes
// nothing, and the room is never told.
//
// BACKEND-AGNOSTIC BY CONSTRUCTION. This module knows nothing about
// Postgres, PostgREST, Firestore or the showcase shim. It takes
// anything that resolves to `{ data, error }`, inspects the error the
// app has been discarding, logs it once with the operation that raised
// it, and hands the caller a result it cannot ignore. Whatever store
// ends up underneath, the discipline is the same.
//
// It does NOT retry, queue, buffer, or own UI. Retry is a product
// decision; the failure mark belongs to the surface that issued the
// write, in that surface's own status register. This is a discipline,
// not a data layer — keep it small.
//
// The convention is ENFORCED, not remembered:
// `scripts/check-write-errors.mjs` fails the build when a mutating call
// site bypasses this module. A site where fire-and-forget is genuinely
// correct carries an `// write-unchecked: <reason>` comment, so the
// exception is on the record rather than invisible.
// ============================================================

/** What a caller gets back. Discriminated, so `r.ok` is the only path
    to the data and a failure cannot be read as a success. */
export type WriteResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: string | null; message: string };

/** The shape every backend client's mutating builder settles to. */
type Settled = {
  data: unknown;
  error: { code?: string | null; message?: string } | null;
};

/**
 * Await a mutating query and report its outcome.
 *
 * @param op    what was attempted, as `table.verb:intent`
 *              (`ideas.update:present`). It is the log line and the
 *              thing a facilitator reads back to us over the phone.
 * @param query any builder that settles to `{ data, error }`.
 */
export async function write<T = unknown>(
  op: string,
  query: PromiseLike<Settled>,
): Promise<WriteResult<T>> {
  try {
    const { data, error } = await query;
    if (error) {
      const code = error.code ?? null;
      const message = error.message || "The write was rejected.";
      console.error(`[db] ${op} failed${code ? ` · ${code}` : ""} — ${message}`);
      return { ok: false, code, message };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    // A throw is the transport failing before the store ever saw the
    // statement — a dropped network, a client built with no URL. Same
    // fact to the room, so it takes the same shape.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[db] ${op} threw — ${message}`);
    return { ok: false, code: null, message };
  }
}

/** True when a write returned rows. PostgREST needs an explicit
    `.select()` to return them; a matched-nothing update comes back as
    an empty array, which is how U7's `updated_at` precondition learns
    that someone else wrote first. */
export function matchedNothing(r: WriteResult): boolean {
  return r.ok && Array.isArray(r.data) && r.data.length === 0;
}
