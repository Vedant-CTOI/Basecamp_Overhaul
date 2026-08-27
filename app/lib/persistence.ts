// ============================================================
// PERSISTENCE — the workshop survives its server
// ============================================================
// The in-memory engine (lib/supabase.ts showcase mode) loses every
// idea, vote, and coaching note when the process restarts. On Render a
// service restarts on every deploy, so a room that took two hours of
// work would come back EMPTY. This module gives that engine a disk.
//
// DESIGN: one JSON snapshot per store, written after every mutation,
// plus an append-only AUDIT LOG — one line per mutation, who/what/when/
// before→after — so the workshop's history is reconstructable, not just
// its latest state. Both live under PERSIST_DIR (default /var/data on
// Render, ./workshop-data locally).
//
// SERVER-SIDE ONLY. lib/supabase.ts runs isomorphic code; this module
// must never be imported from a client bundle. All entry points guard
// on `typeof window === 'undefined'` and dynamic-import node:fs, so an
// accidental client import degrades to a no-op instead of breaking the
// build.
//
// WRITE MODEL: debounced snapshot (150ms) — mutations arrive in bursts
// (a vote sweep writes N rows), and each write is atomic (tmp+rename)
// so a crash mid-write leaves the last good snapshot intact. The audit
// log appends synchronously-ish (fire-and-forget) because history must
// not lose entries to a debounce window.
// ============================================================

type Row = Record<string, unknown>;

const DEBOUNCE_MS = 150;

function isServer(): boolean {
  return typeof window === 'undefined';
}

function persistDir(): string {
  return process.env.PERSIST_DIR || '/var/data/workshop';
}

async function fs() {
  return await import('node:fs/promises');
}
function pathFor(dir: string, name: string): string {
  // node:path without a top-level import (keeps this file loadable in
  // browser bundles where only the guards run).
  return dir.endsWith('/') ? dir + name : dir + '/' + name;
}

let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Load the persisted stores over the seed, once per process. */
export async function loadPersisted(
  seed: Record<string, Row[]>,
): Promise<Record<string, Row[]>> {
  if (!isServer()) return seed;
  if (loaded) return seed;
  loaded = true;
  try {
    const f = await fs();
    const raw = await f.readFile(pathFor(persistDir(), 'store.json'), 'utf8');
    const saved = JSON.parse(raw) as Record<string, Row[]>;
    // Merge table-by-table: tables saved empty stay empty (a deliberate
    // wipe persists), tables never saved fall back to seed.
    const merged: Record<string, Row[]> = { ...seed };
    for (const [table, rows] of Object.entries(saved)) {
      if (Array.isArray(rows)) merged[table] = rows;
    }
    const counts = Object.entries(merged).map(([k, v]) => `${k}:${v.length}`).join(' ');
    console.log(`[persist] restored workshop state (${counts})`);
    return merged;
  } catch {
    // No snapshot yet (first boot) or unreadable — run on seed.
    console.log('[persist] no prior state found — fresh room on seed');
    return seed;
  }
}

/** Snapshot the whole store to disk (atomic tmp+rename). */
export async function persistSnapshot(store: Record<string, Row[]>): Promise<void> {
  if (!isServer()) return;
  try {
    const f = await fs();
    const dir = persistDir();
    await f.mkdir(dir, { recursive: true });
    const target = pathFor(dir, 'store.json');
    const tmp = pathFor(dir, `store.json.tmp-${process.pid}`);
    await f.writeFile(tmp, JSON.stringify(store), 'utf8');
    await f.rename(tmp, target);
  } catch (err) {
    console.error('[persist] snapshot FAILED:', err);
  }
}

/** Debounced snapshot — call after any mutation batch. */
export function scheduleSnapshot(store: Record<string, Row[]>): void {
  if (!isServer()) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void persistSnapshot(store);
  }, DEBOUNCE_MS);
}

/** Flush any pending snapshot immediately (process shutdown). */
export async function flushSnapshot(store: Record<string, Row[]>): Promise<void> {
  if (!isServer()) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await persistSnapshot(store);
}

// ── Audit log ────────────────────────────────────────────────────

export type AuditEntry = {
  ts: string;
  op: string;            // insert | update | delete | upsert | rpc:<fn>
  table: string;
  pk: string | null;     // primary key of the row(s), comma-joined
  summary: string;       // human-readable what-changed
};

export async function appendAudit(entry: AuditEntry): Promise<void> {
  if (!isServer()) return;
  try {
    const f = await fs();
    const dir = persistDir();
    await f.mkdir(dir, { recursive: true });
    await f.appendFile(pathFor(dir, 'audit.log'), JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('[persist] audit append FAILED:', err);
  }
}

/** Build a short human summary of a mutation for the audit line. */
export function summarize(
  op: string,
  table: string,
  newRow: Row | null,
  oldRow: Row | null,
): string {
  const nameOf = (r: Row | null) =>
    r ? String(r.name ?? r.message ?? r.key ?? r.category ?? r.coach_type ?? r.id ?? '?') : '?';
  switch (op) {
    case 'insert':
      return `${table}: created "${nameOf(newRow)}"`;
    case 'delete':
      return `${table}: deleted "${nameOf(oldRow)}"`;
    case 'update': {
      if (!newRow || !oldRow) return `${table}: updated ${nameOf(newRow ?? oldRow)}`;
      const changed = Object.keys(newRow)
        .filter((k) => JSON.stringify(newRow[k]) !== JSON.stringify(oldRow[k]))
        .slice(0, 4);
      return `${table}: "${nameOf(newRow)}" changed ${changed.join(', ') || 'nothing'}`;
    }
    default:
      return `${table}: ${op} on ${nameOf(newRow)}`;
  }
}
