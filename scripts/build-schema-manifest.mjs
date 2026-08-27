#!/usr/bin/env node
/**
 * build-schema-manifest — the checked-in SQL becomes the shim's law
 * =================================================================
 * U2 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
 *
 * Parses `app/supabase/schema.sql` plus every migration in the STANDARD
 * apply order (README.md: schema → 001 → 002 → policies) and emits
 * `app/lib/schema-manifest.generated.ts` — tables, columns, types,
 * NOT NULL, defaults, CHECK / UNIQUE / PK / FK — which the in-memory
 * showcase shim (`app/lib/supabase.ts`) ENFORCES. A column the app
 * writes that no migration declares now fails in the showcase with
 * PostgREST's own error, which is how defect #1 (six missing columns,
 * silent 400 on every Present toggle) becomes impossible to reintroduce.
 *
 * THE PARSER IS BOUNDED AND LOUD. It handles the statement shapes these
 * four files actually contain and THROWS on anything it does not
 * recognise. A parser that silently skips a statement is a manifest
 * that lies — the exact failure being fixed.
 *
 * Modes:
 *   node scripts/build-schema-manifest.mjs           # write the manifest
 *   node scripts/build-schema-manifest.mjs --check   # fail on drift
 *
 * `--check` regenerates into memory and diffs against the committed
 * file: one source of truth, enforced. Wired into `npm run lint` and
 * `npm run prebuild` as `schema:check`.
 *
 * A migration whose header declares itself excluded from the standard
 * apply order (U10's optional idea_no file) is SKIPPED and the skip is
 * printed — the manifest describes the schema a normal deployment runs.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const SQL_DIR = path.join(REPO, "app", "supabase");
const MIGRATIONS_DIR = path.join(SQL_DIR, "migrations");
const OUT_PATH = path.join(REPO, "app", "lib", "schema-manifest.generated.ts");

const CHECK_MODE = process.argv.includes("--check");

/** A migration authored as an unapplied escape hatch opts out of the
    standard order in its own header (see README.md's file table). */
const EXCLUDED_MARKER = /excluded from the standard (apply )?order|not part of the standard apply order/i;

// ── SQL text utilities ───────────────────────────────────────

/**
 * Split a SQL file into statements on `;`, respecting single-quoted
 * strings, dollar-quoted bodies ($$ … $$ or $tag$ … $tag$) and `--`
 * comments. Comments are stripped; statement text keeps its original
 * spacing otherwise.
 */
function splitStatements(sql, file) {
  const statements = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    // -- comment to end of line
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    // single-quoted string ('' is the escape)
    if (c === "'") {
      current += c;
      i++;
      while (i < sql.length) {
        current += sql[i];
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            current += sql[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    // dollar-quoted body
    if (c === "$") {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end === -1) throw new Error(`${file}: unterminated dollar quote ${tag}`);
        current += sql.slice(i, end + tag.length);
        i = end + tag.length;
        continue;
      }
    }
    if (c === ";") {
      const s = current.trim();
      if (s) statements.push(s);
      current = "";
      i++;
      continue;
    }
    current += c;
    i++;
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/** Collapse whitespace for classification. Quoted content in these
    files never carries load-bearing whitespace runs. */
function flat(statement) {
  return statement.replace(/\s+/g, " ").trim();
}

/** Split `a, b, check (x in ('p','q'))` on top-level commas only. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      current += c;
      if (c === "'") inQuote = false;
      continue;
    }
    if (c === "'") { inQuote = true; current += c; continue; }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// ── Piece parsers ────────────────────────────────────────────

/** `default <expr>` → a tagged default the shim can materialise. */
function parseDefault(expr, context) {
  const e = expr.trim();
  if (/^gen_random_uuid\(\)$/i.test(e)) return { kind: "uuid" };
  if (/^now\(\)$/i.test(e)) return { kind: "now" };
  if (e === "'{}'") return { kind: "literal", value: [] };
  if (/^true$/i.test(e)) return { kind: "literal", value: true };
  if (/^false$/i.test(e)) return { kind: "literal", value: false };
  const str = /^'([^']*)'$/.exec(e);
  if (str) return { kind: "literal", value: str[1] };
  if (/^-?\d+(\.\d+)?$/.test(e)) return { kind: "literal", value: Number(e) };
  throw new Error(`Unrecognised DEFAULT expression at ${context}: ${e}`);
}

/**
 * Compile a CHECK expression to the one shape the shim evaluates:
 * a per-column allowed-value list. SQL's own semantics make the two
 * source shapes equivalent — a NULL operand makes `col in (...)`
 * evaluate to NULL, which CHECK treats as pass — so both compile to
 * the same spec and NOT NULL stays a separate law.
 *   col in ('a', 'b')
 *   col is null or col in ('a', 'b')
 */
function compileCheck(expr, context) {
  const e = flat(expr);
  let m = /^([A-Za-z_]\w*) is null or \1 in \(([^)]*)\)$/i.exec(e);
  if (!m) m = /^([A-Za-z_]\w*) in \(([^)]*)\)$/i.exec(e);
  if (!m) throw new Error(`Unrecognised CHECK expression at ${context}: ${e}`);
  const allowed = [...m[2].matchAll(/'([^']*)'/g)].map((q) => q[1]);
  if (!allowed.length) throw new Error(`CHECK with no quoted values at ${context}: ${e}`);
  return { column: m[1], allowed };
}

const TYPE_RE = /^(uuid|text|int|integer|bigint|boolean|timestamptz|numeric)(\[\])?$/i;

/**
 * One column definition from a CREATE TABLE body or ADD COLUMN clause:
 * `name type [primary key] [not null] [unique] [default …]
 *  [references t(c) [on delete cascade]] [check (…)]` in any order.
 */
function parseColumnDef(def, table, out, context) {
  const m = /^([A-Za-z_]\w*)\s+(\S+)\s*(.*)$/s.exec(def.trim());
  if (!m) throw new Error(`Unparseable column definition at ${context}: ${def}`);
  const [, name, rawType] = m;
  let rest = flat(m[3]);
  if (!TYPE_RE.test(rawType)) {
    throw new Error(`Unrecognised column type at ${context}: ${name} ${rawType}`);
  }
  const column = { type: rawType.toLowerCase(), notNull: false, default: null };
  const eat = (re) => {
    const hit = re.exec(rest);
    if (hit) rest = (rest.slice(0, hit.index) + rest.slice(hit.index + hit[0].length)).trim();
    return hit;
  };

  if (eat(/\bprimary key\b/i)) {
    out.primaryKey.push(name);
    column.notNull = true;
  }
  if (eat(/\bnot null\b/i)) column.notNull = true;
  if (eat(/\bunique\b/i)) out.uniques.push({ name: `${table}_${name}_key`, columns: [name] });

  const def_ = eat(/\bdefault ('[^']*'|[A-Za-z_]+\(\)|true|false|-?\d+(?:\.\d+)?)/i);
  if (def_) column.default = parseDefault(def_[1], `${context}.${name}`);

  const ref = eat(/\breferences ([A-Za-z_]\w*) ?\( ?([A-Za-z_]\w*) ?\)( on delete cascade)?/i);
  if (ref) {
    out.foreignKeys.push({
      name: `${table}_${name}_fkey`,
      column: name,
      refTable: ref[1],
      refColumn: ref[2],
      onDelete: ref[3] ? "cascade" : "no action",
    });
  }

  const chk = eat(/\bcheck \((.*)\)$/i);
  if (chk) {
    const spec = compileCheck(chk[1], `${context}.${name}`);
    out.checks.push({ name: `${table}_${name}_check`, ...spec });
  }

  if (rest) throw new Error(`Leftover column tokens at ${context}.${name}: "${rest}"`);
  out.columns[name] = column;
}

// ── Statement dispatch ───────────────────────────────────────

function newTable() {
  return { columns: {}, primaryKey: [], uniques: [], checks: [], foreignKeys: [] };
}

function buildManifest(sources) {
  const tables = {};
  const functions = [];
  const rlsTables = new Set();

  const requireTable = (name, context) => {
    const t = tables[name];
    if (!t) throw new Error(`Statement at ${context} names unknown table "${name}"`);
    return t;
  };

  for (const { file, sql } of sources) {
    for (const statement of splitStatements(sql, file)) {
      const s = flat(statement);
      const context = `${file}: "${s.slice(0, 60)}…"`;
      let m;

      // create table t ( … )
      if ((m = /^create table ([A-Za-z_]\w*) \((.*)\)$/is.exec(s))) {
        const [, name, body] = m;
        if (tables[name]) throw new Error(`Duplicate create table at ${context}`);
        const t = newTable();
        for (const part of splitTopLevel(body)) {
          const uq = /^unique ?\(([^)]*)\)$/i.exec(part.trim());
          if (uq) {
            const cols = uq[1].split(",").map((c) => c.trim());
            t.uniques.push({ name: `${name}_${cols.join("_")}_key`, columns: cols });
            continue;
          }
          parseColumnDef(part, name, t, context);
        }
        tables[name] = t;
        continue;
      }

      // alter table t add column [if not exists] …
      if ((m = /^alter table ([A-Za-z_]\w*) add column (?:if not exists )?(.*)$/i.exec(s))) {
        const t = requireTable(m[1], context);
        // idempotent re-parse: ADD COLUMN IF NOT EXISTS re-run over an
        // existing manifest column must converge, so overwrite in place.
        parseColumnDef(m[2], m[1], t, context);
        continue;
      }

      // alter table t drop constraint [if exists] name
      if ((m = /^alter table ([A-Za-z_]\w*) drop constraint (?:if exists )?([A-Za-z_]\w*)$/i.exec(s))) {
        const t = requireTable(m[1], context);
        t.checks = t.checks.filter((c) => c.name !== m[2]);
        continue;
      }

      // alter table t add constraint name check ( … )
      if ((m = /^alter table ([A-Za-z_]\w*) add constraint ([A-Za-z_]\w*) check \((.*)\)$/i.exec(s))) {
        const t = requireTable(m[1], context);
        if (t.checks.some((c) => c.name === m[2])) throw new Error(`Duplicate constraint at ${context}`);
        t.checks.push({ name: m[2], ...compileCheck(m[3], context) });
        continue;
      }

      // alter table t replica identity full — realtime posture, no shape
      if ((m = /^alter table ([A-Za-z_]\w*) replica identity (full|default)$/i.exec(s))) {
        requireTable(m[1], context);
        continue;
      }

      // alter table t enable row level security — policy coverage record
      if ((m = /^alter table ([A-Za-z_]\w*) enable row level security$/i.exec(s))) {
        requireTable(m[1], context);
        rlsTables.add(m[1]);
        continue;
      }

      // create function — the shim's known-RPC set
      if ((m = /^create (?:or replace )?function ([A-Za-z_]\w*) ?\(/i.exec(s))) {
        if (!functions.includes(m[1])) functions.push(m[1]);
        continue;
      }

      // recognised, deliberately shape-free statements
      if (/^create (?:unique )?index /i.test(s)) continue;
      if (/^alter publication /i.test(s)) continue;
      if ((m = /^insert into ([A-Za-z_]\w*)[ (]/i.exec(s))) { requireTable(m[1], context); continue; }
      if (/^(drop|create) policy /i.test(s)) continue;
      if (/^revoke /i.test(s)) continue;
      if (/^grant /i.test(s)) continue;

      throw new Error(`Unrecognised SQL statement — extend the parser rather than letting it lie.\n  ${context}`);
    }
  }

  // Policy coverage: a table with RLS on and no policy renders a blank,
  // error-free workshop; a table missing from policies.sql entirely is
  // the same failure one file earlier. Both directions must hold.
  const tableNames = Object.keys(tables);
  const missingRls = tableNames.filter((t) => !rlsTables.has(t));
  if (missingRls.length) {
    throw new Error(`policies.sql does not enable row level security on: ${missingRls.join(", ")}`);
  }
  for (const t of rlsTables) {
    if (!tables[t]) throw new Error(`policies.sql enables RLS on unknown table "${t}"`);
  }

  return { tables, functions };
}

// ── Emit ─────────────────────────────────────────────────────

function emit(manifest, sources) {
  const sourceList = sources.map((s) => ` *   ${s.file}`).join("\n");
  return `// ============================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
// ============================================================
// Generated by scripts/build-schema-manifest.mjs from the deployment
// SQL in the STANDARD apply order (app/supabase/README.md):
/*
${sourceList}
 */
// Regenerate with \`npm run schema:build\`; \`npm run schema:check\`
// fails the build when this file and the SQL diverge. The showcase shim
// (lib/supabase.ts) enforces everything in here, so the SQL the
// deployment team applies and the schema the showcase runs against are
// the same fact. U2 of
// docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
// ============================================================

export type ColumnDefault =
  | { kind: "uuid" }
  | { kind: "now" }
  | { kind: "literal"; value: string | number | boolean | string[] };

export type ColumnSpec = {
  type: string;
  notNull: boolean;
  default: ColumnDefault | null;
};

/** \`col in (…)\`, with SQL's own null semantics: a null value passes
    the CHECK (NOT NULL is a separate law). */
export type CheckSpec = { name: string; column: string; allowed: string[] };

export type UniqueSpec = { name: string; columns: string[] };

export type ForeignKeySpec = {
  name: string;
  column: string;
  refTable: string;
  refColumn: string;
  onDelete: "cascade" | "no action";
};

export type TableSpec = {
  columns: Record<string, ColumnSpec>;
  primaryKey: string[];
  uniques: UniqueSpec[];
  checks: CheckSpec[];
  foreignKeys: ForeignKeySpec[];
};

export const SCHEMA_TABLES: Record<string, TableSpec> = ${JSON.stringify(manifest.tables, null, 2)};

/** Every function the SQL declares — the shim's known-RPC set. An RPC
    outside this list fails with PGRST202 instead of silently succeeding. */
export const SCHEMA_FUNCTIONS: readonly string[] = ${JSON.stringify(manifest.functions)};
`;
}

// ── Team seed ↔ config (D-7: one source of team identity) ────
//
// `GROUPS` in app/lib/config.ts is the single source of team identity.
// The schema.sql teams seed is a hand-copied mirror of it (SQL cannot
// import TS), so this check makes the copy IMPOSSIBLE to get wrong
// silently: a fresh deploy showing "Team A" on DB-driven surfaces
// while the medallions show config's names was the audited failure.
// Bounded and loud, like the SQL parser above.

function parseConfigGroups(configTs) {
  const groups = [];
  const re =
    /slug:\s*'([^']+)'\s*as\s*const,\s*name:\s*'([^']+)',[^}]*?color:\s*'([^']+)',\s*defaultPillars:\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(configTs))) {
    groups.push({
      slug: m[1],
      name: m[2],
      color: m[3],
      pillars: [...m[4].matchAll(/'([^']+)'/g)].map((p) => p[1]),
    });
  }
  if (groups.length === 0) {
    throw new Error("could not parse GROUPS from app/lib/config.ts — the D-7 seed check needs updating, not skipping.");
  }
  return groups;
}

function parseTeamSeed(schemaSql) {
  const m = /insert into teams \(name, slug, display_name, color, assigned_pillars\) values\s*([\s\S]*?);/i.exec(schemaSql);
  if (!m) {
    throw new Error("could not find the teams seed insert in schema.sql — the D-7 seed check needs updating, not skipping.");
  }
  const rows = [];
  const rowRe = /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*array\[([^\]]*)\]\)/g;
  let r;
  while ((r = rowRe.exec(m[1]))) {
    rows.push({
      name: r[1],
      slug: r[2],
      display_name: r[3],
      color: r[4],
      pillars: [...r[5].matchAll(/'([^']+)'/g)].map((p) => p[1]),
    });
  }
  return rows;
}

async function checkTeamSeedMatchesConfig(schemaSql) {
  const configTs = await readFile(path.join(REPO, "app", "lib", "config.ts"), "utf8");
  const groups = parseConfigGroups(configTs);
  const seed = parseTeamSeed(schemaSql);
  const problems = [];
  if (groups.length !== seed.length) {
    problems.push(`config has ${groups.length} teams, the schema.sql seed has ${seed.length}`);
  }
  for (const g of groups) {
    const row = seed.find((s) => s.slug === g.slug);
    if (!row) {
      problems.push(`config team '${g.slug}' (${g.name}) has no seed row`);
      continue;
    }
    if (row.name !== g.name) problems.push(`'${g.slug}' name: config '${g.name}' vs seed '${row.name}'`);
    if (row.display_name !== g.name) problems.push(`'${g.slug}' display_name: config '${g.name}' vs seed '${row.display_name}'`);
    if (row.color.toUpperCase() !== g.color.toUpperCase()) problems.push(`'${g.slug}' color: config '${g.color}' vs seed '${row.color}'`);
    if (row.pillars.join(",") !== g.pillars.join(",")) problems.push(`'${g.slug}' pillars: config [${g.pillars}] vs seed [${row.pillars}]`);
  }
  for (const s of seed) {
    if (!groups.find((g) => g.slug === s.slug)) problems.push(`seed row '${s.slug}' (${s.name}) is not in config GROUPS`);
  }
  if (problems.length) {
    throw new Error(`teams seed in schema.sql has drifted from GROUPS in app/lib/config.ts:\n  ${problems.join("\n  ")}\n  Edit lib/config.ts first; copy the values into the seed.`);
  }
  console.log(`✓ teams seed matches config GROUPS — ${groups.length} teams`);
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const files = [path.join(SQL_DIR, "schema.sql")];
  const migrationNames = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const name of migrationNames) {
    const full = path.join(MIGRATIONS_DIR, name);
    const head = (await readFile(full, "utf8")).slice(0, 2500);
    if (EXCLUDED_MARKER.test(head)) {
      console.log(`  · skipped ${name} (excluded from the standard apply order)`);
      continue;
    }
    files.push(full);
  }
  files.push(path.join(SQL_DIR, "policies.sql"));

  const sources = [];
  for (const full of files) {
    // POSIX-normalize so a Windows-built manifest matches Linux CI byte-for-byte
    sources.push({ file: path.relative(REPO, full).split(path.sep).join("/"), sql: await readFile(full, "utf8") });
  }

  const manifest = buildManifest(sources);
  const content = emit(manifest, sources);

  await checkTeamSeedMatchesConfig(sources[0].sql);

  const tableCount = Object.keys(manifest.tables).length;
  const columnCount = Object.values(manifest.tables).reduce(
    (n, t) => n + Object.keys(t.columns).length, 0,
  );

  if (CHECK_MODE) {
    let committed = null;
    try {
      committed = await readFile(OUT_PATH, "utf8");
    } catch {
      console.error(`✗ ${path.relative(REPO, OUT_PATH)} does not exist — run \`npm run schema:build\``);
      process.exit(1);
    }
    if (committed !== content) {
      const a = committed.split("\n");
      const b = content.split("\n");
      let line = 0;
      while (line < Math.max(a.length, b.length) && a[line] === b[line]) line++;
      console.error("✗ schema manifest DRIFT — the SQL and the committed manifest disagree.");
      console.error(`  first divergence at line ${line + 1}:`);
      console.error(`    committed : ${a[line] ?? "<missing>"}`);
      console.error(`    from SQL  : ${b[line] ?? "<missing>"}`);
      console.error("  Run `npm run schema:build` and commit the result — or fix the SQL.");
      process.exit(1);
    }
    console.log(`✓ schema manifest matches the SQL — ${tableCount} tables, ${columnCount} columns, ${manifest.functions.length} functions`);
    return;
  }

  await writeFile(OUT_PATH, content);
  console.log(`✓ wrote ${path.relative(REPO, OUT_PATH)} — ${tableCount} tables, ${columnCount} columns, functions: ${manifest.functions.join(", ")}`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
