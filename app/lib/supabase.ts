import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SHOWCASE_TEAMS, SHOWCASE_IDEAS, SHOWCASE_VOTES, SHOWCASE_TRAINING_NOTES,
  SHOWCASE_TICKER, SHOWCASE_SETTINGS, SHOWCASE_BRIEFS, SHOWCASE_VISIONS,
} from './showcase-data';
import { SCHEMA_TABLES, SCHEMA_FUNCTIONS, type TableSpec } from './schema-manifest.generated';
// Disk-backed state + audit trail (server-side only; no-ops in browser).
import { loadPersisted, scheduleSnapshot, appendAudit, summarize } from './persistence';

// ============================================================
// SHOWCASE MODE
// ============================================================
// With Supabase env configured, this module is a plain client factory.
// Without it, the app runs in showcase mode: an in-memory engine serves
// the instructional rows from showcase-data.ts, mutations work for the
// session, and a BroadcastChannel syncs tabs on the same machine so the
// Stage + a phone-sized window demo like a live room. No backend.
// ============================================================

const ENV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ENV_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isShowcaseMode = !ENV_URL || !ENV_KEY;

type Row = Record<string, unknown>;
type ChangeEvent = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: Row | null; old: Row | null; table: string; schema: 'public' };

// ── In-memory store ───────────────────────────────────────────
const PK: Record<string, string> = {
  teams: 'id', ideas: 'id', votes: 'id', training_notes: 'id', ticker_messages: 'id',
  workshop_settings: 'key', category_briefs: 'category', pillar_visions: 'category',
  coach_prompt_overrides: 'coach_type',
};

function seedStore(): Record<string, Row[]> {
  const seeded: Record<string, Row[]> = JSON.parse(JSON.stringify({
    teams: SHOWCASE_TEAMS,
    ideas: SHOWCASE_IDEAS,
    votes: SHOWCASE_VOTES,
    training_notes: SHOWCASE_TRAINING_NOTES,
    ticker_messages: SHOWCASE_TICKER,
    workshop_settings: SHOWCASE_SETTINGS,
    category_briefs: SHOWCASE_BRIEFS,
    pillar_visions: SHOWCASE_VISIONS,
    coach_prompt_overrides: [],
  }));
  assertSeedMatchesSchema(seeded);
  return seeded;
}

let store: Record<string, Row[]> | null = null;
function getStore(): Record<string, Row[]> {
  if (!store) {
    store = seedStore();
    // Server-side: restore whatever the last process saved (fire and
    // forget — the first queries of a booting room may briefly see seed,
    // and every notify() below refetches them onto the restored state).
    if (typeof window === 'undefined') {
      void loadPersisted(seedStore()).then((restored) => {
        if (!store) return;
        const changed = JSON.stringify(restored) !== JSON.stringify(store);
        store = restored;
        if (changed) {
          for (const table of Object.keys(restored)) {
            notify({ eventType: 'UPDATE', new: null, old: null, table, schema: 'public' });
          }
        }
      });
    }
  }
  return store;
}

/** Server-side mutation bookkeeping: snapshot + one audit line. */
function recordMutation(op: string, table: string, newRow: Row | null, oldRow: Row | null): void {
  scheduleSnapshot(store!);
  void appendAudit({
    ts: new Date().toISOString(),
    op,
    table,
    pk: String((newRow ?? oldRow)?.id ?? (newRow ?? oldRow)?.key ?? ''),
    summary: summarize(op, table, newRow, oldRow),
  });
}

// ============================================================
// THE STRICT SHIM (U2) — the manifest is the law
// ============================================================
// `schema-manifest.generated.ts` is generated from the deployment SQL
// (schema.sql + the standard migrations) by
// scripts/build-schema-manifest.mjs, and everything below ENFORCES it
// with PostgREST's own error shapes:
//
//   · a write naming a column no migration declares  → PGRST204
//   · a select list naming an unknown column         → 42703
//   · `.single()` on zero (or several) rows          → PGRST116
//     while `.maybeSingle()` on zero rows stays null-and-no-error
//   · declared defaults materialise on insert
//   · NOT NULL → 23502 · CHECK → 23514 · UNIQUE → 23505
//   · a delete a foreign key restrains               → 23503
//     (and `on delete cascade` actually cascades)
//   · a mutation returns rows only through `.select()`
//   · an RPC the SQL never declared                  → PGRST202
//
// This is deliberate: the shim used to be permissive where PostgREST is
// strict, which is how six missing columns hid for two weeks (defect
// #1). There is NO tolerance flag — a tolerance that can be switched
// off will be switched off.
//
// THE REVIEW HARNESS can withhold columns from the manifest to stand in
// for an unmigrated deployment:
//
//   window.__showcaseWithholdColumns = { ideas: ['presenting', …] };
//
// A withheld column is treated as nonexistent — writes naming it fail
// PGRST204, defaults for it stop materialising — which is exactly the
// pre-migration Postgres the audit reconstructed. Nothing in the app
// writes this global; it exists so the harness can prove the strictness
// catches defect #1's whole class.

function withheldFor(table: string): string[] {
  if (typeof window === 'undefined') return [];
  const w = (window as unknown as { __showcaseWithholdColumns?: Record<string, string[]> })
    .__showcaseWithholdColumns;
  return (w && w[table]) || [];
}

function tableSpec(table: string): TableSpec | null {
  return SCHEMA_TABLES[table] ?? null;
}

/** The columns this table has RIGHT NOW — the manifest minus anything
    the harness is withholding to simulate an unmigrated store. */
function liveColumns(table: string, spec: TableSpec): Set<string> {
  const cols = new Set(Object.keys(spec.columns));
  for (const w of withheldFor(table)) cols.delete(w);
  return cols;
}

function pgrst204(table: string, column: string): ShimError {
  return {
    code: 'PGRST204',
    message: `Could not find the '${column}' column of '${table}' in the schema cache`,
  };
}

function pgrst205(table: string): ShimError {
  return {
    code: 'PGRST205',
    message: `Could not find the table 'public.${table}' in the schema cache`,
  };
}

function firstUnknownKey(row: Row, cols: Set<string>): string | null {
  for (const k of Object.keys(row)) if (!cols.has(k)) return k;
  return null;
}

/** Materialise the schema's declared defaults on an insert, the way the
    live Postgres will. Withheld columns get nothing — an unmigrated
    store has no default to give. */
function applyDefaults(table: string, spec: TableSpec, row: Row): Row {
  const missing = new Set(withheldFor(table));
  for (const [name, col] of Object.entries(spec.columns)) {
    if (missing.has(name) || name in row || !col.default) continue;
    if (col.default.kind === 'uuid') row[name] = `sc-${Date.now()}-${++insertSeq}`;
    else if (col.default.kind === 'now') row[name] = new Date().toISOString();
    else row[name] = Array.isArray(col.default.value) ? [...col.default.value] : col.default.value;
  }
  return row;
}

/** NOT NULL (23502) and CHECK (23514) over a full row — the insert
    contract. `onlyKeys` narrows it to the columns a payload touched,
    which is the update contract: Postgres cannot newly violate a
    constraint on a column the statement never wrote. */
function constraintViolation(
  table: string, spec: TableSpec, row: Row, onlyKeys: string[] | null,
): ShimError | null {
  const scope = onlyKeys ? new Set(onlyKeys) : null;
  for (const [name, col] of Object.entries(spec.columns)) {
    if (scope && !scope.has(name)) continue;
    if (!scope && withheldFor(table).includes(name)) continue;
    if (col.notNull && (row[name] === null || row[name] === undefined)) {
      return {
        code: '23502',
        message: `null value in column "${name}" of relation "${table}" violates not-null constraint`,
      };
    }
  }
  for (const chk of spec.checks) {
    if (scope && !scope.has(chk.column)) continue;
    const v = row[chk.column];
    // SQL semantics: a NULL operand makes the CHECK pass.
    if (v === null || v === undefined) continue;
    if (!chk.allowed.includes(v as string)) {
      return {
        code: '23514',
        message: `new row for relation "${table}" violates check constraint "${chk.name}"`,
      };
    }
  }
  return null;
}

/** UNIQUE and PRIMARY KEY (23505). `candidates` are the rows a
    statement is about to produce; `existing` is the store minus any row
    the same statement is replacing. SQL treats NULL as never equal, so
    a null key participates in no conflict. */
function uniqueViolation(
  table: string, spec: TableSpec, candidates: Row[], existing: Row[],
): ShimError | null {
  const sets: Array<{ name: string; columns: string[] }> = [
    ...(spec.primaryKey.length ? [{ name: `${table}_pkey`, columns: spec.primaryKey }] : []),
    ...spec.uniques,
  ];
  for (const u of sets) {
    const seen = new Set<string>();
    for (const row of existing) {
      const key = u.columns.map((c) => row[c]);
      if (key.some((v) => v === null || v === undefined)) continue;
      seen.add(JSON.stringify(key));
    }
    for (const row of candidates) {
      const key = u.columns.map((c) => row[c]);
      if (key.some((v) => v === null || v === undefined)) continue;
      const flat = JSON.stringify(key);
      if (seen.has(flat)) {
        return {
          code: '23505',
          message: `duplicate key value violates unique constraint "${u.name}"`,
        };
      }
      seen.add(flat);
    }
  }
  return null;
}

/** The seed is a database state, and it obeys the same law the writes
    do. A seed row that violates the manifest is a showcase quietly
    demonstrating rows the live deployment cannot hold — fail loudly, at
    module load, before a room ever sees it. */
function assertSeedMatchesSchema(seeded: Record<string, Row[]>): void {
  const problems: string[] = [];
  for (const [table, rows] of Object.entries(seeded)) {
    const spec = tableSpec(table);
    if (!spec) {
      problems.push(`table "${table}" exists in no migration`);
      continue;
    }
    const cols = new Set(Object.keys(spec.columns));
    rows.forEach((row, i) => {
      const unknown = firstUnknownKey(row, cols);
      if (unknown) problems.push(`${table}[${i}] carries unknown column "${unknown}"`);
      const violation = constraintViolation(table, spec, row, null);
      if (violation) problems.push(`${table}[${i}] ${violation.message}`);
    });
    const dup = uniqueViolation(table, spec, rows, []);
    if (dup) problems.push(`${table}: ${dup.message}`);
  }
  if (problems.length) {
    throw new Error(
      `showcase-data violates the schema manifest — fix the seed, not the check:\n  ${problems.join('\n  ')}`,
    );
  }
}

// ── Realtime: local subscribers + cross-tab broadcast ─────────
type Sub = { id: number; table: string | undefined; event: string; cb: (payload: ChangeEvent) => void; channelKey: object };
let subSeq = 0;
const subs: Sub[] = [];

// ── The join handshake ────────────────────────────────────────
// A tab that opens LATE must join the room already in progress: a
// phone scanning the QR after the facilitator called the vote has to
// see the open ballot, not the seed's idle state. Every store is
// per-tab, so a newcomer announces itself and any tab holding session
// mutations answers with a snapshot; the newcomer adopts the first
// answer and re-notifies its subscribers, which refetch. Pristine
// tabs stay quiet (their store IS the seed) and an adopted tab never
// takes a second snapshot, so nothing clobbers local work.
type Hello = { __basecamp: 'hello' };
type Snapshot = { __basecamp: 'snapshot'; store: Record<string, Row[]> };
type BusMessage = ChangeEvent | Hello | Snapshot;

/** This tab has applied at least one mutation — local or remote. */
let mutated = false;
/** This tab has taken a snapshot from an older tab (or made its own
    changes), so it is no longer a blank newcomer. */
let adopted = false;

let bc: BroadcastChannel | null = null;
function getBC(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!bc) {
    bc = new BroadcastChannel('basecamp-showcase');
    bc.onmessage = (msg: MessageEvent<BusMessage>) => {
      const data = msg.data;
      if (data && '__basecamp' in data) {
        if (data.__basecamp === 'hello') {
          if (mutated) bc?.postMessage({ __basecamp: 'snapshot', store: getStore() } as Snapshot);
          return;
        }
        if (data.__basecamp === 'snapshot') {
          if (adopted) return;
          adopted = true;
          store = data.store;
          // Everything the newcomer already fetched is stale — nudge
          // every live subscriber to refetch against the joined state.
          for (const table of Object.keys(store)) {
            notify({ eventType: 'UPDATE', new: null, old: null, table, schema: 'public' });
          }
          return;
        }
        return;
      }
      applyRemote(data);
      notify(data);
    };
    // Announce once the first render's subscriptions are in place — a
    // snapshot that lands before them would refetch nothing.
    setTimeout(() => bc?.postMessage({ __basecamp: 'hello' } as Hello), 50);
  }
  return bc;
}

function notify(ev: ChangeEvent) {
  for (const s of subs) {
    if (s.table && s.table !== ev.table) continue;
    if (s.event !== '*' && s.event !== ev.eventType) continue;
    try { s.cb(ev); } catch { /* subscriber errors are theirs */ }
  }
}

function emit(ev: ChangeEvent) {
  // This tab now holds session state of its own: it answers newcomers
  // and stops taking snapshots.
  mutated = true;
  adopted = true;
  queueMicrotask(() => {
    notify(ev);
    getBC()?.postMessage(ev);
  });
}

function applyRemote(ev: ChangeEvent) {
  mutated = true;
  const st = getStore();
  const rows = st[ev.table];
  if (!rows) return;
  const pk = PK[ev.table] ?? 'id';
  if (ev.eventType === 'DELETE' && ev.old) {
    st[ev.table] = rows.filter((r) => r[pk] !== (ev.old as Row)[pk]);
  } else if (ev.new) {
    const i = rows.findIndex((r) => r[pk] === (ev.new as Row)[pk]);
    if (i >= 0) rows[i] = ev.new; else rows.push(ev.new);
  }
}

// ── Forced failures (showcase only) ───────────────────────────
// A room has to be able to survive a failed write, and this repository
// has no database to make one fail. So the shim takes a fault list
// from the page:
//
//   window.__showcaseFaults = [
//     { table: 'ideas', op: 'update', columns: ['print_status'] },
//   ];
//
// A fault matches on table, optionally the verb, and optionally the
// COLUMNS the payload touches — which is how the review harness
// reproduces the audit's worst case: reject the print columns and
// nothing else, then prove the participant's name and description
// survived it (R7). The error shape is PostgREST's, because that is
// what the deployed client will hand the app; the fault mechanism
// itself is store-agnostic and would sit the same way in front of any
// other backend.
//
// Nothing in the app writes this global, and none of this code runs
// when Supabase env is configured — `getSupabase()` returns the real
// client and ShowcaseQuery is never constructed.
type ShimError = { code: string; message: string };
type ForcedFault = {
  table: string;
  op?: 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  columns?: string[];
  code?: string;
  message?: string;
};

function faultFor(table: string, op: string, payload: Row | Row[] | null): ShimError | null {
  if (typeof window === 'undefined') return null;
  const faults = (window as unknown as { __showcaseFaults?: ForcedFault[] }).__showcaseFaults;
  if (!Array.isArray(faults) || !faults.length) return null;
  const keys = new Set<string>();
  const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
  for (const item of items) for (const k of Object.keys(item)) keys.add(k);
  for (const f of faults) {
    if (f.table !== table) continue;
    if (f.op && f.op !== op) continue;
    if (f.columns && !f.columns.some((c) => keys.has(c))) continue;
    const col = f.columns?.find((c) => keys.has(c)) ?? f.columns?.[0];
    return {
      code: f.code ?? 'PGRST204',
      message:
        f.message ??
        (col
          ? `Could not find the '${col}' column of '${table}' in the schema cache`
          : `The write to '${table}' was rejected`),
    };
  }
  return null;
}

// ── Query builder ─────────────────────────────────────────────
let insertSeq = 0;

/** SQL LIKE semantics as a row predicate: `%` → any run, `_` → one char,
    every other character literal. */
function matchLike(col: string, pattern: string, insensitive: boolean): (r: Row) => boolean {
  const rx = new RegExp(
    `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`,
    insensitive ? "i" : "",
  );
  return (r) => typeof r[col] === "string" && rx.test(r[col] as string);
}

class ShowcaseQuery {
  private table: string;
  private filters: Array<(r: Row) => boolean> = [];
  private orderBy: { col: string; asc: boolean } | null = null;
  private limitN: number | null = null;
  private wantSingle = false;
  private wantMaybe = false;
  private wantCount = false;
  private wantHead = false;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: Row | Row[] | null = null;
  private conflictKey: string | null = null;
  /** The explicit column list, kept for validation (42703). `"*"` and a
      bare `.select()` stay unvalidated — they are unvalidatable and
      correct, exactly as PostgREST treats them. */
  private selectCols: string | null = null;
  /** PostgREST returns rows from a mutation only when `.select()` was
      chained after the verb. A shim that returned them anyway would let
      call sites read data a live deployment never sends. */
  private returning = false;

  constructor(table: string) { this.table = table; }

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (typeof cols === 'string' && cols.trim() && cols.trim() !== '*') {
      this.selectCols = cols;
    }
    if (this.op === 'select') {
      this.wantCount = opts?.count === 'exact';
      this.wantHead = !!opts?.head;
    } else {
      this.returning = true;
    }
    return this;
  }
  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  neq(col: string, val: unknown) { this.filters.push((r) => r[col] !== val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  // PostgREST LIKE/ILIKE — `%` and `_` are the wildcards. The admin's PPTX
  // export reads its team visions with `.like("key", "team_vision_%")`, and
  // without this the builder threw before the query ever ran.
  like(col: string, pattern: string) { this.filters.push(matchLike(col, pattern, false)); return this; }
  ilike(col: string, pattern: string) { this.filters.push(matchLike(col, pattern, true)); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy = { col, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this.limitN = n; return this; }
  // `.single()` and `.maybeSingle()` were one function here for months,
  // which is why divergence §1.3c was invisible: PostgREST answers zero
  // rows under `.single()` with PGRST116 and under `.maybeSingle()`
  // with a clean null, and sites that branch on `error` behave
  // differently under each. The split is now real.
  single() { this.wantSingle = true; this.wantMaybe = false; return this; }
  maybeSingle() { this.wantSingle = true; this.wantMaybe = true; return this; }

  insert(payload: Row | Row[]) { this.op = 'insert'; this.payload = payload; return this; }
  update(payload: Row) { this.op = 'update'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(payload: Row | Row[], opts?: { onConflict?: string }) {
    this.op = 'upsert';
    this.payload = payload;
    this.conflictKey = opts?.onConflict ?? PK[this.table] ?? 'id';
    return this;
  }

  private matches(): Row[] {
    let rows = getStore()[this.table] ?? [];
    for (const f of this.filters) rows = rows.filter(f);
    return rows;
  }

  /** PostgREST's object-mode contract. `.single()` demands exactly one
      row (PGRST116 otherwise); `.maybeSingle()` forgives zero. */
  private singleize(rows: Row[], count: number | null): { data: unknown; error: ShimError | null; count: number | null } {
    if (!this.wantSingle) return { data: rows, error: null, count };
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (rows.length === 0 && this.wantMaybe) return { data: null, error: null, count };
    return {
      data: null,
      error: {
        code: 'PGRST116',
        message: `JSON object requested, multiple (or no) rows returned (the result contains ${rows.length} rows)`,
      },
      count,
    };
  }

  private exec(): { data: unknown; error: ShimError | null; count: number | null } {
    const st = getStore();

    // A forced fault is checked BEFORE any mutation, so a rejected
    // write cannot half-apply — the same contract PostgREST holds.
    if (this.op !== 'select') {
      const fault = faultFor(this.table, this.op, this.payload);
      if (fault) return { data: null, error: fault, count: null };
    }

    const spec = tableSpec(this.table);
    if (!spec) return { data: null, error: pgrst205(this.table), count: null };
    const cols = liveColumns(this.table, spec);
    const pk = spec.primaryKey[0] ?? PK[this.table] ?? 'id';

    // An explicit select list is validated whether it is a read or a
    // mutation's returning clause — 42703 either way (§1.3b).
    if (this.selectCols) {
      for (const raw of this.selectCols.split(',')) {
        const name = raw.trim();
        if (name && !cols.has(name)) {
          return {
            data: null,
            error: { code: '42703', message: `column ${this.table}.${name} does not exist` },
            count: null,
          };
        }
      }
    }

    if (this.op === 'select') {
      let rows = [...this.matches()];
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        rows.sort((a, b) => {
          const av = a[col] as string | number; const bv = b[col] as string | number;
          return (av < bv ? -1 : av > bv ? 1 : 0) * (asc ? 1 : -1);
        });
      }
      if (this.limitN != null) rows = rows.slice(0, this.limitN);
      const count = this.wantCount ? rows.length : null;
      if (this.wantHead) return { data: null, error: null, count };
      return this.singleize(rows, count);
    }

    // Mutations return their rows only through `.select()` — a bare
    // insert/update/delete answers with no representation, live and here.
    const represent = (rows: Row[]) =>
      this.returning ? this.singleize(rows.map((r) => ({ ...r })), null)
        : { data: null, error: null, count: null };

    if (this.op === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
      const built: Row[] = [];
      for (const item of items) {
        const unknown = firstUnknownKey(item, cols);
        if (unknown) return { data: null, error: pgrst204(this.table, unknown), count: null };
        const row: Row = applyDefaults(this.table, spec, { ...item });
        const violation = constraintViolation(this.table, spec, row, null);
        if (violation) return { data: null, error: violation, count: null };
        built.push(row);
      }
      const dup = uniqueViolation(this.table, spec, built, st[this.table] ?? []);
      if (dup) return { data: null, error: dup, count: null };
      for (const row of built) {
        (st[this.table] ??= []).push(row);
        emit({ eventType: 'INSERT', new: row, old: null, table: this.table, schema: 'public' }); recordMutation('insert', this.table, row, null);
      }
      return represent(built);
    }

    if (this.op === 'update') {
      const payload = (this.payload ?? {}) as Row;
      const unknown = firstUnknownKey(payload, cols);
      if (unknown) return { data: null, error: pgrst204(this.table, unknown), count: null };
      const targets = this.matches();
      const touched = Object.keys(payload);
      // Validate every row BEFORE touching any — a statement either
      // applies whole or not at all.
      for (const row of targets) {
        const violation = constraintViolation(this.table, spec, { ...row, ...payload }, touched);
        if (violation) return { data: null, error: violation, count: null };
      }
      const touchesUnique = [
        ...(spec.primaryKey.length ? [{ columns: spec.primaryKey }] : []),
        ...spec.uniques,
      ].some((u) => u.columns.some((c) => touched.includes(c)));
      if (touchesUnique) {
        const merged = targets.map((row) => ({ ...row, ...payload }));
        const others = (st[this.table] ?? []).filter((r) => !targets.includes(r));
        const dup = uniqueViolation(this.table, spec, merged, others);
        if (dup) return { data: null, error: dup, count: null };
      }
      const updated: Row[] = [];
      for (const row of targets) {
        Object.assign(row, payload);
        updated.push(row);
        emit({ eventType: 'UPDATE', new: { ...row }, old: { [pk]: row[pk] }, table: this.table, schema: 'public' }); recordMutation('update', this.table, { ...row }, { [pk]: row[pk] });
      }
      return represent(updated);
    }

    if (this.op === 'delete') {
      const doomed = this.matches();
      // Foreign keys hold here the way they hold live: a referencing
      // row with no cascade RESTRAINS the delete (23503) before a
      // single row moves; `on delete cascade` takes its children with
      // it. This is what makes the two delete paths' notes-first
      // ordering a tested property instead of a lucky one.
      const cascades: Array<{ table: string; rows: Row[] }> = [];
      if (doomed.length) {
        for (const [otherName, otherSpec] of Object.entries(SCHEMA_TABLES)) {
          for (const fk of otherSpec.foreignKeys) {
            if (fk.refTable !== this.table) continue;
            const doomedKeys = new Set(doomed.map((r) => r[fk.refColumn]));
            const children = (st[otherName] ?? []).filter(
              (r) => r[fk.column] != null && doomedKeys.has(r[fk.column]),
            );
            if (!children.length) continue;
            if (fk.onDelete !== 'cascade') {
              return {
                data: null,
                error: {
                  code: '23503',
                  message: `update or delete on table "${this.table}" violates foreign key constraint "${fk.name}" on table "${otherName}"`,
                },
                count: null,
              };
            }
            cascades.push({ table: otherName, rows: children });
          }
        }
      }
      for (const c of cascades) {
        st[c.table] = (st[c.table] ?? []).filter((r) => !c.rows.includes(r));
        for (const row of c.rows) {
          emit({ eventType: 'DELETE', new: null, old: { ...row }, table: c.table, schema: 'public' }); recordMutation('delete', c.table, null, { ...row });
        }
      }
      st[this.table] = (st[this.table] ?? []).filter((r) => !doomed.includes(r));
      for (const row of doomed) {
        emit({ eventType: 'DELETE', new: null, old: { ...row }, table: this.table, schema: 'public' }); recordMutation('delete', this.table, null, { ...row });
      }
      return represent(doomed);
    }

    // upsert — per item, an update in place or a fresh insert, each
    // validated under its own contract before anything applies.
    const items = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
    const key = this.conflictKey ?? pk;
    for (const item of items) {
      const unknown = firstUnknownKey(item, cols);
      if (unknown) return { data: null, error: pgrst204(this.table, unknown), count: null };
    }
    const result: Row[] = [];
    for (const item of items) {
      const rows = st[this.table] ??= [];
      const i = rows.findIndex((r) => r[key] === item[key]);
      if (i >= 0) {
        const violation = constraintViolation(this.table, spec, { ...rows[i], ...item }, Object.keys(item));
        if (violation) return { data: null, error: violation, count: null };
        Object.assign(rows[i], item);
        result.push(rows[i]);
        emit({ eventType: 'UPDATE', new: { ...rows[i] }, old: { [key]: item[key] }, table: this.table, schema: 'public' }); recordMutation('update', this.table, { ...rows[i] }, { [key]: item[key] });
      } else {
        const row: Row = applyDefaults(this.table, spec, { ...item });
        const violation = constraintViolation(this.table, spec, row, null);
        if (violation) return { data: null, error: violation, count: null };
        const dup = uniqueViolation(this.table, spec, [row], rows);
        if (dup) return { data: null, error: dup, count: null };
        rows.push(row);
        result.push(row);
        emit({ eventType: 'INSERT', new: { ...row }, old: null, table: this.table, schema: 'public' }); recordMutation('insert', this.table, { ...row }, null);
      }
    }
    // `.upsert(...).select().single()` returns the ROW live, not an array —
    // the settings/briefs/coach-prompt PUT routes all read `data.key`.
    return this.returning
      ? this.singleize(result.map((r) => ({ ...r })), null)
      : { data: null, error: null, count: null };
  }

  then<T>(onFulfilled?: (v: { data: unknown; error: ShimError | null; count: number | null }) => T, onRejected?: (e: unknown) => T) {
    return Promise.resolve(this.exec()).then(onFulfilled, onRejected);
  }
}

// ── RPCs ──────────────────────────────────────────────────────
function showcaseRpc(fn: string, args: Record<string, unknown>) {
  const st = getStore();
  const fault = faultFor(`rpc:${fn}`, 'rpc', args as Row);
  if (fault) return Promise.resolve({ data: null, error: fault });
  // An RPC the SQL never declared fails the way PostgREST fails it,
  // instead of the old `{ data: null, error: null }` that let a future
  // RPC silently succeed in the showcase (§1.3g).
  if (!SCHEMA_FUNCTIONS.includes(fn)) {
    return Promise.resolve({
      data: null,
      error: { code: 'PGRST202', message: `Could not find the function public.${fn} in the schema cache` },
    });
  }
  if (fn === 'cast_vote') {
    const { p_idea_id, p_category, p_voter_id } = args as { p_idea_id: string; p_category: string; p_voter_id: string };
    const limitRow = st.workshop_settings.find((r) => r.key === 'max_votes_per_pillar');
    // Migration 002's hardened parse, mirrored exactly: strip
    // non-digits, cap at four digits, fall back to 3 when nothing
    // numeric survives — and '0' is respected (a room configured shut).
    const digits = String(limitRow?.value ?? '').replace(/[^0-9]/g, '').slice(0, 4);
    const limit = digits === '' ? 3 : parseInt(digits, 10);
    const mine = st.votes.filter((v) => v.voter_id === p_voter_id && v.category === p_category);
    if (mine.length >= limit) return Promise.resolve({ data: false, error: null });
    if (st.votes.some((v) => v.idea_id === p_idea_id && v.voter_id === p_voter_id)) {
      return Promise.resolve({ data: false, error: null });
    }
    const row: Row = { id: `sc-vote-${Date.now()}-${++insertSeq}`, idea_id: p_idea_id, category: p_category, voter_id: p_voter_id, created_at: new Date().toISOString() };
    st.votes.push(row);
    emit({ eventType: 'INSERT', new: row, old: null, table: 'votes', schema: 'public' }); recordMutation('insert', 'votes', row, null);
    return Promise.resolve({ data: true, error: null });
  }
  if (fn === 'merge_ideas') {
    const { p_original_ids, p_new_name, p_new_description, p_category, p_team_id } = args as { p_original_ids: string[]; p_new_name: string; p_new_description: string; p_category: string; p_team_id: string };
    for (const id of p_original_ids) {
      const row = st.ideas.find((r) => r.id === id);
      if (row) {
        row.status = 'bench';
        row.updated_at = new Date().toISOString();
        emit({ eventType: 'UPDATE', new: { ...row }, old: { id }, table: 'ideas', schema: 'public' }); recordMutation('update', 'ideas', { ...row }, { id });
      }
    }
    const merged: Row = {
      id: `sc-merge-${Date.now()}-${++insertSeq}`, team_id: p_team_id, category: p_category,
      name: p_new_name, description: p_new_description, status: 'draft', source: 'team',
      wave: null, bbei_connection: null, key_partners: null, link_group: null, gifted_from_team_id: null,
      // The schema's declared defaults — same contract the insert path
      // materialises (see COLUMN_DEFAULTS): a merged idea is a fresh
      // row, and a fresh row that lacked `presenting` would read as an
      // unreadable deployment to the present gate.
      presenting: false, print_status: null, print_options: null, print_url: null,
      print_source: null, print_note: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    st.ideas.push(merged);
    emit({ eventType: 'INSERT', new: merged, old: null, table: 'ideas', schema: 'public' }); recordMutation('insert', 'ideas', merged, null);
    return Promise.resolve({ data: merged.id, error: null });
  }
  return Promise.resolve({ data: null, error: null });
}

// ── Channels ──────────────────────────────────────────────────
function showcaseChannel() {
  const channelKey = {};
  const chan = {
    on(_type: string, opts: { event?: string; table?: string } | ((p: unknown) => void), cb?: (p: unknown) => void) {
      const options = typeof opts === 'function' ? {} : opts ?? {};
      const callback = (typeof opts === 'function' ? opts : cb) as ((p: ChangeEvent) => void) | undefined;
      if (callback) {
        subs.push({ id: ++subSeq, table: options.table, event: options.event ?? '*', cb: callback, channelKey });
      }
      return chan;
    },
    subscribe(cb?: (status: string) => void) { cb?.('SUBSCRIBED'); return chan; },
    unsubscribe() { removeByKey(channelKey); return Promise.resolve('ok'); },
    _key: channelKey,
  };
  return chan;
}

function removeByKey(key: object) {
  for (let i = subs.length - 1; i >= 0; i--) {
    if (subs[i].channelKey === key) subs.splice(i, 1);
  }
}

// ── Client ────────────────────────────────────────────────────
let _client: SupabaseClient | null = null;
let _showcase: SupabaseClient | null = null;

function buildShowcaseClient(): SupabaseClient {
  getBC();
  const fake = {
    from: (table: string) => new ShowcaseQuery(table),
    rpc: (fn: string, args: Record<string, unknown>) => showcaseRpc(fn, args),
    channel: () => showcaseChannel(),
    removeChannel: (chan: { _key?: object }) => { if (chan?._key) removeByKey(chan._key); },
  };
  return fake as unknown as SupabaseClient;
}

export function getSupabase(): SupabaseClient {
  if (!isShowcaseMode) {
    if (!_client) {
      _client = createClient(ENV_URL!, ENV_KEY!, {
        realtime: { params: { eventsPerSecond: 10 } },
      });
    }
    return _client;
  }
  if (!_showcase) _showcase = buildShowcaseClient();
  return _showcase;
}

// Default export for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string];
  },
});
