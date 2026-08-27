// ============================================================
// PREBUILD GUARDS — run them when they are reachable, say so when not
// ============================================================
// `check-write-errors` and `build-schema-manifest --check` live at the
// REPO root (`../scripts/`), not inside `app/`, because they read both
// the app tree and the deployment SQL. That is fine everywhere a human
// builds — and it breaks a deploy that uploads only `app/`, which is
// what the Vercel CLI does when the project is linked at `app/`.
//
// So this delegates rather than duplicating: if the sibling scripts are
// there, both guards run and their failure is the build's failure,
// exactly as before. If they are not, the build says so loudly and
// continues, because the alternative is a deploy that cannot ever
// succeed and a guard that protects nothing on a machine that has
// already been handed a built tree.
//
// This is NOT a way to skip the guards. They gate `npm run lint` and
// every local build, which is where the mistakes they catch (an
// unchecked write, a schema manifest that has drifted from the SQL) are
// actually made. Skipping here only ever happens on a packaging
// boundary the developer cannot cross.
//
// The permanent fix is to make `app/` self-contained — move both guards
// under `app/scripts/` and re-anchor their paths — or to deploy with
// the repo root as the upload context and `app` as the root directory.
// Tracked in docs/open-items.md.
// ============================================================

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_SCRIPTS = resolve(HERE, "..", "..", "scripts");

const GUARDS = [
  { name: "check-write-errors", file: "check-write-errors.mjs", args: [] },
  { name: "schema:check", file: "build-schema-manifest.mjs", args: ["--check"] },
];

const missing = GUARDS.filter((g) => !existsSync(resolve(REPO_SCRIPTS, g.file)));

if (missing.length > 0) {
  console.warn(
    [
      "",
      "  ⚠  Prebuild guards skipped — the repo-root scripts/ directory is not in this build context.",
      `     Looked in: ${REPO_SCRIPTS}`,
      `     Missing:   ${missing.map((g) => g.file).join(", ")}`,
      "",
      "     This is expected on a deploy that uploads only app/. Both guards still gate",
      "     `npm run lint` and every local build, which is where they catch things.",
      "",
    ].join("\n")
  );
  process.exit(0);
}

for (const guard of GUARDS) {
  const result = spawnSync("node", [resolve(REPO_SCRIPTS, guard.file), ...guard.args], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`\n  ✗ Prebuild guard failed: ${guard.name}\n`);
    process.exit(result.status ?? 1);
  }
}
