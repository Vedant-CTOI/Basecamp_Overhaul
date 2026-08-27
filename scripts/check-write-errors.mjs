#!/usr/bin/env node
/**
 * check-write-errors — every mutating call site goes through lib/db.ts
 * ====================================================================
 * U3 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
 *
 * ~70 call sites cannot be held to a convention by review alone, and an
 * ESLint rule would be heavier than the problem. This walks the app's
 * source, finds every `.from("table")` chain that ends in a mutating
 * verb and every `.rpc(...)`, and fails when one is not wrapped in
 * `write(...)` from `lib/db.ts`.
 *
 * A site where fire-and-forget is genuinely correct opts out ON THE
 * RECORD, with the reason in the source:
 *
 *   // write-unchecked: <why this one may not be checked>
 *
 * ONE HOUSE RULE it depends on: a `write<T>()` type argument must not
 * contain braces. The statement scan walks back to the nearest `;{}`,
 * so `write<{ id: string }>(…)` hides its own call. Name the type, or
 * leave the result `unknown` — both call sites that wanted one did.
 *
 * Run: node scripts/check-write-errors.mjs
 * Wired into `npm run lint` and `npm run prebuild` in app/package.json,
 * so an unchecked write is a build failure rather than a future
 * incident.
 *
 * Backend-agnostic: it checks a code convention, not a database.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..", "app");

/** The app's own source. `scripts/` is excluded deliberately: those are
    service-role node scripts that already print their own errors and
    never run in front of the room. */
const ROOTS = ["app", "components", "lib"];

/** lib/supabase.ts DEFINES the client (and the showcase shim's own
    store writes); lib/db.ts IS the wrapper. Neither can route through
    itself. */
const EXEMPT_FILES = new Set([
  path.join("lib", "supabase.ts"),
  path.join("lib", "db.ts"),
]);

const MUTATORS = new Set(["insert", "update", "upsert", "delete"]);
const OPT_OUT = /\/\/\s*write-unchecked:/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

/** Skip a balanced `( … )` starting at `i` (which must be the paren),
    respecting strings, template literals and comments. Returns the
    index just past the closing paren, or -1 if unbalanced. */
function skipParens(src, i) {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      j++;
      while (j < src.length && src[j] !== quote) {
        if (src[j] === "\\") j++;
        j++;
      }
      continue;
    }
    if (c === "/" && src[j + 1] === "/") {
      while (j < src.length && src[j] !== "\n") j++;
      continue;
    }
    if (c === "/" && src[j + 1] === "*") {
      j = src.indexOf("*/", j + 2);
      if (j === -1) return -1;
      j++;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

/** Walk the method chain that starts just past `.from(…)` and collect
    the method names, so `.eq(…).select(…)` between `from` and `update`
    does not hide the write. */
function chainMethods(src, start) {
  const methods = [];
  let i = start;
  for (let guard = 0; guard < 40; guard++) {
    while (i < src.length && /[\s\n\r]/.test(src[i])) i++;
    if (src[i] !== ".") break;
    let j = i + 1;
    while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
    const name = src.slice(i + 1, j);
    while (j < src.length && /[\s\n\r]/.test(src[j])) j++;
    if (src[j] !== "(") break;
    const after = skipParens(src, j);
    if (after === -1) break;
    methods.push(name);
    i = after;
  }
  return methods;
}

/** The statement the call site sits in: everything back to the nearest
    `;`, `{`, `}` or start of file. Payload braces come AFTER the verb,
    so walking backwards from the chain head never enters one. */
function statementBefore(src, index) {
  let i = index;
  while (i > 0 && !";{}".includes(src[i - 1])) i--;
  return src.slice(i, index);
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

function lineTextAround(src, index) {
  const from = src.lastIndexOf("\n", index) + 1;
  const to = src.indexOf("\n", index);
  const line = src.slice(from, to === -1 ? src.length : to);
  const prevFrom = src.lastIndexOf("\n", from - 2) + 1;
  const prev = src.slice(prevFrom, Math.max(prevFrom, from - 1));
  return `${prev}\n${line}`;
}

/** `write(` or `write<T>(` — the type argument is common on RPCs, whose
    result the caller actually reads. */
const WRITE_CALL = /\bwrite\s*(?:<[^()<>]*>)?\s*\(/;

/** Is this call site routed through the wrapper? `write(` must open
    before the chain head inside the same statement. */
function isRouted(statement) {
  return WRITE_CALL.test(statement);
}

/** The one legal indirection: a builder assembled into a local because
    a clause is conditional (the open card's `updated_at` precondition),
    then handed to `write()`. The binding must reach a `write(` call. */
function isRoutedViaBinding(statement, src, index) {
  const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^=]/.exec(statement);
  if (!m) return false;
  const name = m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\bwrite\\s*(?:<[^()<>]*>)?\\s*\\([^;]*\\b${name}\\b`).test(src.slice(index));
}

const offences = [];
let sites = 0;
let routed = 0;
let excused = 0;

/** The service-role fence (U1 follow-up). `lib/supabase-server.ts`
    holds the client that carries SUPABASE_SERVICE_ROLE_KEY, and the key
    must never reach a browser bundle. The module already throws at
    import time in a browser; this makes the same rule a BUILD failure:
    nothing under `components/`, and no `"use client"` module anywhere,
    may import it. Server routes and server components only. */
const SERVER_CLIENT_IMPORT = /from\s+["'](?:@\/lib\/supabase-server|\.{1,2}\/(?:\.\.\/)*lib\/supabase-server|\.\/supabase-server)["']/;
const USE_CLIENT = /^\s*["']use client["']/m;

for (const root of ROOTS) {
  for await (const file of walk(path.join(APP, root))) {
    const rel = path.relative(APP, file);
    if (EXEMPT_FILES.has(rel)) continue;
    const src = await readFile(file, "utf8");

    if (SERVER_CLIENT_IMPORT.test(src) && rel !== path.join("lib", "supabase-server.ts")) {
      const clientish = USE_CLIENT.test(src) || rel.startsWith("components" + path.sep);
      if (clientish) {
        offences.push(
          `${rel} — imports lib/supabase-server from browser code; the service-role key must never reach the client bundle`,
        );
      }
    }

    const record = (index, what) => {
      sites++;
      const statement = statementBefore(src, index);
      if (isRouted(statement) || isRoutedViaBinding(statement, src, index)) {
        routed++;
        return;
      }
      if (OPT_OUT.test(lineTextAround(src, index)) || OPT_OUT.test(statement)) {
        excused++;
        return;
      }
      offences.push(`${rel}:${lineOf(src, index)} — ${what} not routed through write() from lib/db.ts`);
    };

    // `.from("table")` chains ending in a mutating verb.
    const fromRe = /\.from\(\s*["'`]([A-Za-z0-9_]+)["'`]\s*\)/g;
    let m;
    while ((m = fromRe.exec(src))) {
      const methods = chainMethods(src, m.index + m[0].length);
      const verb = methods.find((name) => MUTATORS.has(name));
      if (!verb) continue;
      record(m.index, `${m[1]}.${verb}()`);
    }

    // `.rpc("name", …)` — every RPC in this app mutates.
    const rpcRe = /\.rpc\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;
    while ((m = rpcRe.exec(src))) {
      record(m.index, `rpc ${m[1]}()`);
    }
  }
}

console.log(`check-write-errors — ${sites} mutating call sites`);
console.log(`  routed through write() : ${routed}`);
console.log(`  excused on the record  : ${excused}`);
console.log(`  unchecked              : ${offences.length}`);
if (offences.length) {
  console.log("");
  offences.forEach((o) => console.log(`  ✗ ${o}`));
  console.log(
    "\nEvery mutating call must be `await write(\"table.verb:intent\", supabase.from(…)…)`,\n" +
      "or carry `// write-unchecked: <reason>` on the line above it.",
  );
  process.exit(1);
}
console.log("\n✓ no write can fail silently");
