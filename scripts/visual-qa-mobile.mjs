/**
 * Visual QA — the MOBILE sweep (the phone surfaces)
 * =================================================
 * The two surfaces a participant actually holds: `/vote` (the ballot)
 * and `/[team]/quick-add` (phone capture, which becomes the ballot when
 * the facilitator calls the vote). Audited against
 * docs/ogilvy-showcase-direction.md rather than eyeballed:
 *
 *   the serif law     — no Ogilvy Serif under 28px (Round 4 item 2)
 *   arm's length      — nothing a voter READS under 16px; the tracked
 *                       uppercase micro-register is exempt (Round 15's
 *                       open observation)
 *   the thumb         — every target ≥ 44px, no horizontal scroll
 *   the present gate  — the phone offers exactly what the Stage
 *                       presented, on BOTH phone surfaces (Round 16
 *                       item 1)
 *   the stable №      — team-qualified on the ballot, which stands
 *                       three teams together, and unique per option
 *                       (Round 16 items 2–3)
 *   no circling       — zero ellipse strokes anywhere (Round 18)
 *   the vocabulary    — no retired surface names, no darkroom set
 *
 * ONE headless browser for the whole run, and the Stage opens the vote
 * in the SAME context — showcase realtime is BroadcastChannel, so a
 * phone in another browser would never see an open ballot.
 *
 * Usage (this repo does not install Playwright — run it from the
 * sibling checkout that does):
 *   cd ../sprite-workshop && NODE_OPTIONS= node ../basecamp-ogilvy/scripts/visual-qa-mobile.mjs [tag] [baseUrl]
 *
 * `tag` names the capture folder under output/playwright/mobile-sweep.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TAG = process.argv[2] || "after";
const OUT = path.join(REPO, "output", "playwright", "mobile-sweep", TAG);
const BASE = process.argv[3] || "http://localhost:3005";
const EXECUTABLE =
  process.env.CHROME_HEADLESS_SHELL ||
  "/Users/bidnamlee/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell";

// The two sizes the room's phones actually are.
const IPHONE_SM = { width: 390, height: 844 };
const IPHONE_LG = { width: 430, height: 932 };
const LAPTOP = { width: 1280, height: 720 };

const require = createRequire(
  process.env.PLAYWRIGHT_MODULE || path.join(REPO, "..", "sprite-workshop", "package.json")
);
const { chromium } = require("playwright");

const findings = [];
function note(id, ok, detail) {
  findings.push({ id, ok, detail });
  console.log(`    ${ok ? "ok  " : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
}

async function hideDevChrome(page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function shoot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`    · ${file}`);
  return file;
}

/** Everything the audit needs to know about a rendered phone screen. */
async function probe(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    };
    const walk = [];
    document.querySelectorAll("body *").forEach((el) => {
      if (!vis(el)) return;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
      walk.push({
        tag: el.tagName.toLowerCase(),
        text: own.slice(0, 90),
        font: s.fontFamily.split(",")[0].replace(/["']/g, ""),
        size: parseFloat(s.fontSize),
        upper: s.textTransform === "uppercase",
        weight: s.fontWeight,
        color: s.color,
        bg: s.backgroundColor,
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top),
        interactive: el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button" || !!el.onclick,
        qa: el.getAttribute("data-qa") || "",
        cls: el.className && typeof el.className === "string" ? el.className.slice(0, 60) : "",
      });
    });
    const tappables = [...document.querySelectorAll('button, a, [role="button"], [data-qa="ballot-option"]')]
      .filter(vis)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: (el.textContent || "").trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), qa: el.getAttribute("data-qa") || "" };
      });
    return {
      viewport: { w: innerWidth, h: innerHeight },
      docW: document.documentElement.scrollWidth,
      body: document.body.innerText.slice(0, 2500),
      walk,
      tappables,
      options: document.querySelectorAll('[data-qa="ballot-option"]').length,
    };
  });
}

function auditType(p, label) {
  // Serif law: no Ogilvy Serif below 28px. Courier for slugs only.
  const serif = p.walk.filter((n) => n.text && /ogilvy-serif|Georgia|Times/i.test(n.font) && n.size < 28);
  note(`${label}/serif-law`, serif.length === 0,
    serif.length ? serif.map((s) => `${s.size}px "${s.text.slice(0, 34)}"`).join(" | ") : "no serif under 28px");

  // Arm's-length floor: anything a voter READS must be >= 16px. Slugs,
  // stamps and tracked uppercase labels are the doc's own micro-register
  // and are exempt (Round 15's open observation).
  const tiny = p.walk.filter((n) => n.text && n.size < 16 && !n.upper && !/^[A-Z0-9 ·/№—-]+$/.test(n.text));
  note(`${label}/arms-length`, tiny.length === 0,
    tiny.length ? tiny.map((s) => `${s.size}px "${s.text.slice(0, 34)}"`).join(" | ") : "all sentence text >= 16px");

  const small = p.tappables.filter((t) => t.h < 44 || t.w < 44);
  note(`${label}/tap-44`, small.length === 0,
    small.length ? small.map((t) => `${t.w}x${t.h} "${t.text}"`).join(" | ") : `${p.tappables.length} targets >= 44px`);

  note(`${label}/no-h-scroll`, p.docW <= p.viewport.w + 1, `doc ${p.docW} vs vp ${p.viewport.w}`);
}

function auditVocab(p, label) {
  const bad = ["darkroom", "contact sheet", "Picture it", "New sheet", "Frame", "Print ", "Big Board",
    "Center Court", "CENTER COURT", "Film Room", "Hit The Floor", "The Floor", "FA Signed", "Heat Index"];
  const hits = bad.filter((s) => p.body.includes(s));
  note(`${label}/vocab`, hits.length === 0, hits.length ? hits.join(" | ") : "no stale surface names");
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 2 });
  try {
    // ── 1. The ballot, waiting ───────────────────────────────
    console.log("\n  1 · the ballot before the vote is called");
    const phone = await context.newPage();
    await phone.setViewportSize(IPHONE_SM);
    await phone.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(phone);
    await phone.waitForTimeout(1400);
    await shoot(phone, "01-ballot-waiting-390");
    let p = await probe(phone);
    console.log(`      text: ${JSON.stringify(p.body.slice(0, 220))}`);
    auditType(p, "waiting"); auditVocab(p, "waiting");

    // ── 2. The Stage calls the vote ──────────────────────────
    console.log("\n  2 · the Stage walks the room and calls the vote");
    const stage = await context.newPage();
    await stage.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
    await stage.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
    await hideDevChrome(stage);
    await stage.waitForTimeout(1500);
    const presented = [];
    for (const team of ["Realness", "Confidence", "Skinfirst"]) {
      const row = stage.locator('[data-qa="queue-row"]', { hasText: team });
      if (await row.count()) { await row.first().click(); await stage.waitForTimeout(1100); }
      const titles = await stage.$$eval('[data-qa="stage-card"]', (els) =>
        els.map((e) => (e.querySelector("h3")?.textContent || "").trim()).filter(Boolean));
      console.log(`      ${team}: ${titles.length} on the wall`);
      presented.push(...titles.map((t) => `${team} :: ${t}`));
    }
    await stage.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
    await stage.waitForTimeout(2600);

    // ── 3. The open ballot, both iPhone sizes ────────────────
    console.log("\n  3 · the open ballot");
    await phone.reload({ waitUntil: "networkidle" });
    await hideDevChrome(phone);
    await phone.waitForSelector('[data-qa="ballot-option"]', { timeout: 30000 });
    await phone.waitForTimeout(1300);
    await shoot(phone, "02-ballot-open-390");
    p = await probe(phone);
    console.log(`      ${p.options} options; text:\n${p.body.split("\n").slice(0, 24).map((l) => "        " + l).join("\n")}`);
    auditType(p, "ballot"); auditVocab(p, "ballot");
    note("ballot/scope", p.options === presented.length, `phone ${p.options} vs stage ${presented.length}`);
    note("ballot/team-legend", /HATHAWAY|TOUFFOU|BASKERVILLE/.test(p.body), "team identity named somewhere on the ballot");
    note("ballot/tap-cue", /Tap a circle/.test(p.body), "an instruction telling the voter what to tap");
    note("ballot/idea-no", /\b(HATHAWAY|TOUFFOU|BASKERVILLE)\s+\d{2}\b/.test(p.body), "team-qualified № present");
    // Every option carries a number, and no two share one.
    const tags = (p.body.match(/\b(?:HATHAWAY|TOUFFOU|BASKERVILLE)\s+\d{2}\b/g) || []);
    note("ballot/idea-no-unique", tags.length === p.options && new Set(tags).size === tags.length, tags.join(" · "));
    // NO CIRCLING (Round 18) — no ChinaMark anywhere on the phone.
    const marks = await phone.evaluate(() => document.querySelectorAll('svg ellipse, svg circle, [data-qa="china-mark"]').length);
    note("ballot/no-circling", marks === 0, `${marks} ellipse/circle strokes`);

    await phone.setViewportSize(IPHONE_LG);
    await phone.waitForTimeout(700);
    await shoot(phone, "03-ballot-open-430");
    const pLg = await probe(phone);
    auditType(pLg, "ballot-430");
    await phone.setViewportSize(IPHONE_SM);
    await phone.waitForTimeout(500);

    // ── 4. Casting, changing, and the limit ──────────────────
    console.log("\n  4 · casting");
    const circles = phone.locator('[data-qa="ballot-option"] button');
    const n = await circles.count();
    await circles.nth(0).click();
    await phone.waitForTimeout(900);
    await shoot(phone, "04-ballot-one-cast-390");
    let counter = await phone.locator('[data-qa="ballot-option"]').first().evaluate(() => document.body.innerText.match(/\d\/\d/)?.[0]);
    note("cast/counter", counter === "1/3", `counter reads ${counter}`);

    // change a vote — un-cast the first
    await circles.nth(0).click();
    await phone.waitForTimeout(800);
    counter = await phone.evaluate(() => document.body.innerText.match(/\d\/\d/)?.[0]);
    note("cast/uncast", counter === "0/3", `counter reads ${counter}`);

    // hit the limit
    for (let i = 0; i < Math.min(3, n); i++) { await circles.nth(i).click(); await phone.waitForTimeout(500); }
    await phone.waitForTimeout(900);
    await shoot(phone, "05-ballot-limit-390");
    p = await probe(phone);
    counter = p.body.match(/\d\/\d/)?.[0];
    note("cast/limit", counter === "3/3", `counter reads ${counter}`);
    note("limit/explained", /All \d+ of your votes are cast/.test(p.body),
      "the ballot says what to do at the limit");
    console.log(`      at limit body:\n${p.body.split("\n").slice(0, 10).map((l) => "        " + l).join("\n")}`);

    // ── 5. The ballot closes (the returns state) ─────────────
    console.log("\n  5 · the ballot closes");
    await stage.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
    await stage.waitForTimeout(2000);
    await phone.waitForTimeout(2500);
    await shoot(phone, "06-ballot-closed-390");
    p = await probe(phone);
    console.log(`      closed text: ${JSON.stringify(p.body.slice(0, 300))}`);
    auditType(p, "closed"); auditVocab(p, "closed");
    note("closed/acknowledges-vote", /Your ballot is in/.test(p.body) && /votes counted/.test(p.body),
      "the closed state acknowledges the ballot cast");
    await stage.close();

    // ── 5b. quick-add's ballot is the SAME ballot ───────────
    console.log("\n  5b · quick-add's vote mode (present gate + shared ballot)");
    // Re-open the vote from a fresh Stage so quick-add can be walked.
    const stage2 = await context.newPage();
    await stage2.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
    await stage2.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
    await hideDevChrome(stage2);
    await stage2.waitForTimeout(1400);
    await stage2.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
    await stage2.waitForTimeout(2400);
    const qaVote = await context.newPage();
    await qaVote.setViewportSize(IPHONE_SM);
    await qaVote.goto(`${BASE}/group-2/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(qaVote);
    await qaVote.waitForSelector('[data-qa="ballot-option"]', { timeout: 30000 });
    await qaVote.waitForTimeout(1300);
    await shoot(qaVote, "12-quickadd-votemode-390");
    const pq = await probe(qaVote);
    note("quickadd-ballot/scope", pq.options === presented.length,
      `quick-add ${pq.options} vs stage ${presented.length}`);
    note("quickadd-ballot/idea-no", /\b(HATHAWAY|TOUFFOU|BASKERVILLE)\s+\d{2}\b/.test(pq.body), "team-qualified № present");
    note("quickadd-ballot/tap-cue", /Tap a (filled )?circle/.test(pq.body), `the tap cue: ${(pq.body.match(/.*Tap a.*/) || ["MISSING"])[0]}`);
    auditType(pq, "quickadd-ballot"); auditVocab(pq, "quickadd-ballot");
    await stage2.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
    await stage2.waitForTimeout(1600);
    await qaVote.close(); await stage2.close();

    // ── 6. Quick-add ─────────────────────────────────────────
    console.log("\n  6 · quick-add");
    const qa = await context.newPage();
    await qa.setViewportSize(IPHONE_SM);
    await qa.goto(`${BASE}/group-2/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(qa);
    await qa.waitForTimeout(1400);
    await shoot(qa, "07-quickadd-390");
    p = await probe(qa);
    console.log(`      text:\n${p.body.split("\n").slice(0, 16).map((l) => "        " + l).join("\n")}`);
    auditType(p, "quickadd"); auditVocab(p, "quickadd");
    console.log(`      tappables: ${JSON.stringify(p.tappables)}`);

    // capture flow
    await qa.locator("textarea").fill("A standing brief channel so the client's own team files provocations between sessions.");
    await qa.waitForTimeout(300);
    await shoot(qa, "08-quickadd-typed-390");
    await qa.locator("button", { hasText: "ADD IDEA" }).click();
    await qa.waitForTimeout(500);
    await shoot(qa, "09-quickadd-filed-390");
    await qa.waitForTimeout(1400);
    p = await probe(qa);
    note("quickadd/landed", /1 added/.test(p.body), `after-submit feedback: ${JSON.stringify(p.body.slice(0, 200))}`);

    await qa.setViewportSize(IPHONE_LG);
    await qa.waitForTimeout(600);
    await shoot(qa, "10-quickadd-430");

    // baskerville — the warm stone, the legibility case
    await qa.setViewportSize(IPHONE_SM);
    await qa.goto(`${BASE}/group-3/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(qa);
    await qa.waitForTimeout(1200);
    await shoot(qa, "11-quickadd-baskerville-390");
    const stone = await qa.evaluate(() => {
      const out = [];
      document.querySelectorAll("body *").forEach((el) => {
        const s = getComputedStyle(el);
        const bg = s.backgroundColor, col = s.color;
        const txt = [...el.childNodes].filter((x) => x.nodeType === 3 && x.textContent.trim()).map((x) => x.textContent.trim()).join("");
        if (txt && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") out.push({ txt: txt.slice(0, 40), bg, col });
      });
      return out;
    });
    console.log(`      stone team-colour text-on-ground: ${JSON.stringify(stone)}`);
    await qa.close();
    await phone.close();
  } finally {
    await context.close();
    await browser.close();
  }

  await writeFile(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 2));
  const fails = findings.filter((f) => !f.ok);
  console.log(`\n  ${findings.length} checks, ${fails.length} failures`);
}

main().catch((e) => { console.error(e); process.exit(1); });
