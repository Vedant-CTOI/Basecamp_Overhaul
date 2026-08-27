/**
 * Team palette study — LAB / RENDER ONLY
 * ======================================
 * A deciding room, not a change. Three candidate team palettes plus the
 * shipped control, rendered across the REAL surfaces by temporarily
 * overriding `GROUPS` in `app/lib/config.ts`, screenshotting the running
 * dev server, and restoring the file from git in a `finally` block.
 *
 * The problem under test (docs/ogilvy-showcase-direction.md):
 *   - `lib/config.ts` says "Red is never a team color", yet Touffou ships
 *     #DA291C — ΔE 15 from the platform's #EB3F43.
 *   - Baskerville ships #8A8689, the EXACT neutral used for category
 *     chips — ΔE 0. The team has no identity.
 *   - A visual review had to dim Stage spines to 55% and force white type
 *     in the Control Strip largely because of those two facts.
 *
 * Surfaces (both registers, per the direction doc):
 *   1. Board hero band, all three teams — paper register, luminance-aware text
 *   2. Stage presenting — spines at their shipped 55% + the stacked queue
 *   3. Stage returns / leader
 *   4. Newsroom team rows + category breakdown
 *   5. Team-select medallions
 * 1600×1000 desk pass + a 1280×720 projector pass on the Stage.
 *
 * Usage:
 *   node scripts/palette-study.mjs [probe|all] [baseUrl]
 *
 * Playwright resolution follows visual-qa-board-stage-newsroom.mjs.
 */

import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const CONFIG = path.join(REPO, "app", "lib", "config.ts");
const OUT_DIR = path.join(REPO, "output", "playwright", "palette-study");
const SHEET_PATH = path.join(REPO, "docs", "team-palette-options.png");

const MODE = process.argv[2] || "all";
const BASE = process.argv[3] || "http://localhost:3005";

const EXECUTABLE =
  process.env.CHROME_HEADLESS_SHELL ||
  "/Users/bidnamlee/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const DESK = { width: 1600, height: 1000 };
const PROJECTOR = { width: 1280, height: 720 };

// ── The candidates ───────────────────────────────────────────
// Hathaway / Touffou / Baskerville. Measurements in the comments are
// from the CIE Lab pass: ΔE against the platform red #EB3F43, against the
// category-chip neutral #8A8689, and the 55%-opacity spine's contrast
// against the Stage ground #0A0A0C.
const PALETTES = [
  {
    id: "control",
    label: "CONTROL — shipped",
    rationale:
      "What ships today: cobalt, Pantone 485 and the category-chip neutral. Touffou sits ΔE 15 from the platform red and Baskerville ΔE 0 from the chip it has to be told apart from.",
    colors: ["#2438D6", "#DA291C", "#8A8689"],
  },
  {
    id: "heritage",
    label: "A — Heritage",
    rationale:
      "Ogilvy's own heritage colours moved off the brand red: cobalt holds, Pantone 485 is deepened into oxblood so it stops competing with #EB3F43 (ΔE 15 → 40), and Baskerville takes the warm stone of the paper stock instead of the cool chip grey (ΔE 0 → 38).",
    colors: ["#2438D6", "#8E2740", "#B08A4F"],
  },
  {
    id: "tonal",
    label: "B — Tonal blue",
    rationale:
      "Concede the whole warm end to the platform: three steps of the one hue Ogilvy owns besides red — bright cobalt, the heritage blue itself, and a pale slate — so nothing on any surface can be mistaken for the voice.",
    colors: ["#3D5AF1", "#24298F", "#9FB2D9"],
  },
  {
    id: "inkpaper",
    label: "C — Ink & paper",
    rationale:
      "Build the teams from the identity's own non-red anchors: one hue (cobalt), the ink, and the paper stock — the widest identity spread of the three (inter-team ΔE 97/115/77) and the most Ogilvy-native reading.",
    colors: ["#2438D6", "#231F20", "#E6E0D4"],
  },
];

const TEAMS = [
  { slug: "group-1", name: "Hathaway" },
  { slug: "group-2", name: "Touffou" },
  { slug: "group-3", name: "Baskerville" },
];

// ── Palette override (temporary; always restored) ────────────
const GROUP_LINE = /(\s*'group-(\d)':\s*\{[^}]*?color:\s*')(#[0-9A-Fa-f]{6})(')/g;

async function applyPalette(colors) {
  const src = await readFile(CONFIG, "utf8");
  let hits = 0;
  const next = src.replace(GROUP_LINE, (_m, head, n, _old, tail) => {
    hits += 1;
    return `${head}${colors[Number(n) - 1]}${tail}`;
  });
  if (hits !== 3) throw new Error(`Expected 3 GROUPS colour sites, rewrote ${hits}. Aborting without touching config.`);
  await writeFile(CONFIG, next, "utf8");
}

function restoreConfig() {
  execFileSync("git", ["-C", REPO, "checkout", "--", "app/lib/config.ts"], { stdio: "pipe" });
}

const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

/** Wait for the dev server to have recompiled with the new palette: poll
 *  the Newsroom's own identity spines until they report the new hues. */
async function waitForPalette(browser, colors) {
  const want = colors.map(rgbOf);
  const context = await browser.newContext({ viewport: PROJECTOR, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    for (let attempt = 0; attempt < 24; attempt++) {
      await page.goto(`${BASE}/big-board`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector('[data-qa="team-row"]', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(900);
      const seen = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-qa="team-row"]')).map(
          (r) => getComputedStyle(r.firstElementChild).backgroundColor,
        ),
      );
      if (seen.length === 3 && seen.every((c, i) => c === want[i])) return true;
      await page.waitForTimeout(1200);
    }
    throw new Error(`Dev server never picked up palette ${colors.join(" ")}`);
  } finally {
    await page.close();
    await context.close();
  }
}

// ── Playwright resolution ────────────────────────────────────
async function loadChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "playwright",
    path.resolve(REPO, "..", "sprite-workshop", "node_modules", "playwright"),
  ].filter(Boolean);
  const failures = [];
  const require = createRequire(import.meta.url);
  for (const candidate of candidates) {
    try {
      const mod = candidate.startsWith("/") ? require(candidate) : await import(candidate);
      if (mod.chromium) return mod.chromium;
    } catch (err) {
      failures.push(`${candidate}: ${err.message.split("\n")[0]}`);
    }
  }
  throw new Error(`Could not resolve playwright.\n  ${failures.join("\n  ")}`);
}

const captures = new Map(); // `${paletteId}:${shot}` -> file

async function hideDevChrome(page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function shoot(paletteId, shot, page, clip) {
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${paletteId}--${shot}.png`);
  await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
  captures.set(`${paletteId}:${shot}`, file);
  return file;
}

// ── Surface 1: the Board hero band (paper register) ──────────
async function shootBoards(browser, palette) {
  const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    for (const team of TEAMS) {
      await page.goto(`${BASE}/${team.slug}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForSelector('[data-qa="board-hero"]', { timeout: 60000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1800);
      // The band plus the category tabs beneath it: the paper register's
      // whole colour decision, including the ink-vs-white ruling.
      await shoot(palette.id, `board-${team.slug}`, page, { x: 0, y: 0, width: DESK.width, height: 300 });
    }
  } finally {
    await page.close();
    await context.close();
  }
}

// ── Surfaces 2–3: the Stage (dark register) ──────────────────
async function openStage(browser, size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-qa="active-team"]', { timeout: 60000 });
  await hideDevChrome(page);
  await page.waitForTimeout(1600);
  return { context, page };
}

const cardCount = (page) => page.evaluate(() => document.querySelectorAll('[data-qa="stage-card"]').length);

/** The real path to a full wall: drop the presenting flag so the gate
 *  falls back to every active idea the team holds.
 *
 *  "On the Stage" TOGGLES, so the same click either releases the gate or
 *  narrows it to the one card just flagged — which is how candidate B
 *  first came back with a one-card wall while the others had three. The
 *  toggle is therefore applied against a measured count and reversed if
 *  the wall got smaller, so every palette is compared on the same wall. */
async function releasePresentGate(page) {
  const before = await cardCount(page);
  const toggle = async () => {
    await page.locator('[data-qa="stage-card"]').first().click();
    await page.waitForTimeout(800);
    await page.locator("button", { hasText: "On the Stage" }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
  };
  await toggle();
  if ((await cardCount(page)) < before) {
    await toggle();
    await page.waitForTimeout(600);
  }
}

async function shootStagePresenting(browser, palette, size, shot) {
  const { context, page } = await openStage(browser, size);
  try {
    await releasePresentGate(page).catch(() => {});
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => ({
      team: document.querySelector('[data-qa="active-team"] h2')?.textContent?.trim() || "",
      spine: document.querySelector('[data-qa="active-team"]')
        ? getComputedStyle(document.querySelector('[data-qa="active-team"]').firstElementChild).backgroundColor
        : "",
      spineOpacity: document.querySelector('[data-qa="active-team"]')
        ? getComputedStyle(document.querySelector('[data-qa="active-team"]').firstElementChild).opacity
        : "",
      cards: document.querySelectorAll('[data-qa="stage-card"]').length,
      queue: document.querySelectorAll('[data-qa="queue-row"]').length,
    }));
    console.log(`      · ${shot}: ${m.team} · ${m.cards} cards · ${m.queue} queued · spine ${m.spine} @ ${m.spineOpacity}`);
    await shoot(palette.id, shot, page);
  } finally {
    await page.close();
    await context.close();
  }
}

async function shootStageReturns(browser, palette) {
  const { context, page } = await openStage(browser, DESK);
  try {
    await page.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
    await page.waitForTimeout(2400);
    await page.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
    await page.waitForTimeout(1000);
    await page.locator('[data-qa="control-strip"] button', { hasText: "Show the returns" }).click();
    await page.waitForTimeout(3000);
    const m = await page.evaluate(() => ({
      returns: !!document.evaluate("//h2[contains(., 'The returns')]", document, null, 9, null).singleNodeValue,
      krugers: document.querySelectorAll(".kruger-bar").length,
    }));
    console.log(`      · returns: reached ${m.returns} · ${m.krugers} kruger`);
    await shoot(palette.id, "stage-returns", page);
  } finally {
    await page.close();
    await context.close();
  }
}

// ── Surface 4: the Newsroom ──────────────────────────────────
async function shootNewsroom(browser, palette) {
  const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-qa="team-row"]', { timeout: 60000 });
    await hideDevChrome(page);
    await page.waitForTimeout(2200);
    // The desk viewport carries the whole tracking desk in one frame: the
    // marquee, the three identity spines, and the stacked category bars
    // where all three hues abut with no rule between them.
    await shoot(palette.id, "newsroom", page);
  } finally {
    await page.close();
    await context.close();
  }
}

// ── Surface 5: the team-select medallions ────────────────────
async function shootMedallions(browser, palette) {
  const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("workshop-room-code", "OGILVY");
      localStorage.setItem("workshop-guide-seen", "1");
    } catch {}
  });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
    await hideDevChrome(page);
    await page.waitForTimeout(3600);
    await shoot(palette.id, "medallions", page);
  } finally {
    await page.close();
    await context.close();
  }
}

// ── The run ──────────────────────────────────────────────────
async function runPalette(browser, palette) {
  console.log(`\n── ${palette.label} · ${palette.colors.join(" / ")}`);
  await applyPalette(palette.colors);
  await waitForPalette(browser, palette.colors);
  console.log("    compiled");
  await shootBoards(browser, palette);
  await shootStagePresenting(browser, palette, DESK, "stage-presenting");
  await shootStagePresenting(browser, palette, PROJECTOR, "stage-projector");
  await shootStageReturns(browser, palette);
  await shootNewsroom(browser, palette);
  await shootMedallions(browser, palette);
}

// ── The comparison sheet ─────────────────────────────────────
function rows(shot, caption, note) {
  const cells = PALETTES.map((p) => {
    const file = captures.get(`${p.id}:${shot}`);
    if (!file) return `<figure class="miss"><div class="hole">not captured</div><figcaption>${p.label}</figcaption></figure>`;
    const swatches = p.colors
      .map((c, i) => `<span class="sw" style="background:${c}" title="${TEAMS[i].name} ${c}"></span>`)
      .join("");
    return `<figure><img src="file://${file}" alt="${p.label} — ${caption}" /><figcaption><span class="swrow">${swatches}</span>${p.label}</figcaption></figure>`;
  }).join("");
  return `<section>
    <h2>${caption}</h2>
    <p class="note">${note}</p>
    <div class="quad">${cells}</div>
  </section>`;
}

function sheetHtml(verdict) {
  const key = PALETTES.map(
    (p) => `<div class="card">
      <div class="swline">${p.colors
        .map((c, i) => `<span class="chip" style="background:${c}"><b style="color:${
          ((parseInt(c.slice(1), 16) >> 16 & 255) * 299 + (parseInt(c.slice(1), 16) >> 8 & 255) * 587 + (parseInt(c.slice(1), 16) & 255) * 114) / 1000 > 128 ? "#231F20" : "#fff"
        }">${TEAMS[i].name}</b><i style="color:${
          ((parseInt(c.slice(1), 16) >> 16 & 255) * 299 + (parseInt(c.slice(1), 16) >> 8 & 255) * 587 + (parseInt(c.slice(1), 16) & 255) * 114) / 1000 > 128 ? "#231F20" : "#fff"
        }">${c.toUpperCase()}</i></span>`)
        .join("")}</div>
      <h3>${p.label}</h3>
      <p>${p.rationale}</p>
    </div>`,
  ).join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  :root { --ink:#231F20; --red:#EB3F43; --quiet:#6e6a6c; --hair:rgba(35,31,32,0.22); }
  * { box-sizing: border-box; }
  body { margin:0; padding:46px 52px 60px; background:#fff; color:var(--ink);
         font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; width:2040px; text-wrap:pretty; }
  h1 { font-family:Georgia,"Times New Roman",serif; font-size:52px; line-height:1.06; margin:0 0 12px; text-wrap:balance; }
  h2 { font-size:20px; letter-spacing:0.01em; margin:0 0 5px; }
  h3 { font-size:16px; margin:0 0 6px; }
  .slug { font-family:"Courier New",monospace; font-size:11px; letter-spacing:0.09em;
          text-transform:uppercase; color:var(--red); margin:0 0 12px; }
  .lede { font-size:15.5px; line-height:1.62; max-width:1080px; color:#454244; margin:0 0 26px; }
  .note { font-size:13px; line-height:1.52; color:var(--quiet); margin:0 0 14px; max-width:1500px; }
  section { margin:0 0 36px; padding-top:20px; border-top:1px solid var(--hair); }
  .quad { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  figure { margin:0; }
  img { width:100%; display:block; border:1px solid rgba(35,31,32,0.3); }
  .hole { height:220px; border:1px dashed rgba(35,31,32,0.3); display:flex; align-items:center;
          justify-content:center; color:var(--quiet); font-size:13px; }
  figcaption { font-size:12.5px; color:#454244; margin-top:8px; display:flex; align-items:center; gap:8px; }
  .swrow { display:inline-flex; }
  .sw { width:13px; height:13px; display:inline-block; border:1px solid rgba(35,31,32,0.35); margin-right:-1px; }
  .keys { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin:0 0 32px; }
  .card { border:1px solid var(--hair); padding:14px 16px 16px; }
  .card p { font-size:12.8px; line-height:1.5; color:#454244; margin:0; }
  .swline { display:flex; gap:4px; margin:0 0 10px; }
  .chip { flex:1; padding:7px 8px 8px; display:flex; flex-direction:column; gap:2px; }
  .chip b { font-size:11px; letter-spacing:0.04em; }
  .chip i { font-family:"Courier New",monospace; font-style:normal; font-size:10px; opacity:0.82; }
  .verdict { border:2px solid var(--red); padding:22px 24px; margin:0 0 32px; }
  .verdict h2 { color:var(--red); font-size:15px; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:10px; }
  .verdict p { font-size:15px; line-height:1.62; margin:0 0 10px; max-width:1500px; }
  .verdict ul { margin:10px 0 0; padding-left:19px; font-size:14px; line-height:1.68; color:#3a3739; max-width:1500px; }
  .verdict li { margin-bottom:5px; }
  table { border-collapse:collapse; font-size:13px; margin:14px 0 4px; }
  th, td { border:1px solid var(--hair); padding:7px 12px; text-align:left; vertical-align:top; }
  th { background:#f4f2f0; font-weight:700; font-size:12px; line-height:1.35; }
  td.num { font-family:"Courier New",monospace; }
  td.good { background:rgba(35,31,32,0.05); font-weight:700; }
  td.bad { color:var(--red); font-weight:700; }
  code { font-family:"Courier New",monospace; font-size:0.94em; }
</style></head><body>
  <p class="slug">Team palette study · lab render · the shipping palette is unchanged</p>
  <h1>Three ways to give the teams a colour the platform&nbsp;can keep.</h1>
  <p class="lede">The shipped set breaks its own rule twice. <code>lib/config.ts</code> states that red is never a team
    colour because red is the platform's voice, yet Touffou ships Pantone 485 <code>#DA291C</code> — ΔE 15 from the
    platform red <code>#EB3F43</code> — and Baskerville ships <code>#8A8689</code>, the exact neutral the category chips
    use, ΔE 0. Each candidate below is rendered by overriding <code>GROUPS</code> and screenshotting the running app
    across both registers: the paper Board with its luminance-aware hero band, the dark Stage with spines at their
    shipped 55%, the returns, the Newsroom, and the team-select medallions. Nothing here is committed to the palette.</p>
  <div class="keys">${key}</div>
  ${verdict}
  ${rows("board-group-1", "The Board hero band — Hathaway (paper register)",
    "The one flood on the light surface. Text colour is computed from the hue's luminance, so the band is also the test of whether the ruling white-or-ink lands on the right side.")}
  ${rows("board-group-2", "The Board hero band — Touffou",
    "The collision case. On the control this band is a near-brand-red flood on paper, which is the single loudest reason red stops reading as the platform's own voice.")}
  ${rows("board-group-3", "The Board hero band — Baskerville",
    "The identity case. On the control the band is the same grey as the category chips sitting directly beneath it, so the team's own surface says nothing about which team it is.")}
  ${rows("stage-presenting", "The Stage, presenting — spines at the shipped 55% + the stacked queue (1600×1000)",
    "The compensating fix in situ. Every card spine and the active team's header spine run at 0.55 opacity over #0A0A0C; the queue rows beneath carry the waiting teams' hues at the same weight.")}
  ${rows("stage-projector", "The same wall at 1280×720 — the projector pass",
    "The room size the direction doc protects. A composition that only fits on the taller wall has not been tested on the projector the plan names.")}
  ${rows("stage-returns", "The Stage returns — the leader declared (1600×1000)",
    "The one state where team hue and the platform red are on screen together: the china-marker circle and the leader's red vote slab are the only red on the working area, so any team colour close to #EB3F43 competes directly with the declaration.")}
  ${rows("newsroom", "The Newsroom — team rows and the category breakdown (1600×1000)",
    "Two tests in one frame. Team colour is an identity spine here and never a rank signal, so the three hues have to be told apart with no cue but a 6px spine — and in the stacked category bars below, all three abut inside a single bar with no rule between them. If two teams merge there, the bar stops carrying information.")}
  ${rows("medallions", "Team select — the medallions",
    "The entry peak, on the dark register, where the hue is the largest object on screen and the focus ring, glow field and launch burst are all drawn from it.")}
</body></html>`;
}

async function renderSheet(browser, verdict) {
  console.log("\n── COMPARISON SHEET ──────────────────────────────");
  const htmlPath = path.join(OUT_DIR, "_sheet.html");
  await writeFile(htmlPath, sheetHtml(verdict), "utf8");
  const context = await browser.newContext({ viewport: { width: 2040, height: 1400 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(600);
    await mkdir(path.dirname(SHEET_PATH), { recursive: true });
    await page.screenshot({ path: SHEET_PATH, fullPage: true });
    console.log(`  → ${SHEET_PATH}`);
  } finally {
    await page.close();
    await context.close();
    await rm(htmlPath, { force: true });
  }
}

// ── The measurement table ────────────────────────────────────
// CIE Lab, D65. "ΔE off red" is the distance from the platform voice
// #EB3F43; "ΔE off chip" the distance from the category-chip neutral
// #8A8689; "spine" the shipped 55% opacity composited on the Stage
// ground #0A0A0C, reported as a contrast ratio against that ground.
const TABLE = `
  <table>
    <tr><th>Set</th><th>Hathaway</th><th>Touffou</th><th>Baskerville</th>
        <th>ΔE off red<br />(nearest)</th><th>ΔE off chip<br />(nearest)</th><th>Inter-team ΔE<br />(closest pair first)</th><th>Weakest spine<br />@ 55% on #0A0A0C</th></tr>
    <tr><td>Control — shipped</td><td class="num">#2438D6</td><td class="num">#DA291C</td><td class="num">#8A8689</td>
        <td class="num bad">15</td><td class="num bad">0</td><td class="num">83 / 96 / 135</td><td class="num">1.47:1</td></tr>
    <tr><td><strong>A — Heritage</strong></td><td class="num">#2438D6</td><td class="num">#8E2740</td><td class="num">#B08A4F</td>
        <td class="num good">40</td><td class="num good">38</td><td class="num good">53 / 92 / 128</td><td class="num">1.46:1</td></tr>
    <tr><td>B — Tonal blue</td><td class="num">#3D5AF1</td><td class="num">#24298F</td><td class="num">#9FB2D9</td>
        <td class="num">89</td><td class="num">26</td><td class="num bad">32 / 68 / 74</td><td class="num">1.25:1</td></tr>
    <tr><td>C — Ink &amp; paper</td><td class="num">#2438D6</td><td class="num">#231F20</td><td class="num">#E6E0D4</td>
        <td class="num">81</td><td class="num">34</td><td class="num">77 / 97 / 115</td><td class="num bad">1.10:1</td></tr>
  </table>`;

// ── The verdict, written after looking at the renders ────────
const VERDICT = `
  <div class="verdict">
    <h2>Design direction — A wins, then C, then B. The control is retired.</h2>
    <p><strong>A is the only candidate that repairs both faults without asking anything else in the system to
      move.</strong> Deepening Pantone 485 into oxblood <code>#8E2740</code> takes Touffou from ΔE 15 to ΔE 40 off the
      platform red and drops it 15 points of L*, so on the returns the bright warm marks are the vote slab and the
      china-marker circle, and Touffou is the dark one — a lightness difference the room resolves before it resolves
      hue. Giving Baskerville the warm stone of the paper stock <code>#B08A4F</code> takes it from ΔE 0 to ΔE 38 off
      the category chip and hands it the only warm identity in the set, which is also the one band the luminance rule
      correctly sets in ink rather than white. Cobalt is untouched, so two thirds of the existing dark-register tuning
      still holds — and A is the only candidate whose three teams separate by temperature as well as by value.</p>
    ${TABLE}
    <ul>
      <li><strong>Does brand red stay unmistakable as the platform's voice?</strong> A: yes — nothing comes within
        ΔE 40, and on the returns the red slab and the marker circle are the only red on the working area, which is
        what the direction doc asks for. B: yes, by the widest margin of all, though it buys that by conceding the
        entire warm end of the wheel. C: yes. <strong>Control: no</strong> — the Touffou hero band is a near-brand-red
        flood on paper, and on the returns a <code>#DA291C</code> team chip sits inches from the red vote slab.</li>
      <li><strong>Does each team read as itself at projector distance?</strong> A: yes — cool blue, dark wine, warm
        stone hold apart in the 720p pass and in the stacked category bars, where the three hues abut with no rule
        between them. C: yes on paper and in the medallions, but on the Stage and the Newsroom the ink team has no
        spine at all. <strong>B: no</strong> — bright cobalt against the heritage blue is ΔE 32; in the 720p Stage pass
        all three spines read as "blue", and the category bar's boundaries become value steps inside one hue rather
        than changes of colour.</li>
      <li><strong>Does Baskerville finally have an identity?</strong> All three deliver it — the clearest result in the
        study. C is the most emphatic: bone at L* 89 is the brightest object in the set, and its hero band is a
        genuinely handsome paper-on-paper move. A is next at ΔE 38 off the chip, and it is the one that reads as a
        team rather than as a lighter neutral. B is the weakest at ΔE 26 — close enough that the pale slate still
        reads as light grey in the wire chips.</li>
      <li><strong>Do the compensating fixes become unnecessary, or stay needed?</strong> One goes, one stays, and the
        renders are honest about which. <strong>The forced white type stops being a compensation under A, B or
        C</strong> — with no team in the red family, white display type on the dark register is simply the
        projector-legibility rule the direction doc already states, not a patch over a collision. <strong>The 55%
        spine dim survives every candidate, because it was never really a palette problem.</strong> Composited on the
        Stage ground, cobalt at 55% is 1.47:1, oxblood 1.46:1, stone 2.59:1 — the dim costs every set most of its
        presence, and under C the ink spine falls to 1.10:1 and disappears outright. It was introduced to mute a red
        that A removes, so <strong>the spine opacity now wants a ruling of its own</strong>. That is a decision this
        study surfaces rather than settles.</li>
    </ul>
    <p><strong>C — Ink &amp; paper</strong> is the most Ogilvy-native reading on the paper register and the strongest
      Baskerville in the study, and it loses on one fact the renders make unarguable: a team whose colour is the ink
      has no spine on a <code>#0A0A0C</code> stage. It is invisible in the queue row, on the card edge and in the
      returns chip. That is not a tuning problem — ink and the Stage ground are the same family.<br />
      <strong>B — Tonal blue</strong> keeps the red discipline perfectly and then fails the job a team colour exists to
      do. Two of three teams read as one colour across the room, and it carries the second-weakest spine as well, so it
      gives up team distinction without buying anything back.<br />
      <strong>Control</strong> is the case being retired. It breaks its own written rule twice — Touffou ΔE 15 from the
      voice, Baskerville ΔE 0 from the chip it sits directly above — and both compensating fixes from the last visual
      review trace back to exactly those two hexes.</p>
  </div>`;

/** `sheet` mode re-composes from captures already on disk, so the verdict
 *  can be written after looking at the renders without re-shooting them. */
async function adoptExistingCaptures() {
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(OUT_DIR);
  for (const f of files) {
    const m = /^(.+?)--(.+)\.png$/.exec(f);
    if (m) captures.set(`${m[1]}:${m[2]}`, path.join(OUT_DIR, f));
  }
}

async function main() {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--force-color-profile=srgb"] });

  if (MODE === "sheet") {
    try {
      await adoptExistingCaptures();
      await renderSheet(browser, VERDICT);
    } finally {
      await browser.close();
    }
    console.log(`\n  ${captures.size} captures composed`);
    return;
  }

  // PALETTE_ONLY re-shoots one candidate without disturbing the others'
  // captures on disk — the sheet is composed from the whole directory.
  const only = process.env.PALETTE_ONLY;
  const list = only
    ? PALETTES.filter((p) => p.id === only)
    : MODE === "probe"
      ? PALETTES.slice(0, 1)
      : PALETTES;
  if (only) await adoptExistingCaptures();
  try {
    for (const palette of list) await runPalette(browser, palette);
  } finally {
    // The shipping palette is restored no matter how the run ends.
    restoreConfig();
    console.log("\n  config.ts restored from git");
    try {
      await renderSheet(browser, VERDICT);
    } finally {
      await browser.close();
    }
  }
  console.log(`\n  ${captures.size} captures in ${OUT_DIR}`);
}

main().catch(async (err) => {
  try { restoreConfig(); } catch {}
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
