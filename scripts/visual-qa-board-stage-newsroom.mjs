/**
 * Visual QA — Board / Stage / Newsroom hierarchy pass
 * ===================================================
 * The bounded review harness for
 * docs/plans/2026-08-02-001-refactor-board-stage-newsroom-hierarchy-plan.md.
 *
 * U1 reviews the STAGE LAB: two queue placements at both projector
 * sizes, the ten-plus density case, and the idea-focus state.
 * U2 reviews the BOARD: the hero with no count, the making pockets at
 * the head of the wall's first column, and frame numbering, at the three
 * laptop widths and at the one-column width below them.
 * U5 reviews the NEWSROOM: the exact coaching count and non-ranked team
 * tracking, driven through a live room rather than a cold load.
 * U3 reviews the SHIPPED STAGE (`stage-live`): the active team's viewport,
 * the stacked queue, density from zero to twelve, and the protected
 * ballot → returns → shortlist run, walked with the room's own controls.
 * U4 reviews IDEA FOCUS (`focus`): the shared typographic plate on the
 * wall, in focus and on the full shortlist; the manuscript's hierarchy at
 * room scale; previous/next at the collection's boundaries; the actions
 * that close it; reduced motion and the keyboard; and the Board card the
 * same component still has to render unchanged.
 * U6 proves the THREE SURFACES TOGETHER (`proof`): three complete room
 * flows rather than isolated stills — a Board card becoming an open idea,
 * the Stage's active team becoming a focused idea and then a ballot, the
 * Newsroom taking a live idea while the room watches — with every state
 * audited against the design contract (one Kruger, no red display type on
 * dark, the serif law, the projector floor, the 16:9 print frame, one
 * primary in the Control Strip) and one idea read on all three surfaces.
 *
 * ONE headless browser for the whole run. Every page, context and the
 * browser itself are closed in a `finally` block, so a failed assertion
 * can never leave a Chromium process behind.
 *
 * U7 walks IDENTITY AND SCOPE (`identity`): the ballot's scope and the
 * stable idea number — an idea coached on the Board keeping its №, the
 * Board and the Stage naming the same idea the same while sorting in
 * opposite directions, the phone's ballot equalling the collection the
 * Stage presented at both 390×844 and 1280×720, the returns ranking that
 * same set, and every shared surface qualifying the number with its team.
 *
 * U8 drives THE FACILITATOR'S SESSION (`session`): the real login form,
 * the real cookie and the real gate — one password admits, a wrong one
 * refuses and says so on both attempts, every gated route 401s without a
 * session and accepts with it, the cookie is httpOnly and is not the
 * password, and every room surface is walked to prove the room is never
 * asked to authenticate. Its sibling `session-unconfigured` proves the
 * middleware fails CLOSED and is run deliberately against a server
 * started without ADMIN_PASSWORD — see the note above that suite.
 *
 * U9 holds THE PHONE (`phone`): the primary action above the software
 * keyboard, driven by a `visualViewport` the harness itself raises and
 * lowers; how that degrades where there is no keyboard and no
 * `visualViewport` at all; and the vote receipt, driven through a real
 * ballot and then RELOADED, which is the whole defect — plus a second
 * category, because a receipt that survives a reload and names the
 * wrong ballot is worse than the sheet it replaced. The Board's own
 * phone widths join the `board` suite as two more states.
 *
 * U3 + U7 force FAILURE (`resilience`): the only suite that asks what
 * the room is told when a write does not land — the open card's
 * autosave, a refused Present, a refused Darkroom commission that must
 * not take the participant's paragraph with it, the phone's capture,
 * the field-level save, and the remote-edit conflict. Failures are
 * forced through the showcase shim's `window.__showcaseFaults` list,
 * because this checkout has no database to break.
 *
 * Usage:
 *   node scripts/visual-qa-board-stage-newsroom.mjs [suite] [baseUrl]
 *     suite   — stage (default) | board | newsroom | stage-live | focus
 *               | proof | identity | session | phone | resilience
 *               | present-gate | darkroom | coach | all
 *               | session-unconfigured (run on its own, see below)
 *     baseUrl — default http://localhost:3005
 *
 * LOCAL RESOLUTION NOTE — this repo does not install Playwright. Either
 * run the script from a project that does (the sibling sprite-workshop
 * checkout), or point PLAYWRIGHT_MODULE at a playwright install:
 *
 *   cd ../sprite-workshop && node ../basecamp-ogilvy/scripts/visual-qa-board-stage-newsroom.mjs
 *   PLAYWRIGHT_MODULE=/abs/path/to/node_modules/playwright node scripts/...
 *
 * The browser binary is the already-downloaded headless shell; override
 * with CHROME_HEADLESS_SHELL if the cached build changes.
 */

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const OUT_DIR = path.join(REPO, "output", "playwright", "surface-hierarchy");
const SHEET_PATH = path.join(REPO, "docs", "stage-lab-queue.png");

const SUITE = process.argv[2] || "stage";
const BASE = process.argv[3] || "http://localhost:3005";

const EXECUTABLE =
  process.env.CHROME_HEADLESS_SHELL ||
  "/Users/bidnamlee/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell";

const LAPTOP = { width: 1280, height: 720 };
// The room's third size — the one the ballot fitted in while 720p did not.
const HALL = { width: 1440, height: 900 };
const PROJECTOR = { width: 1920, height: 1080 };
// The Board is a working surface, not a room-facing one: it is reviewed
// at the laptop sizes a team actually opens it on. NARROW is the real
// half-screen a participant works in beside a deck.
const NARROW = { width: 918, height: 929 };
const DESK = { width: 1600, height: 1000 };
// The one-column wall. Below the masonry's 640px breakpoint the wall has
// no column beside the pockets, which is the case Round 19 had to decide
// rather than inherit. 600×900 is the narrowest width the Board's other
// laws (one-line platform name, no horizontal scroll) still hold at.
const ONECOL = { width: 600, height: 900 };
const PHONE = { width: 390, height: 844 };
// The other phone in the room — the Pro Max. Both phones sit below the
// Board's 520px chrome breakpoint; ONECOL deliberately does not, which
// is what keeps Round 19's one-column composition out of this pass.
const PHONE_LG = { width: 430, height: 932 };
// Mirrors the `max-[599px]` breakpoint in app/app/[team]/page.tsx.
// Tailwind's `max-[N]` compiles to `width < N`, EXCLUSIVE, so the law
// below has to be `<` too — a harness that rounds a boundary the other
// way would fail a page that is laid out correctly at exactly 599.
const BOARD_PHONE_BELOW = 599;

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
      // Bare specifiers resolve through the ESM loader; absolute paths
      // are CommonJS directories, which only `require` can resolve.
      const mod = candidate.startsWith("/") ? require(candidate) : await import(candidate);
      if (mod.chromium) return mod.chromium;
    } catch (err) {
      failures.push(`${candidate}: ${err.message.split("\n")[0]}`);
    }
  }
  throw new Error(`Could not resolve playwright.\n  ${failures.join("\n  ")}`);
}

// ── Assertions (collected, never thrown mid-run) ─────────────
const results = { captures: [], passed: 0, failed: [] };

function check(state, label, ok, detail = "") {
  if (ok) {
    results.passed += 1;
    console.log(`    ✓ ${label}`);
  } else {
    results.failed.push(`${state} — ${label}${detail ? ` (${detail})` : ""}`);
    console.log(`    ✗ ${label}${detail ? ` (${detail})` : ""}`);
  }
}

// ── The Stage lab suite ──────────────────────────────────────
const STAGE_STATES = [
  { name: "stage-stacked-mixed6-1280x720", url: "/stage-lab?queue=stacked&fixture=mixed6&chrome=0", size: LAPTOP,
    caption: "A · Stacked queue — six mixed ideas @ 1280×720" },
  { name: "stage-rail-mixed6-1280x720", url: "/stage-lab?queue=rail&fixture=mixed6&chrome=0", size: LAPTOP,
    caption: "B · Side rail — six mixed ideas @ 1280×720" },
  { name: "stage-stacked-mixed6-1920x1080", url: "/stage-lab?queue=stacked&fixture=mixed6&chrome=0", size: PROJECTOR,
    caption: "A · Stacked queue — six mixed ideas @ 1920×1080" },
  { name: "stage-rail-mixed6-1920x1080", url: "/stage-lab?queue=rail&fixture=mixed6&chrome=0", size: PROJECTOR,
    caption: "B · Side rail — six mixed ideas @ 1920×1080" },
  { name: "stage-stacked-five-1280x720", url: "/stage-lab?queue=stacked&fixture=five&chrome=0", size: LAPTOP,
    caption: "A · Stacked queue — the composed five @ 1280×720" },
  { name: "stage-rail-five-1280x720", url: "/stage-lab?queue=rail&fixture=five&chrome=0", size: LAPTOP,
    caption: "B · Side rail — the composed five @ 1280×720" },
  { name: "stage-stacked-dense12-1280x720", url: "/stage-lab?queue=stacked&fixture=dense12&chrome=0", size: LAPTOP, dense: true,
    caption: "A · Stacked queue — twelve ideas @ 1280×720 (the field scrolls)" },
  { name: "stage-rail-dense12-1280x720", url: "/stage-lab?queue=rail&fixture=dense12&chrome=0", size: LAPTOP, dense: true,
    caption: "B · Side rail — twelve ideas @ 1280×720 (the field scrolls)" },
  { name: "stage-stacked-dense12-1920x1080", url: "/stage-lab?queue=stacked&fixture=dense12&chrome=0", size: PROJECTOR, dense: true,
    caption: "A · Stacked queue — twelve ideas @ 1920×1080" },
  { name: "stage-rail-dense12-1920x1080", url: "/stage-lab?queue=rail&fixture=dense12&chrome=0", size: PROJECTOR, dense: true,
    caption: "B · Side rail — twelve ideas @ 1920×1080" },
  { name: "stage-focus-print-1280x720", url: "/stage-lab?queue=stacked&fixture=mixed6&state=focus&idea=0&chrome=0", size: LAPTOP, focus: true,
    caption: "Idea focus — a developed 16:9 print @ 1280×720" },
  { name: "stage-focus-plate-1280x720", url: "/stage-lab?queue=stacked&fixture=mixed6&state=focus&idea=3&chrome=0", size: LAPTOP, focus: true,
    caption: "Idea focus — the typographic plate, no image @ 1280×720" },
  { name: "stage-focus-plate-1920x1080", url: "/stage-lab?queue=stacked&fixture=mixed6&state=focus&idea=4&chrome=0", size: PROJECTOR, focus: true,
    caption: "Idea focus — the typographic plate @ 1920×1080" },
];

// The dev server's own overlay button is not part of the composition.
async function hideDevChrome(page) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    const field = document.querySelector('[data-qa="stage-field"]');
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      strip: rect('[data-qa="control-strip"]'),
      queue: rect('[data-qa="queue"]'),
      focus: rect('[data-qa="focus"]'),
      queueRows: document.querySelectorAll('[data-qa="queue-row"]').length,
      krugers: document.querySelectorAll(".kruger-bar").length,
      cards: document.querySelectorAll('[data-qa="stage-field"] .grid > *').length,
      fieldScrolls: field ? field.scrollHeight > field.clientHeight + 1 : false,
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      docVOverflow: document.documentElement.scrollHeight > window.innerHeight + 1,
      // The narrowest content well in the field — the card-lab floor is
      // ~170px before titles start truncating mid-word.
      minContentWell: Math.min(
        ...Array.from(document.querySelectorAll('[data-qa="stage-field"] .grid > * > * > *:nth-child(2)')).map(
          (el) => el.getBoundingClientRect().width,
        ),
        Infinity,
      ),
      mediaWidth: (() => {
        const el = document.querySelector('[data-qa="stage-field"] .grid img');
        return el ? el.getBoundingClientRect().width : 0;
      })(),
      columns: (() => {
        const grid = document.querySelector('[data-qa="stage-field"] .grid');
        return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 0;
      })(),
      cardWidth: (() => {
        const c = document.querySelector('[data-qa="stage-field"] .grid > * > *');
        return c ? c.getBoundingClientRect().width : 0;
      })(),
      cardHeight: (() => {
        const c = document.querySelector('[data-qa="stage-field"] .grid > * > *');
        return c ? c.getBoundingClientRect().height : 0;
      })(),
      // How many idea cards the room can actually see without scrolling.
      visibleCards: (() => {
        const f = document.querySelector('[data-qa="stage-field"]');
        if (!f) return 0;
        const b = f.getBoundingClientRect();
        return Array.from(document.querySelectorAll('[data-qa="stage-field"] .grid > *')).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
        }).length;
      })(),
    };
  });
}

async function runStageSuite(browser) {
  console.log("\n── STAGE LAB ─────────────────────────────────────");
  const metrics = {};

  for (const state of STAGE_STATES) {
    const context = await browser.newContext({ viewport: state.size, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${state.name}`);
      await page.goto(`${BASE}${state.url}`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      // Motion is an event, not a texture: give the one arrival beat
      // time to finish, then capture a still room.
      await page.waitForTimeout(1400);

      const m = await measure(page);
      metrics[state.name] = m;
      if (!state.focus) {
        console.log(
          `    · columns ${m.columns}` +
          ` · card ${Math.round(m.cardWidth)}×${Math.round(m.cardHeight)}` +
          ` · content well ${Number.isFinite(m.minContentWell) ? Math.round(m.minContentWell) : "—"}px` +
          ` · print ${Math.round(m.mediaWidth)}px` +
          ` · visible ${m.visibleCards}/${m.cards}` +
          ` · field scrolls ${m.fieldScrolls}`,
        );
      }

      check(state.name, "control strip sits on the bottom edge and never scrolls away",
        !!m.strip && Math.abs(m.strip.bottom - m.viewport.h) < 2, m.strip ? `bottom ${Math.round(m.strip.bottom)} of ${m.viewport.h}` : "missing");
      check(state.name, "the page itself never scrolls horizontally", !m.docOverflow);

      if (state.focus) {
        check(state.name, "focus covers the work area over the overview", !!m.focus);
        check(state.name, "exactly one Kruger — it marks the opened idea", m.krugers === 1, `found ${m.krugers}`);
      } else {
        check(state.name, "both inactive teams are in the queue", m.queueRows === 2, `found ${m.queueRows}`);
        check(state.name, "no Kruger on the overview — the viewport marks the presenter", m.krugers === 0, `found ${m.krugers}`);
        check(state.name, "every fixture idea is mounted", m.cards === (state.dense ? 12 : state.url.includes("five") ? 5 : 6), `found ${m.cards}`);
      }
      if (state.dense) {
        // Overflow is allowed; escaping the work area is not. Whatever
        // does not fit scrolls INSIDE the field, never on the page.
        check(state.name, "ten-plus overflow is contained by the work area", !m.docVOverflow);
      }

      await mkdir(OUT_DIR, { recursive: true });
      const file = path.join(OUT_DIR, `${state.name}.png`);
      await page.screenshot({ path: file });
      results.captures.push({ ...state, file });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // Interaction: open an idea, move next, close, land back on the same overview.
  const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    console.log("\n  stage-interaction (open → next → close)");
    await page.goto(`${BASE}/stage-lab?queue=stacked&fixture=mixed6&chrome=0`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.locator('[data-qa="stage-field"] .grid > *').first().click();
    await page.waitForTimeout(600);
    check("stage-interaction", "opening an idea raises the focus state", await page.locator('[data-qa="focus"]').count() === 1);
    await page.locator('[data-qa="focus"] button', { hasText: "›" }).last().click();
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const after = await measure(page);
    check("stage-interaction", "closing returns to the same active-team overview", !after.focus && after.cards === 6);
    check("stage-interaction", "the control strip never moved", !!after.strip && Math.abs(after.strip.bottom - after.viewport.h) < 2);

    // Isolation: the lab is a deciding room, not a client.
    const requests = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.locator('[data-qa="queue-row"]').first().click();
    await page.waitForTimeout(600);
    check("stage-interaction", "selecting a queue team writes nothing to Supabase",
      !requests.some((u) => /supabase|\/rest\/v1|\/api\//.test(u)));
  } finally {
    await page.close();
    await context.close();
  }

  return metrics;
}

// ── The Board suite (U2) ─────────────────────────────────────
// group-2 carries the longest configured platform name ("The
// Well-Informed Unconscious") on the darkest band, and its first
// category mixes developed prints with text-only ideas — so it is both
// the responsive edge and the mixed-content case. group-1 is text-only
// throughout. The empty category is made the way a team would make one:
// by killing the ideas in it, not by a fixture switch.
const BOARD_STATES = [
  { name: "board-mixed-918x929", url: "/group-2", size: NARROW, mixed: true,
    caption: "The longest platform name at 918×929 — mixed prints and text" },
  { name: "board-mixed-1280x720", url: "/group-2", size: LAPTOP, mixed: true,
    caption: "Mixed prints and text at 1280×720" },
  { name: "board-mixed-1600x1000", url: "/group-2", size: DESK, mixed: true,
    caption: "Mixed prints and text at 1600×1000" },
  { name: "board-text-918x929", url: "/group-1", size: NARROW,
    caption: "A text-only category at 918×929" },
  { name: "board-text-1280x720", url: "/group-1", size: LAPTOP,
    caption: "A text-only category at 1280×720" },
  { name: "board-text-1600x1000", url: "/group-1", size: DESK,
    caption: "A text-only category at 1600×1000" },
  // THE ONE-COLUMN WALL (Round 19 final). Three columns and two are the
  // cases where an idea can sit BESIDE the pockets; one column is the
  // case that had to be decided. The pockets keep the two-up split and
  // the column's full width, and drop to 88px so the first idea still
  // reaches the fold.
  { name: "board-onecol-600x900", url: "/group-2", size: ONECOL,
    caption: "One column at 600×900 — the pockets head the wall at 88px, the ideas read under them" },
  // THE BOARD ON A PHONE (U9). Open items B: "Board scrolls horizontally
  // at 390px — header chrome, not the wall." Both phones are audited,
  // because the fix is a breakpoint and a breakpoint has two sides:
  // 390 is the width that failed, 430 is the width that must not start.
  { name: "board-phone-390x844", url: "/group-3", size: PHONE, phone: true,
    caption: "The Board at 390×844 — identity on one line, the rooms on the next, and no sideways scroll" },
  { name: "board-phone-430x932", url: "/group-2", size: PHONE_LG, phone: true,
    caption: "The Board at 430×932 — the same two-line chrome on the larger phone" },
];

/**
 * Nine more ideas for Confidence's New Craft, of deliberately unequal
 * height — every third one is a single short line, the rest run to the
 * four-line clamp — so the wall has real height differences to place
 * and a balanced result cannot be an accident of uniform cards.
 * A function, not a const: it is built from the Newsroom helpers
 * declared further down the file.
 */
function denseWallRows() {
  return Array.from({ length: 9 }, (_, i) =>
    qaIdea(
      `board-dense-${i + 1}`, "team-two", "category_1",
      `Filed for density ${String(i + 1).padStart(2, "0")}`,
      50 - i,
    ),
  ).map((row, i) => ({
    ...row,
    description: i % 3 === 2
      ? "A short one."
      : "A longer filing, so the wall has cards of genuinely different heights to place — which is the whole point of a masonry that measures rather than guesses. It runs to the four-line clamp.",
  }));
}

async function measureBoard(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const q = (sel) => document.querySelector(sel);
    const hero = q('[data-qa="board-hero"]');
    const h1 = hero ? hero.querySelector("h1") : null;
    const qr = hero
      ? Array.from(hero.querySelectorAll("button")).find((b) => /\bQR\b/.test(b.textContent || ""))
      : null;
    const tabs = q('[data-qa="board-tabs"]');
    // THE PAIR IS THE MAKING ELEMENT ITSELF (Round 19 final). It used to
    // be `making.firstElementChild`, back when `board-making` was a band
    // wrapping the pair. The pockets now ARE the grid cell — two halves
    // of one masonry column — so reading the first child measured a
    // single pocket and judged it against a whole column, which is why
    // 918×929 reported 196px against a 399px column and failed a wall
    // that was in fact laid out correctly.
    const making = q('[data-qa="board-making"]');
    const pair = making;
    const pockets = making ? Array.from(making.children) : [];
    const grid = q('[data-qa="board-grid"]');
    const columnEls = Array.from(document.querySelectorAll('[data-qa="board-column"]'));
    const cards = Array.from(document.querySelectorAll('[data-qa="board-card"]'));
    const withPrint = cards.filter((c) => c.querySelector("img"));
    const textOnly = cards.filter((c) => !c.querySelector("img"));
    const heroText = hero ? (hero.textContent || "") : "";
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      hero: rect(hero),
      // The hero's whole text, minus the QR pocket's own label — what is
      // left must be the team slug line and the platform name, nothing else.
      heroText: heroText.replace(/QR/g, "").trim(),
      h1: rect(h1),
      h1Text: h1 ? (h1.textContent || "").trim() : null,
      h1Size: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : 0,
      h1Lines: h1 ? Math.round(h1.getClientRects().length) : 0,
      qr: rect(qr),
      header: rect(document.querySelector("header")),
      // THE HEADER'S OWN WIDTH (U9). The Board's 390px sideways scroll
      // was never the wall — it was this row running 562px inside a
      // 390px viewport. `scrollWidth` against `clientWidth` names the
      // offender directly, where `docOverflow` only reports that
      // something on the page did it.
      headerScrollW: (() => {
        const h = document.querySelector("header");
        return h ? h.scrollWidth : 0;
      })(),
      headerClientW: (() => {
        const h = document.querySelector("header");
        return h ? h.clientWidth : 0;
      })(),
      nav: rect(document.querySelector('[data-qa="board-nav"]')),
      navTargets: Array.from(document.querySelectorAll('[data-qa="board-nav"] button')).map((b) => {
        const r = b.getBoundingClientRect();
        return { label: (b.textContent || "").trim(), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top) };
      }),
      // The team chip is the identity AND the switcher: it is the one
      // thing the phone header may not drop.
      teamChip: rect(document.querySelector("header button")),
      teamChipText: (document.querySelector("header button")?.textContent || "").trim(),
      // The page name — dropped below the phone breakpoint, and the
      // check has to be that it is not RENDERED, not that it is absent
      // from the DOM.
      // `PAGE_NAMES.teamBoard`, which this showcase configures to "The
      // Board". Read as a rendered box, not a DOM presence — the phone
      // hides it with a class, it is still in the tree.
      pageNameShown: Array.from(document.querySelectorAll("header span")).some(
        (s) => (s.textContent || "").trim() === "The Board" && s.getBoundingClientRect().width > 0,
      ),
      tabs: rect(tabs),
      tabsInner: tabs && tabs.firstElementChild ? rect(tabs.firstElementChild) : null,
      tabCounts: tabs
        ? Array.from(tabs.querySelectorAll("button")).map((b) => {
            const m = (b.textContent || "").match(/(\d+)\s*$/);
            return m ? Number(m[1]) : null;
          })
        : [],
      tabLabels: tabs ? Array.from(tabs.querySelectorAll("button")).map((b) => (b.textContent || "").trim()) : [],
      making: rect(making),
      pair: rect(pair),
      // Scroll-absolute, so the pair can be compared with the cards in
      // `wall` (which carry scrollY) on a page that has been scrolled.
      pairAbs: pair
        ? (() => {
            const r = pair.getBoundingClientRect();
            return { top: Math.round(r.top + window.scrollY), bottom: Math.round(r.bottom + window.scrollY), left: Math.round(r.left) };
          })()
        : null,
      pairButtons: pockets.length,
      pocketWidths: pockets.map((b) => Math.round(b.getBoundingClientRect().width)),
      pocketHeights: pockets.map((b) => Math.round(b.getBoundingClientRect().height)),
      pocketLabels: pockets.map((b) => (b.textContent || "").trim()),
      grid: rect(grid),
      // The wall is a REAL masonry now (2026-08-03), so its columns are
      // elements: the geometry is read off them instead of inferred
      // from a card's width the way the multicol wall forced.
      gridColumnWidth: columnEls.length ? columnEls[0].getBoundingClientRect().width : 0,
      gridColumnWidths: columnEls.map((c) => Math.round(c.getBoundingClientRect().width)),
      // A card's column is read off the COLUMN BOXES, not off the set of
      // distinct card lefts: with the pockets seated in column one that
      // column can legitimately hold no cards at all on a short wall, and
      // an index derived from card lefts would then rename every column.
      gridColumnLefts: columnEls.map((c) => Math.round(c.getBoundingClientRect().left)),
      gridColumnCount: columnEls.length,
      // Every card's SEAT (its place in board order) beside its measured
      // box — what the fill-order and balance laws are judged on.
      wall: cards.map((c) => {
        const r = c.getBoundingClientRect();
        return {
          seat: Number(c.dataset.qaSeat),
          left: Math.round(r.left),
          top: Math.round(r.top + window.scrollY),
          bottom: Math.round(r.bottom + window.scrollY),
          height: Math.round(r.height),
          // UNROUNDED, for the placement replay only. Cards land a fifth
          // of a pixel apart on a seeded wall: with the pockets' 148px
          // head start on column one, rounding two 378.4px columns and a
          // 378.6px one to whole pixels flipped a real tie and failed a
          // wall the browser had placed correctly.
          exactHeight: r.height,
        };
      }),
      cardCount: cards.length,
      // NO `firstCard*` HERE ON PURPOSE. Those read cards[0] — DOM order,
      // which follows the columns — and every board law that leaned on
      // them was really asking about the board's FIRST IDEA. With the
      // pockets seated in column one, the two part company: seat 0 lives
      // in column two, and column one can hold no card at all. The laws
      // are asserted from `wall` (seat + geometry) and the column boxes.
      frames: cards.map((c) => {
        const m = (c.textContent || "").match(/№\s*(\d+)/);
        return m ? Number(m[1]) : null;
      }),
      printedCards: withPrint.length,
      maxPrintedHeight: withPrint.length ? Math.max(...withPrint.map((c) => c.getBoundingClientRect().height)) : 0,
      maxTextHeight: textOnly.length ? Math.max(...textOnly.map((c) => c.getBoundingClientRect().height)) : 0,
      // The print law: a full-width 16:9 frame inside its card.
      printFrames: withPrint.map((c) => {
        const img = c.querySelector("img");
        const box = img.closest('[style*="aspect-ratio"]') || img;
        const r = box.getBoundingClientRect();
        // The mat is the card's INNER width — the frame sits inside the
        // card's paper margin, so the padding comes off before comparing.
        const cs = getComputedStyle(box.parentElement);
        const mat = box.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        return { ratio: r.height ? r.width / r.height : 0, fillsMat: r.width / mat, width: r.width };
      }),
      // The closed card's description — line-clamped on screen, whole in
      // the DOM. The open card must carry the very same string.
      cardDescriptions: cards.map((c) => {
        const ps = Array.from(c.querySelectorAll("p")).map((el) => (el.textContent || "").trim());
        return ps.sort((a, b) => b.length - a.length)[0] || "";
      }),
      emptyState: !!q('[data-qa="board-empty"]'),
      emptyBox: rect(q('[data-qa="board-empty"]')),
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

function assertBoard(state, m) {
  // R3 — the hero carries the platform name and NO count, at any width.
  check(state, "the hero carries no idea count", !/\d/.test(m.heroText), `hero text "${m.heroText}"`);
  check(state, "the hero carries no count label", !/\bIdeas?\b/i.test(m.heroText));
  check(state, "the platform name is the hero's one voice", !!m.h1Text && m.h1Text.length > 0, m.h1Text || "missing");

  // R5 — the name owns the band's width without hitting the QR pocket
  // or dropping under the sticky header.
  check(state, "the platform name clears the QR action",
    !!m.h1 && !!m.qr && m.h1.right <= m.qr.left - 8, m.h1 && m.qr ? `title ends ${Math.round(m.h1.right)}, QR starts ${Math.round(m.qr.left)}` : "missing");
  check(state, "the platform name sits clear of the header nav",
    !!m.h1 && !!m.header && m.h1.top >= m.header.bottom, m.h1 && m.header ? `title top ${Math.round(m.h1.top)}, header bottom ${Math.round(m.header.bottom)}` : "missing");
  check(state, "the platform name holds one line", m.h1Lines === 1, `${m.h1Lines} lines`);
  check(state, "the page itself never scrolls horizontally", !m.docOverflow);

  // ── THE BOARD ON A PHONE (U9) ──────────────────────────────
  // Open items B named the defect and its cause together: "Board
  // scrolls horizontally at 390px — header chrome, not the wall." The
  // wall was already correct (Round 19 item 3, verified at 600×900);
  // the header ran 562px inside 390 and the category rail ran 353
  // inside 294. Both are chrome, and both are asserted here on the
  // element rather than only on the document, so a regression names
  // itself instead of reporting "something overflowed".
  if (m.viewport.w < BOARD_PHONE_BELOW) {
    check(state, "the header fits the phone it is on — the 562px row is gone",
      m.headerScrollW <= m.headerClientW + 1, `header ${m.headerScrollW} inside ${m.headerClientW}`);
    check(state, "the category rail fits inside the page's own margin",
      !!m.tabsInner && !!m.tabs && m.tabsInner.left >= m.tabs.left - 1 &&
        m.tabsInner.left + m.tabsInner.width <= m.tabs.left + m.tabs.width + 1,
      m.tabsInner ? `rail ${Math.round(m.tabsInner.width)}px ending ${Math.round(m.tabsInner.left + m.tabsInner.width)} in ${Math.round(m.tabs.width)}` : "missing");
    check(state, "identity survives — the team chip is still the header's own control",
      !!m.teamChip && m.teamChip.width > 0 && m.teamChipText.length > 1, m.teamChipText);
    check(state, "the page name is what the phone gives up, not the team",
      !m.pageNameShown);
    check(state, "the rooms take the header's second line, under the identity",
      !!m.nav && !!m.teamChip && m.nav.top >= m.teamChip.bottom - 1,
      m.nav && m.teamChip ? `nav top ${Math.round(m.nav.top)} vs chip bottom ${Math.round(m.teamChip.bottom)}` : "missing");
    check(state, "every room is still a real thumb target",
      m.navTargets.length === 3 && m.navTargets.every((t) => t.height >= 44 && t.width >= 44),
      JSON.stringify(m.navTargets.map((t) => `${t.label} ${t.width}×${t.height}`)));
    check(state, "the rooms sit on one line of their own, side by side",
      m.navTargets.length === 3 && new Set(m.navTargets.map((t) => t.top)).size <= 2,
      JSON.stringify(m.navTargets.map((t) => t.top)));
  } else {
    // Above the breakpoint nothing moved: the page name is part of the
    // masthead Round 19 judged, and it must still be there.
    check(state, "above the phone breakpoint the header keeps its page name", m.pageNameShown);
  }

  // R3 — the counts that survived are the per-category ones, in the tabs.
  check(state, "every category tab carries its own count",
    m.tabCounts.length === 3 && m.tabCounts.every((c) => typeof c === "number"), JSON.stringify(m.tabLabels));

  // R4 — THE MAKING POCKETS, ROUND 19 FINAL (user ruling 2026-08-03:
  // "I want each button to be half of one column, and then the other two
  // columns are filled with content").
  //
  // The pockets live INSIDE the wall, at the head of column one, holding
  // exactly that column's width — each pocket half of it — so the other
  // columns carry ideas BESIDE them rather than beneath them.
  //
  // TWO LAWS RETIRE HERE, and neither is coming back:
  //  · "Add and Scout sit in their own band above the grid" — a band
  //    above the wall is exactly what the ruling removed. The first
  //    attempt made that band one column wide and 170px tall, which
  //    stranded two thirds of a row in white; the second made it a
  //    shallow full-width bar, which wasted no width but ignored the
  //    column rhythm and still spent a whole band of the page on two
  //    controls.
  //  · "the shallow band groups with the wall it feeds, not with the
  //    tabs above" — a proximity law for something that sat BETWEEN the
  //    tabs and the wall. There is no between left to measure.
  //
  // The pockets are card-height (124px) wherever an idea can sit beside
  // them, and shallower (88px) at one column, where they unavoidably
  // head the only column there is and every px comes off the fold.
  const pocketH = m.gridColumnCount > 1 ? 124 : 88;
  check(state, "the pockets head column one, level with the top of the wall",
    !!m.pair && !!m.grid && Math.abs(m.pair.top - m.grid.top) < 2 && Math.abs(m.pair.left - m.grid.left) < 2,
    m.pair && m.grid
      ? `pair ${Math.round(m.pair.left)},${Math.round(m.pair.top)} vs wall ${Math.round(m.grid.left)},${Math.round(m.grid.top)}`
      : "missing");
  // The width law, asserted at whatever column count this width produces —
  // three, two or one. It is the assertion the 918×929 run failed while the
  // wall was in fact correct: the old measurement read a single pocket.
  check(state, `the pair holds exactly one column of ${m.gridColumnCount}`,
    !!m.pair && m.gridColumnWidth > 0 && Math.abs(m.pair.width - m.gridColumnWidth) < 2,
    `pair ${Math.round(m.pair?.width ?? -1)} vs column ${Math.round(m.gridColumnWidth)} (${m.gridColumnCount} columns)`);
  check(state, "each pocket is half of that column, and there are two of them",
    m.pairButtons === 2 &&
      Math.abs(m.pocketWidths[0] - m.pocketWidths[1]) <= 1 &&
      Math.abs(m.pocketWidths[0] + m.pocketWidths[1] + 8 - m.pair.width) < 3,
    `${JSON.stringify(m.pocketWidths)} inside ${Math.round(m.pair?.width ?? -1)}`);
  check(state, "the pockets are card-height beside the ideas, shallower at one column",
    !!m.pair && Math.abs(m.pair.height - pocketH) < 3,
    m.pair ? `${Math.round(m.pair.height)}px against ${pocketH}px at ${m.gridColumnCount} columns` : "missing");
  check(state, "both pockets are real targets, not decoration",
    m.pocketHeights.every((h) => h >= 44) && m.pocketWidths.every((w) => w >= 44) &&
      /Add an idea/.test(m.pocketLabels[0] || "") && /Scout/.test(m.pocketLabels[1] || ""),
    JSON.stringify(m.pocketLabels));

  // R1 + numbering — every frame carries a number, and the wall's first
  // IDEA sits beside the pockets.
  //
  // SUPERSEDED by the U7 ruling (2026-08-03): this used to assert "№01
  // is the first frame on the wall" and "frame numbers run in rendered
  // order". The № is now the idea's identity, assigned at creation
  // inside its team + category, so a coached idea sorting to the head of
  // the wall brings its own number with it and the sequence deliberately
  // is NOT the seat order. What the wall still owes the room is a number
  // on every frame and no two frames claiming the same one.
  //
  // "The first frame starts column one" is retired with the band: column
  // one opens with the pockets now, so the board's first idea belongs in
  // the column BESIDE them. Asserted on the SEAT rather than on DOM
  // order — DOM order follows the columns, so it would name whichever
  // column happened to be non-empty rather than the wall's first idea.
  if (m.cardCount > 0) {
    check(state, "every frame on the wall carries a number, and no two share one",
      m.frames.every((n) => typeof n === "number" && n > 0) && new Set(m.frames).size === m.frames.length,
      JSON.stringify(m.frames));
    check(state, "Add and Scout consume no numbered position", m.frames.length === m.cardCount);
    const first = m.wall.find((c) => c.seat === 0);
    check(state,
      m.gridColumnCount > 1
        ? "the board's first idea sits BESIDE the pockets, in column two"
        : "at one column the board's first idea sits under the pockets",
      !!first && !!m.pairAbs && (
        m.gridColumnCount > 1
          ? Math.abs(first.left - m.gridColumnLefts[1]) < 2 && first.top < m.pairAbs.bottom
          : Math.abs(first.left - m.gridColumnLefts[0]) < 2 && first.top >= m.pairAbs.bottom - 1
      ),
      first ? `seat 0 @ ${first.left},${first.top} · pockets ${m.pairAbs?.left},${m.pairAbs?.bottom}` : "missing");
    assertWallFill(state, m);
  }
}

/**
 * THE WALL'S FILL ORDER (user ruling 2026-08-03: "I don't know if the
 * way it fills the rows with ideas here makes any sense").
 *
 * It didn't. The wall was CSS multi-column, and multicol balances by
 * HEIGHT: with one tall printed frame in play the browser filled column
 * one to the floor before it started column two, so the first idea sat
 * alone above a dead gap, the next two stacked in column two, and the
 * wall read down-then-across. The fix is real masonry — every card
 * handed, IN BOARD ORDER, to whichever column is currently SHORTEST.
 *
 * ROUND 19 FINAL amends every law below for the making pockets, which
 * now open column one (user ruling 2026-08-03). The wall's own placement
 * seeds that column's running height with the pockets' height plus the
 * gutter, so the FIRST ideas go to the columns beside the pockets and
 * the top row reads pockets · №01 · №02. Every law here is judged
 * against that same seed — otherwise the harness would be scoring the
 * wall against a head start it does not have.
 *
 * The laws: the ideas beside the pockets read left to right and share
 * the pockets' top edge, each of those columns takes a card before any
 * column doubles up, a column reads downward in board order, no column
 * trails a hole while its neighbour is full, and the whole placement
 * replays exactly as seeded-shortest-first from the heights the browser
 * actually laid out.
 */
const WALL_GUTTER = 24;
/** Mirrors MAKING_H in app/app/[team]/page.tsx — the pockets' height at
 *  two columns and up, which is the seed column one carries. */
const MAKING_H = 124;

function assertWallFill(state, m) {
  const cards = m.wall;
  const cols = m.gridColumnCount;
  if (!cards.length || !cols || !m.pairAbs) return;

  // A card's column comes from the COLUMN BOXES, not from the set of
  // distinct card lefts: column one can legitimately hold no cards on a
  // short wall (the pockets already fill its head), and an index derived
  // from card lefts would silently rename every column.
  const lefts = m.gridColumnLefts;
  const columnOf = (c) => {
    let best = 0;
    for (let i = 1; i < lefts.length; i++) {
      if (Math.abs(c.left - lefts[i]) < Math.abs(c.left - lefts[best])) best = i;
    }
    return best;
  };
  const inColumn = Array.from({ length: cols }, () => []);
  for (const c of cards) inColumn[columnOf(c)].push(c);

  // THE TOP ROW, re-judged: pockets · №01 · №02 at three columns,
  // pockets · №01 at two. The seats that sit beside the pockets are the
  // first `cols - 1`.
  const beside = cols > 1 ? Math.min(cols - 1, cards.length) : 0;
  const head = cards.filter((c) => c.seat < beside).sort((a, b) => a.seat - b.seat);
  if (cols > 1) {
    check(state, "the wall's first row reads pockets, then the ideas beside them, left to right",
      head.length === beside && head.every((c, i) => columnOf(c) === i + 1),
      `pockets @ ${m.pairAbs.left} · ${head.map((c) => `seat ${c.seat} @ ${c.left}`).join(" · ")}`);
    check(state, "the pockets and the first ideas share a top edge, at the head of the wall",
      head.every((c) => Math.abs(c.top - m.pairAbs.top) < 2),
      `pockets ${m.pairAbs.top} · ${JSON.stringify(head.map((c) => c.top))}`);
    check(state, "every column beside the pockets takes a card before any column doubles up",
      inColumn.slice(1, 1 + beside).every((list) => list.length >= 1),
      JSON.stringify(inColumn.map((l) => l.length)));
  } else {
    check(state, "at one column the ideas read directly under the pockets, nothing stranded between",
      cards[0].top >= m.pairAbs.bottom - 1 && cards[0].top <= m.pairAbs.bottom + WALL_GUTTER + 2,
      `pockets end ${m.pairAbs.bottom}, first idea ${cards[0].top}`);
  }
  check(state, "a column reads downward in board order",
    inColumn.every((list) =>
      [...list].sort((a, b) => a.top - b.top).every((c, i, s) => i === 0 || c.seat > s[i - 1].seat)),
    JSON.stringify(inColumn.map((l) => l.map((c) => c.seat))));

  // Greedy shortest-first bounds the spread between the tallest and the
  // shortest column by ONE card plus its gutter. A wall that leaves a
  // column short by more than that is not balancing — which is exactly
  // what multicol was doing. A column with no cards is not empty space:
  // column one still ends at the pockets' foot.
  const bottoms = inColumn.map((list, i) =>
    list.length ? Math.max(...list.map((c) => c.bottom)) : (i === 0 ? m.pairAbs.bottom : m.pairAbs.top));
  const spread = Math.max(...bottoms) - Math.min(...bottoms);
  const tallest = Math.max(...cards.map((c) => c.height));
  check(state, "no column is left with a trailing gap bigger than one card",
    cards.length <= cols || spread <= tallest + WALL_GUTTER + 4,
    `spread ${spread}px against the tallest card's ${tallest}px`);

  // The placement itself, replayed from the laid-out heights — WITH the
  // pockets' seed on column one, which is the whole point of the round.
  // Exact heights, and the wall's own 0.5px tie tolerance: the seed puts
  // three columns within a fifth of a pixel of each other on a dense
  // wall, so a rounded replay does not reproduce the browser's choice.
  const running = new Array(cols).fill(0);
  if (cols > 1) running[0] = MAKING_H + WALL_GUTTER;
  const ordered = [...cards].sort((a, b) => a.seat - b.seat);
  const predicted = ordered.map((c) => {
    let t = 0;
    for (let i = 1; i < cols; i++) if (running[i] < running[t] - 0.5) t = i;
    running[t] += (c.exactHeight ?? c.height) + WALL_GUTTER;
    return t;
  });
  check(state, "every card sits in the column that was shortest when it was placed, pockets counted",
    JSON.stringify(predicted) === JSON.stringify(ordered.map(columnOf)),
    `${JSON.stringify(predicted)} vs ${JSON.stringify(ordered.map(columnOf))}`);
  check(state, "the columns are equal width",
    new Set(m.gridColumnWidths).size <= 1, JSON.stringify(m.gridColumnWidths));
}

async function runBoardSuite(browser) {
  console.log("\n── THE BOARD ─────────────────────────────────────");

  for (const state of BOARD_STATES) {
    const context = await browser.newContext({ viewport: state.size, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${state.name}`);
      await page.goto(`${BASE}${state.url}`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1600);

      const m = await measureBoard(page);
      console.log(
        `    · platform "${m.h1Text}" @ ${m.h1Size}px` +
        ` · band ${Math.round(m.hero.height)}px` +
        ` · columns ${m.gridColumnCount} × ${Math.round(m.gridColumnWidth)}px` +
        ` · cards ${m.cardCount} (${m.printedCards} printed)`,
      );
      assertBoard(state.name, m);

      if (state.mixed) {
        // R1 / print law — a developed 16:9 grows its own card and nothing else.
        check(state.name, "the mixed category actually carries prints", m.printedCards > 0, `${m.printedCards}`);
        check(state.name, "every print keeps its full 16:9 frame",
          m.printFrames.every((p) => Math.abs(p.ratio - 16 / 9) < 0.06), JSON.stringify(m.printFrames.map((p) => p.ratio.toFixed(2))));
        check(state.name, "the print runs the card's full inner width",
          m.printFrames.every((p) => p.fillsMat > 0.99), JSON.stringify(m.printFrames.map((p) => p.fillsMat.toFixed(2))));
        check(state.name, "a printed card grows taller than a text card without forcing row height",
          m.maxPrintedHeight > m.maxTextHeight + 40, `printed ${Math.round(m.maxPrintedHeight)} vs text ${Math.round(m.maxTextHeight)}`);
      }

      await mkdir(OUT_DIR, { recursive: true });
      const file = path.join(OUT_DIR, `${state.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.captures.push({ ...state, file });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // A DENSE WALL, at every width. The fill order only becomes visible
  // past the first row, and the shipped seed never gives one category
  // more than three ideas — so the wall that proves the masonry has to
  // be loaded the way a live room loads one: over the showcase bus, the
  // same path a quick-add or a realtime insert crosses, with twelve
  // ideas of deliberately unequal height. This is also the case that
  // catches a height changing AFTER first paint, since the nine
  // arrivals land on a wall the browser has already laid out once.
  const DENSE_WALL = denseWallRows();
  for (const size of [DESK, LAPTOP, NARROW]) {
    const name = `board-dense12-${size.width}x${size.height}`;
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      const cold = await measureBoard(page);
      await broadcast(page, insertEvents("ideas", DENSE_WALL));
      await page.waitForTimeout(2200);

      const m = await measureBoard(page);
      console.log(
        `    · ${cold.cardCount} → ${m.cardCount} cards · ${m.gridColumnCount} columns` +
        ` · seats ${[...m.wall].sort((a, b) => a.seat - b.seat).map((c) => `${c.seat}@${c.left}h${c.height}`).join(" ")}`,
      );
      check(name, "the arrivals land on the wall without a reload",
        m.cardCount === cold.cardCount + DENSE_WALL.length, `${cold.cardCount} → ${m.cardCount}`);
      check(name, "the wall past the first row is deeper than one card per column",
        m.wall.length > m.gridColumnCount * 2, `${m.wall.length} cards in ${m.gridColumnCount} columns`);
      assertBoard(name, m);

      await mkdir(OUT_DIR, { recursive: true });
      const file = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.captures.push({
        name, file,
        caption: `Twelve ideas at ${size.width}×${size.height} — the wall fills across, shortest column first`,
      });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // Tab switching: the cards change, the counts stay per-category, and
  // no count ever appears in the band.
  const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    console.log("\n  board-tabs (switching categories)");
    await page.goto(`${BASE}/group-3`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(page);
    await page.waitForTimeout(1500);
    const before = await measureBoard(page);
    const firstTitles = await page.locator('[data-qa="board-card"] h3, [data-qa="board-card"] h2').allTextContents();

    await page.locator('[data-qa="board-tabs"] button').nth(2).click();
    await page.waitForTimeout(900);
    const after = await measureBoard(page);
    const laterTitles = await page.locator('[data-qa="board-card"] h3, [data-qa="board-card"] h2').allTextContents();

    check("board-tabs", "switching a tab changes the cards on the wall",
      JSON.stringify(firstTitles) !== JSON.stringify(laterTitles) && after.cardCount > 0,
      `${before.cardCount} → ${after.cardCount}`);
    check("board-tabs", "the tab counts are per-category, not a running total",
      JSON.stringify(before.tabCounts) === JSON.stringify(after.tabCounts) && before.tabCounts.some((c) => c !== before.tabCounts[0]),
      JSON.stringify(after.tabCounts));
    check("board-tabs", "no count appears in the band on either tab",
      !/\d/.test(before.heroText) && !/\d/.test(after.heroText));
    // The number is scoped to team + CATEGORY, so each tab numbers from
    // one — but which idea wears 01 is decided at creation, not by the
    // wall's sort (U7). What must hold on every tab is a complete,
    // collision-free set that starts at 1.
    check("board-tabs", "the numbering restarts inside the new category",
      after.frames.length > 0 && Math.min(...after.frames) === 1 &&
        new Set(after.frames).size === after.frames.length,
      JSON.stringify(after.frames));
    // The pockets ride inside the category's own AnimatePresence now, so
    // they cross-fade with the ideas rather than holding still through
    // the swap. What must not change is their SEAT: same head of the same
    // column, same width, once the transition has settled.
    check("board-tabs", "the pockets keep the head of column one across a category change",
      Math.abs(after.pair.top - before.pair.top) < 2 &&
        Math.abs(after.pair.left - before.pair.left) < 2 &&
        Math.abs(after.pair.width - before.pair.width) < 2,
      `${Math.round(before.pair.left)},${Math.round(before.pair.top)}×${Math.round(before.pair.width)} → ${Math.round(after.pair.left)},${Math.round(after.pair.top)}×${Math.round(after.pair.width)}`);

    // The empty category — emptied through the product's own Kill action,
    // so the state under review is one a team can actually reach.
    console.log("\n  board-empty (a category emptied by Kill)");
    let guard = 0;
    while ((await page.locator('[data-qa="board-card"]').count()) > 0 && guard++ < 8) {
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(700);
      await page.locator('button[aria-label="Delete idea"]').click();
      await page.waitForTimeout(250);
      await page.locator("button", { hasText: /^Yes$/ }).click();
      await page.waitForTimeout(800);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
    const empty = await measureBoard(page);
    // THE BUG THIS CHECK NOW GUARDS (found 2026-08-03, fixed same day).
    // The wall used to swap its whole column set for a line of guidance
    // when a category emptied — and once the pockets moved INTO the wall,
    // that swap took Add and the Scout down with it. A team that had just
    // killed its last idea was left with a sentence and no way to act on
    // it: the one moment the board most needs Add was the one moment it
    // offered none. The columns render unconditionally now; the guidance
    // is a note in the column beside the pockets.
    check("board-empty", "the empty category still shows its guidance", empty.emptyState);
    check("board-empty", "the wall still stands as columns, so the pockets keep their seat",
      empty.gridColumnCount === 3 && !!empty.pair && Math.abs(empty.pair.left - empty.grid.left) < 2,
      `${empty.gridColumnCount} columns, pair @ ${Math.round(empty.pair?.left ?? -1)} vs wall @ ${Math.round(empty.grid?.left ?? -1)}`);
    check("board-empty", "Add and Scout are still exposed, one column wide, when the wall is bare",
      !!empty.pair && empty.pairButtons === 2 &&
        Math.abs(empty.pair.height - 124) < 3 &&
        Math.abs(empty.pair.width - empty.gridColumnWidth) < 2,
      empty.pair ? `${Math.round(empty.pair.width)}×${Math.round(empty.pair.height)} vs column ${Math.round(empty.gridColumnWidth)}, ${empty.pairButtons} buttons` : "missing");
    check("board-empty", "the guidance sits BESIDE the pockets, not on top of them",
      !!empty.emptyBox && !!empty.pair && empty.emptyBox.left >= empty.pair.right - 1,
      empty.emptyBox && empty.pair ? `note @ ${Math.round(empty.emptyBox.left)}, pockets end ${Math.round(empty.pair.right)}` : "missing");
    check("board-empty", "the band still carries no count", !/\d/.test(empty.heroText));
    check("board-empty", "the emptied tab drops its count chip", empty.tabCounts.filter((c) => typeof c === "number").length === 2);
    await mkdir(OUT_DIR, { recursive: true });
    const emptyFile = path.join(OUT_DIR, "board-empty-1280x720.png");
    await page.screenshot({ path: emptyFile });
    results.captures.push({ name: "board-empty-1280x720", file: emptyFile, caption: "An empty category at 1280×720 — the pockets hold the head of the wall, the guidance beside them" });

    // USABLE, not merely present — the pocket is clicked and the filing
    // modal has to open on a board with nothing on it.
    await page.locator('[data-qa="board-making"] button', { hasText: "Add an idea" }).click();
    await page.waitForTimeout(900);
    const opened = await page.locator('textarea[placeholder^="What\'s the idea"]').count();
    check("board-empty", "Add still opens the filing modal on a bare wall", opened > 0, `${opened} field(s)`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);

    // The same bare wall at ONE column, where the guidance has to fall in
    // under the pockets instead of beside them.
    await page.setViewportSize(ONECOL);
    await page.waitForTimeout(1000);
    const emptyOne = await measureBoard(page);
    check("board-empty", "at one column the bare wall still opens with the pockets, full width",
      emptyOne.gridColumnCount === 1 && !!emptyOne.pair &&
        Math.abs(emptyOne.pair.width - emptyOne.gridColumnWidth) < 2 &&
        Math.abs(emptyOne.pair.height - 88) < 3,
      `${emptyOne.gridColumnCount} column, pair ${Math.round(emptyOne.pair?.width ?? -1)}×${Math.round(emptyOne.pair?.height ?? -1)} vs ${Math.round(emptyOne.gridColumnWidth)}`);
    check("board-empty", "at one column the guidance falls in under the pockets",
      !!emptyOne.emptyBox && !!emptyOne.pair && emptyOne.emptyBox.top >= emptyOne.pair.bottom - 1,
      emptyOne.emptyBox && emptyOne.pair ? `note top ${Math.round(emptyOne.emptyBox.top)}, pockets end ${Math.round(emptyOne.pair.bottom)}` : "missing");
    const emptyOneFile = path.join(OUT_DIR, "board-empty-600x900.png");
    await page.screenshot({ path: emptyOneFile });
    results.captures.push({ name: "board-empty-600x900", file: emptyOneFile, caption: "The same bare wall at one column — the pockets head it, the guidance under them" });
  } finally {
    await page.close();
    await context.close();
  }

  // Description parity — the closed card clamps, the open card carries
  // the same text in full and still edits the same field.
  const ctx2 = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
  const page2 = await ctx2.newPage();
  try {
    console.log("\n  board-open-card (description parity)");
    await page2.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(page2);
    await page2.waitForTimeout(1500);
    const closedM = await measureBoard(page2);
    const closedDescription = closedM.cardDescriptions[0] || "";
    await page2.locator('[data-qa="board-card"]').first().click();
    await page2.waitForTimeout(900);
    const open = await page2.evaluate(() => {
      const ta = Array.from(document.querySelectorAll("textarea"));
      return { textareas: ta.length, values: ta.map((t) => t.value) };
    });
    check("board-open-card", "the open card holds an editable description field", open.textareas > 0);
    check("board-open-card", "the open card carries the same description in full",
      closedDescription.length > 40 && open.values.some((v) => v.trim() === closedDescription),
      `closed "${closedDescription.slice(0, 48)}…"`);
    const file = path.join(OUT_DIR, "board-open-card-1600x1000.png");
    await page2.screenshot({ path: file });
    results.captures.push({ name: "board-open-card-1600x1000", file, caption: "The open card — the same description, in full and editable" });
  } finally {
    await page2.close();
    await ctx2.close();
  }
}

// ── The Newsroom suite (U5) ──────────────────────────────────
// The Newsroom is judged live, not on a cold load: the room's totals are
// driven apart while the page watches, because the claim under test is
// that a number which moves never moves a team.
//
// The showcase store is in memory, so the room is driven the way a second
// tab drives it — over the showcase BroadcastChannel, the same bus a
// coaching session or a quick-add crosses. Nothing here reaches a backend.

const GROUP_ORDER = ["group-1", "group-2", "group-3"];
const MARQUEE_LABELS = ["Ideas on the board", "Ideas coached", "Scouted", "Coaching sessions"];

const AGO = (mins) => new Date(Date.now() - mins * 60000).toISOString();

function qaIdea(id, teamId, category, name, minutesAgo) {
  const at = AGO(minutesAgo);
  return {
    id, team_id: teamId, category, name,
    description: "Filed from the review harness so the room's totals can be driven apart on purpose.",
    status: "draft", source: "team", wave: null, bbei_connection: null, key_partners: null,
    link_group: null, gifted_from_team_id: null, presenting: false,
    print_status: null, print_options: null, print_url: null, print_source: null, print_note: null,
    created_at: at, updated_at: at,
  };
}

// Deliberately unequal AND deliberately not sorted: after this batch the
// configured MIDDLE team holds the fewest ideas while the LAST row holds
// more than it. Any total-ordered tower would have to reorder here; this
// one must not. Timestamps are old so Pace is left alone for the live step.
const UNEQUAL_BATCH = [
  qaIdea("qa-idea-1", "team-one", "category_1", "The Monday Morning Test", 90),
  qaIdea("qa-idea-2", "team-one", "category_2", "Proof Before Polish", 88),
  qaIdea("qa-idea-3", "team-one", "category_3", "The Client's Own Language", 86),
  qaIdea("qa-idea-4", "team-three", "category_1", "The Long Apprenticeship", 84),
  qaIdea("qa-idea-5", "team-three", "category_2", "One Thread, Every Brief", 82),
];

// Three ideas landing NOW: totals move, Pace moves, the wire moves.
const LIVE_BATCH = [
  qaIdea("qa-idea-6", "team-three", "category_3", "The Standing Critique", 0),
  qaIdea("qa-idea-7", "team-three", "category_1", "Borrowed Genius", 0),
  qaIdea("qa-idea-8", "team-three", "category_2", "The Thread Register", 0),
];

const noteRow = (id) => ({
  id, idea_id: "idea-02", coach_type: "sharpener", team_slug: "group-1",
  user_prompt: "Review-harness session.", ai_response: "Review-harness reply.",
  is_saved: true, created_at: new Date().toISOString(),
});

async function broadcast(page, events) {
  await page.evaluate((evs) => {
    const bus = new BroadcastChannel("basecamp-showcase");
    for (const ev of evs) bus.postMessage(ev);
  }, events);
}

const insertEvents = (table, rows) =>
  rows.map((row) => ({ eventType: "INSERT", new: row, old: null, table, schema: "public" }));
const deleteEvents = (table, ids) =>
  ids.map((id) => ({ eventType: "DELETE", new: null, old: { id }, table, schema: "public" }));

async function measureNewsroom(page) {
  return page.evaluate(() => {
    const RED = "rgb(0, 38, 99)";
    const rows = Array.from(document.querySelectorAll('[data-qa="team-row"]'));
    const firstText = (el) => {
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walk.nextNode())) {
        const t = (node.textContent || "").trim();
        if (t) return t;
      }
      return "";
    };
    const blockAfter = (heading) => {
      const h = Array.from(document.querySelectorAll("h3")).find(
        (el) => (el.textContent || "").trim().toLowerCase() === heading,
      );
      return h && h.nextElementSibling ? h.nextElementSibling : null;
    };
    const categories = blockAfter("by category");
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      marquee: Array.from(document.querySelectorAll('[data-qa="marquee-stat"]')).map((el) => ({
        label: el.dataset.label,
        value: Number(el.dataset.value),
        printed: (el.firstElementChild.textContent || "").trim(),
        labelClipped: el.children[1].scrollWidth > el.children[1].clientWidth + 1,
      })),
      order: rows.map((r) => r.dataset.team),
      totals: rows.map((r) => Number(r.dataset.total)),
      coached: rows.map((r) => Number(r.dataset.coached)),
      scouted: rows.map((r) => Number(r.dataset.scouted)),
      pace: rows.map((r) => r.dataset.pace),
      // The first thing a row says is the team's name. If an ordinal ever
      // comes back, it lands here first.
      openers: rows.map((r) => firstText(r)),
      names: rows.map((r) => (r.querySelector("span").textContent || "").trim()),
      // Team hue survives as the identity spine, not as a rank signal.
      spines: rows.map((r) => ({
        color: getComputedStyle(r.firstElementChild).backgroundColor,
        width: r.firstElementChild.getBoundingClientRect().width,
      })),
      // Dead-space audit: what the identity and metric columns occupy now
      // that the rank cell is gone.
      columns: rows.length
        ? Array.from(rows[0].children).map((c) => Math.round(c.getBoundingClientRect().width))
        : [],
      krugers: document.querySelectorAll(".kruger-bar").length,
      redGrounds: rows.reduce(
        (n, r) => n + Array.from(r.querySelectorAll("*")).filter(
          (el) => getComputedStyle(el).backgroundColor === RED,
        ).length,
        0,
      ),
      // Red type inside a row is allowed for exactly one thing: the Pace stamp.
      redTypeOffPace: rows.reduce(
        (n, r) => n + Array.from(r.querySelectorAll("*")).filter(
          (el) => getComputedStyle(el).color === RED && !el.classList.contains("stamp"),
        ).length,
        0,
      ),
      wireRows: document.querySelectorAll('[data-qa="wire-row"]').length,
      wireTop: (() => {
        const w = document.querySelector('[data-qa="wire-row"]');
        return w ? (w.textContent || "").replace(/\s+/g, " ").trim() : "";
      })(),
      categoryText: categories ? categories.innerText.replace(/\s+/g, " ").trim() : "",
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      bodyText: document.body.innerText,
    };
  });
}

/** The tracking laws, asserted on every Newsroom state we capture. */
function assertTracking(state, m) {
  check(state, "team rows hold configured order whatever the totals do",
    JSON.stringify(m.order) === JSON.stringify(GROUP_ORDER), JSON.stringify(m.order));
  check(state, "every configured team holds a row, present in the data or not",
    m.order.length === GROUP_ORDER.length && m.names.every(Boolean), JSON.stringify(m.names));
  check(state, "no row opens with an ordinal — the team's name is the row's first word",
    m.openers.every((t, i) => t === m.names[i]), JSON.stringify(m.openers));
  check(state, "no Kruger bar on the Newsroom — nothing here is the room's current object",
    m.krugers === 0, `found ${m.krugers}`);
  check(state, "no red ground in any row, whichever team has the most ideas",
    m.redGrounds === 0, `found ${m.redGrounds}`);
  check(state, "the only red type in a row is the Pace stamp",
    m.redTypeOffPace === 0, `found ${m.redTypeOffPace}`);
  check(state, "team colour survives as the identity spine",
    m.spines.every((s) => s.width >= 4) && new Set(m.spines.map((s) => s.color)).size === 3,
    JSON.stringify(m.spines.map((s) => s.color)));
  check(state, "the marquee reads Ideas on the board · Ideas coached · Scouted · Coaching sessions",
    JSON.stringify(m.marquee.map((s) => s.label)) === JSON.stringify(MARQUEE_LABELS),
    JSON.stringify(m.marquee.map((s) => s.label)));
  check(state, "the estimated Words written metric is gone from the marquee",
    !/words? written/i.test(m.bodyText) && !m.marquee.some((stat) => /word/i.test(stat.label)));
  check(state, "every marquee label sits on one uncropped line",
    m.marquee.every((s) => !s.labelClipped));
  check(state, "the page never scrolls horizontally", !m.docOverflow);
}

async function shootNewsroom(page, name, caption, full = false) {
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  results.captures.push({ name, file, caption });
}

// The coaching count rides the page's existing 30s cadence — U5 replaces
// the metric, not the refresh. So the harness waits the room out.
async function waitForCoachingCount(page, expected, timeoutMs = 45000) {
  const started = Date.now();
  let seen = null;
  while (Date.now() - started < timeoutMs) {
    seen = await page.evaluate(() => {
      const el = document.querySelector('[data-qa="marquee-stat"][data-label="Coaching sessions"]');
      return el ? Number(el.dataset.value) : null;
    });
    if (seen === expected) return { ok: true, seen };
    await page.waitForTimeout(1000);
  }
  return { ok: false, seen };
}

async function runNewsroomSuite(browser) {
  console.log("\n── THE NEWSROOM ──────────────────────────────────");

  const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    console.log("\n  newsroom-seed-1280x720");
    await page.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('[data-qa="team-row"]', { timeout: 30000 });
    await hideDevChrome(page);
    await page.waitForTimeout(1600);

    const seed = await measureNewsroom(page);
    console.log(
      `    · marquee ${seed.marquee.map((s) => `${s.label} ${s.value}`).join(" · ")}\n` +
      `    · row columns ${JSON.stringify(seed.columns)} · totals ${JSON.stringify(seed.totals)}`,
    );
    assertTracking("newsroom-seed", seed);
    const seedSessions = seed.marquee[3].value;
    check("newsroom-seed", "the coaching metric prints a raw count, not a k-abbreviated estimate",
      /^\d+$/.test(seed.marquee[3].printed) && Number(seed.marquee[3].printed) === seedSessions,
      seed.marquee[3].printed);
    await shootNewsroom(page, "newsroom-seed-1280x720",
      "The Newsroom as the room opens — configured order, exact counts");

    // Metric correctness: drive the sessions on record to exactly five.
    const toAdd = Math.max(0, 5 - seedSessions);
    console.log(`\n  newsroom-coaching (seed ${seedSessions} + ${toAdd} sessions → 5)`);
    await broadcast(page, insertEvents("training_notes",
      Array.from({ length: toAdd }, (_, i) => noteRow(`qa-note-${i + 1}`))));

    // Unequal totals, filed with old timestamps so Pace stays put.
    console.log("\n  newsroom-unequal-1280x720");
    await broadcast(page, insertEvents("ideas", UNEQUAL_BATCH));
    await page.waitForTimeout(2500);
    const unequal = await measureNewsroom(page);
    console.log(`    · totals ${JSON.stringify(unequal.totals)} · pace ${JSON.stringify(unequal.pace)}`);
    assertTracking("newsroom-unequal", unequal);
    check("newsroom-unequal", "the three totals really are unequal",
      new Set(unequal.totals).size === 3, JSON.stringify(unequal.totals));
    check("newsroom-unequal", "configured order is provably not total order — the middle row holds the fewest",
      unequal.totals[1] < unequal.totals[2] && unequal.totals[1] < unequal.totals[0],
      JSON.stringify(unequal.totals));
    await shootNewsroom(page, "newsroom-unequal-1280x720",
      "Deliberately unequal totals at 1280×720 — the middle row holds the fewest and stays put");

    // Live update: totals, Pace and the wire move; the rows do not.
    console.log("\n  newsroom-live-update-1280x720");
    await broadcast(page, insertEvents("ideas", LIVE_BATCH));
    await page.waitForTimeout(2500);
    const live = await measureNewsroom(page);
    console.log(`    · totals ${JSON.stringify(live.totals)} · pace ${JSON.stringify(live.pace)} · wire "${live.wireTop.slice(0, 56)}"`);
    assertTracking("newsroom-live", live);
    check("newsroom-live", "a new idea updates the team's total",
      live.totals[2] === unequal.totals[2] + LIVE_BATCH.length,
      `${unequal.totals[2]} → ${live.totals[2]}`);
    check("newsroom-live", "a new idea updates the marquee total",
      live.marquee[0].value === unequal.marquee[0].value + LIVE_BATCH.length,
      `${unequal.marquee[0].value} → ${live.marquee[0].value}`);
    check("newsroom-live", "Pace reacts to the burst", live.pace[2] === "surging", JSON.stringify(live.pace));
    check("newsroom-live", "the wire carries the new idea",
      live.wireTop.includes(LIVE_BATCH[0].name), live.wireTop.slice(0, 80));
    check("newsroom-live", "the row order never moved",
      JSON.stringify(live.order) === JSON.stringify(unequal.order));
    check("newsroom-live", "the team the burst belongs to is still the last row, not promoted to the top",
      live.order[2] === "group-3" && live.totals[2] > live.totals[0], JSON.stringify(live.totals));
    await shootNewsroom(page, "newsroom-live-update-1280x720",
      "A burst of ideas lands — totals, Pace and the wire move, the rows do not");
    await shootNewsroom(page, "newsroom-desk-full-1280x720",
      "The whole tracking desk — marquee, teams, by category, the wire", true);

    // The exact count arrives on the page's existing cadence.
    const five = await waitForCoachingCount(page, 5);
    check("newsroom-coaching", "five coaching sessions on record render as 5, not an estimated word total",
      five.ok, `saw ${five.seen}`);
    const withFive = await measureNewsroom(page);
    check("newsroom-coaching", "the category breakdown is untouched by the coaching metric",
      withFive.categoryText === live.categoryText);
    assertTracking("newsroom-coaching-five", withFive);
    await shootNewsroom(page, "newsroom-coaching-five-1280x720",
      "Five coaching sessions on record — the exact head count, not a word estimate");

    // Empty state: no sessions renders 0, not blank and not an estimate.
    console.log("\n  newsroom-coaching-zero");
    const doomed = [
      ...Array.from({ length: 24 }, (_, i) => `note-${String(i + 1).padStart(2, "0")}`),
      ...Array.from({ length: 8 }, (_, i) => `qa-note-${i + 1}`),
    ];
    await broadcast(page, deleteEvents("training_notes", doomed));
    const zero = await waitForCoachingCount(page, 0);
    check("newsroom-coaching", "no coaching sessions renders as 0", zero.ok, `saw ${zero.seen}`);
    const emptied = await measureNewsroom(page);
    check("newsroom-coaching", "the zero prints as a real numeral",
      emptied.marquee[3].printed === "0", emptied.marquee[3].printed);
    check("newsroom-coaching", "the wire and the category breakdown are unchanged by it",
      emptied.categoryText === live.categoryText && emptied.wireRows === live.wireRows);
    assertTracking("newsroom-coaching-zero", emptied);
    await shootNewsroom(page, "newsroom-coaching-zero-1280x720", "Zero coaching sessions — 0, not blank");
  } finally {
    await page.close();
    await context.close();
  }

  // The same unequal room at projector size.
  const projectorCtx = await browser.newContext({ viewport: PROJECTOR, deviceScaleFactor: 1 });
  const projectorPage = await projectorCtx.newPage();
  try {
    console.log("\n  newsroom-unequal-1920x1080");
    await projectorPage.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 30000 });
    await projectorPage.waitForSelector('[data-qa="team-row"]', { timeout: 30000 });
    await hideDevChrome(projectorPage);
    await projectorPage.waitForTimeout(1600);
    await broadcast(projectorPage, insertEvents("ideas", [...UNEQUAL_BATCH, ...LIVE_BATCH]));
    await projectorPage.waitForTimeout(2500);
    const m = await measureNewsroom(projectorPage);
    console.log(`    · totals ${JSON.stringify(m.totals)} · row columns ${JSON.stringify(m.columns)}`);
    assertTracking("newsroom-projector", m);
    check("newsroom-projector", "the unequal room still holds configured order at 1920×1080",
      m.totals[1] < m.totals[2] && JSON.stringify(m.order) === JSON.stringify(GROUP_ORDER),
      JSON.stringify(m.totals));
    await shootNewsroom(projectorPage, "newsroom-unequal-1920x1080", "The same unequal room at 1920×1080");
  } finally {
    await projectorPage.close();
    await projectorCtx.close();
  }
}

// ── The live Stage suite (U3) ────────────────────────────────
// The lab decided the composition; this suite reviews the SHIPPED one
// on /center-court, driven through a real room rather than captured
// cold: teams are handed off from the queue, density is built by the
// production quick-add, and the protected voting → returns → shortlist
// → full-shortlist run is walked with the Control Strip's own buttons.
async function measureStage(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
    };
    const field = document.querySelector('[data-qa="stage-field"]');
    const cards = Array.from(document.querySelectorAll('[data-qa="stage-card"]'));
    const head = document.querySelector('[data-qa="active-team"]');
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      strip: rect('[data-qa="control-strip"]'),
      stripText: document.querySelector('[data-qa="control-strip"]')?.innerText.replace(/\s+/g, " ").trim() || "",
      queue: rect('[data-qa="queue"]'),
      queueRows: Array.from(document.querySelectorAll('[data-qa="queue-row"]')).map((el) =>
        el.innerText.replace(/\s+/g, " ").trim()),
      header: head ? head.innerText.replace(/\s+/g, " ").trim() : "",
      team: head?.querySelector("h2")?.textContent?.trim() || "",
      spine: head ? getComputedStyle(head.firstElementChild).backgroundColor : "",
      krugers: document.querySelectorAll(".kruger-bar").length,
      cards: cards.length,
      fills: cards.map((c) => c.getAttribute("data-fill")),
      // The wall's title scale — one entry means one size on every card.
      titleSizes: [...new Set(cards.map((c) => getComputedStyle(c.querySelector("h3")).fontSize))],
      // The 16:9 law: every mounted print is exactly the frame, uncropped.
      printRatios: Array.from(document.querySelectorAll('[data-qa="stage-card"] img')).map((i) => {
        const r = i.getBoundingClientRect();
        return r.height > 0 ? r.width / r.height : 0;
      }),
      emptyState: !!document.querySelector('[data-qa="stage-empty"]'),
      fieldScrolls: field ? field.scrollHeight > field.clientHeight + 1 : false,
      visibleCards: (() => {
        if (!field) return 0;
        const b = field.getBoundingClientRect();
        return cards.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
        }).length;
      })(),
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
      docVOverflow: document.documentElement.scrollHeight > window.innerHeight + 1,
      returns: !!document.evaluate("//h2[contains(., 'The returns')]", document, null, 9, null).singleNodeValue,
      ballot: /ballots in/i.test(document.body.innerText),
      columns: (() => {
        const g = field?.querySelector(".grid");
        return g ? getComputedStyle(g).gridTemplateColumns.split(" ").length : 0;
      })(),
      cardBox: cards[0]
        ? { w: Math.round(cards[0].getBoundingClientRect().width), h: Math.round(cards[0].getBoundingClientRect().height) }
        : null,
    };
  });
}

// The shared laws every presenting capture answers to.
function assertStage(name, m, expected) {
  check(name, "the Control Strip sits on the bottom edge and never scrolls away",
    !!m.strip && Math.abs(m.strip.bottom - m.viewport.h) < 2,
    m.strip ? `bottom ${Math.round(m.strip.bottom)} of ${m.viewport.h}` : "missing");
  check(name, "the queue holds both waiting teams, once each, above the strip",
    m.queueRows.length === 2 && !!m.queue && !!m.strip && m.queue.bottom <= m.strip.top + 1,
    `${m.queueRows.length} rows`);
  check(name, "no Kruger on the overview — the viewport marks the presenter, not a red bar",
    m.krugers === 0, `found ${m.krugers}`);
  check(name, "the page itself never scrolls", !m.docOverflow && !m.docVOverflow);
  if (expected != null) {
    check(name, `the active team's ${expected} ideas are all mounted`, m.cards === expected, `found ${m.cards}`);
  }
  if (m.cards > 0) {
    check(name, "ONE title size on the whole wall — printed and unprinted alike",
      m.titleSizes.length === 1, m.titleSizes.join(" / "));
    check(name, "every card is a full fill — a print or a plate, never an empty media hole",
      m.fills.every((f) => f === "print" || f === "plate"), JSON.stringify(m.fills));
    check(name, "every mounted print keeps its exact 16:9 frame",
      m.printRatios.every((r) => Math.abs(r - 16 / 9) < 0.05),
      JSON.stringify(m.printRatios.map((r) => r.toFixed(2))));
  }
}

async function shootStage(page, name, caption) {
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  results.captures.push({ name, caption, file });
}

/** The ballot's own geometry. The room votes by scanning, so the QR and
 *  the line that tells the room to scan it are not decoration — they are
 *  the state's only instruction, and they have to be WHOLE on the screen
 *  the plan protects (R8: 1280×720). Measured against the Control Strip's
 *  top edge, not the viewport's, because the strip is opaque chrome. */
async function measureBallot(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const scroller = document.querySelector('[data-qa="ballot"]')?.parentElement?.parentElement ?? null;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      ballot: rect('[data-qa="ballot"]'),
      count: rect('[data-qa="ballot-count"]'),
      scan: rect('[data-qa="ballot-scan"]'),
      qr: rect('[data-qa="ballot-qr"]'),
      caption: rect('[data-qa="ballot-caption"]'),
      captionText: document.querySelector('[data-qa="ballot-caption"]')?.textContent?.trim() ?? "",
      strip: rect('[data-qa="control-strip"]'),
      krugers: document.querySelectorAll(".kruger-bar").length,
      workScrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
      docVOverflow: document.documentElement.scrollHeight > window.innerHeight + 1,
    };
  });
}

function assertBallot(name, b) {
  const fold = b.strip ? b.strip.top : b.viewport.h;
  check(name, "the QR is whole above the Control Strip — never clipped by the room's chrome",
    !!b.qr && b.qr.top >= 0 && b.qr.bottom <= fold + 0.5,
    b.qr ? `QR ${Math.round(b.qr.top)}–${Math.round(b.qr.bottom)} against fold ${Math.round(fold)}` : "no QR");
  check(name, "SCAN TO VOTE is on the screen, not below the fold",
    !!b.caption && /scan to vote/i.test(b.captionText) && b.caption.top >= 0 && b.caption.bottom <= fold + 0.5,
    b.caption ? `caption ${Math.round(b.caption.top)}–${Math.round(b.caption.bottom)} against fold ${Math.round(fold)}` : "no caption");
  check(name, "the instruction sits beside the count, not stacked under it",
    !!b.count && !!b.scan && b.scan.left >= b.count.right - 1,
    b.count && b.scan ? `count ends ${Math.round(b.count.right)}, scan starts ${Math.round(b.scan.left)}` : "missing");
  check(name, "the room reads the whole ballot without scrolling for it",
    !b.workScrolls && !b.docVOverflow, `work area scrolls ${b.workScrolls}`);
  check(name, "no Kruger on the ballot — nothing here is the room's current object yet",
    b.krugers === 0, `found ${b.krugers}`);
}

async function openStage(browser, size, { pillar } = {}) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
  await hideDevChrome(page);
  await page.waitForTimeout(1500);
  if (pillar) {
    await page.locator("button", { hasText: pillar }).first().click();
    await page.waitForTimeout(900);
  }
  return { context, page };
}

/** Give the active team back its whole board: drop its one presenting
 *  flag so the present-gate falls back to every active idea it holds —
 *  the real path a team takes, and the only one that yields a mixed
 *  print/text wall from the showcase's own rows. */
async function releasePresentGate(page) {
  await page.locator('[data-qa="stage-card"]').first().click();
  await page.waitForTimeout(700);
  await page.locator("button", { hasText: "On the Stage" }).first().click();
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(900);
}

async function quickAdd(page, n, prefix) {
  for (let i = 0; i < n; i++) {
    await page.locator('[data-qa="active-team"] button', { hasText: "+ Add" }).click();
    await page.waitForTimeout(140);
    const name = page.locator('input[placeholder="Idea name..."]');
    await name.fill(`${prefix} ${i + 1}`);
    await page.locator('textarea[placeholder="Quick description..."]').fill(
      "Filed from the Stage during review, so the card's well carries the same measure of running copy the room reads.",
    );
    await name.press("Enter");
    await page.waitForTimeout(220);
  }
}

async function runStageLiveSuite(browser) {
  console.log("\n── THE STAGE, LIVE ───────────────────────────────");

  // ── Density and handoff, at both room sizes ──
  for (const [label, size] of [["1280x720", LAPTOP], ["1920x1080", PROJECTOR]]) {
    const { context, page } = await openStage(browser, size);
    try {
      console.log(`\n  stage-live-open-${label}`);
      const open = await measureStage(page);
      console.log(`    · ${open.team} · ${open.cards} card(s) · ${open.columns} col × ${JSON.stringify(open.cardBox)}`);
      assertStage(`stage-live-open-${label}`, open);
      check(`stage-live-open-${label}`, "the configured first team holds the viewport",
        /^realness$/i.test(open.team), open.team);
      check(`stage-live-open-${label}`, "the Control Strip names the same team",
        open.stripText.includes("REALNESS"), open.stripText.slice(0, 70));
      await shootStage(page, `stage-live-open-${label}`,
        `The room opens — the configured team takes the viewport, the rest queue @ ${label}`);

      // ── Team handoff ──
      console.log(`\n  stage-live-handoff-${label}`);
      await page.locator('[data-qa="queue-row"]', { hasText: "Confidence" }).click();
      await page.waitForTimeout(1200);
      const after = await measureStage(page);
      check(`stage-live-handoff-${label}`, "the queue entry hands the viewport to that team",
        /^confidence$/i.test(after.team), after.team);
      check(`stage-live-handoff-${label}`, "its creative platform came with it",
        after.header.includes("The Well-Informed Unconscious"), after.header.slice(0, 90));
      check(`stage-live-handoff-${label}`, "the colour spine changed with the team",
        after.spine !== open.spine, `${open.spine} → ${after.spine}`);
      check(`stage-live-handoff-${label}`, "the position line reports the new team's own count",
        /\d+ IDEAS? ON THE STAGE/i.test(after.header), after.header.slice(0, 60));
      check(`stage-live-handoff-${label}`, "the Control Strip label moved in the same beat",
        after.stripText.includes("CONFIDENCE") && !after.stripText.includes("REALNESS"), after.stripText.slice(0, 70));
      check(`stage-live-handoff-${label}`, "the team that stepped down is now in the queue",
        after.queueRows.some((r) => /REALNESS/i.test(r)), JSON.stringify(after.queueRows));
      assertStage(`stage-live-handoff-${label}`, after);

      // ── Six mixed: release the gate (3 real, two printed), file three ──
      console.log(`\n  stage-live-mixed6-${label}`);
      await releasePresentGate(page);
      const fallback = await measureStage(page);
      check(`stage-live-mixed6-${label}`, "a team with no selections falls back to its board, and says so",
        /showing all — none selected yet/i.test(fallback.header) && fallback.cards === 3,
        `${fallback.cards} cards · ${fallback.header.slice(0, 90)}`);
      await quickAdd(page, 3, "Filed on the Stage");
      await page.waitForTimeout(900);
      const six = await measureStage(page);
      console.log(`    · ${six.columns} col × ${JSON.stringify(six.cardBox)} · fills ${six.fills.join(",")} · visible ${six.visibleCards}/${six.cards}`);
      assertStage(`stage-live-mixed6-${label}`, six, 6);
      check(`stage-live-mixed6-${label}`, "all six read at once — the field never scrolls at this density",
        !six.fieldScrolls && six.visibleCards === 6, `${six.visibleCards}/6, scrolls ${six.fieldScrolls}`);
      check(`stage-live-mixed6-${label}`, "the wall really is mixed — prints and plates side by side",
        six.fills.includes("print") && six.fills.includes("plate"), JSON.stringify(six.fills));
      check(`stage-live-mixed6-${label}`, "quick-add filed onto the presenting team's own wall",
        six.header.includes("6 IDEAS"), six.header.slice(0, 60));
      await shootStage(page, `stage-live-mixed6-${label}`,
        `Six mixed ideas on the active team's field @ ${label}`);

      // ── Ten-plus ──
      console.log(`\n  stage-live-dense12-${label}`);
      await quickAdd(page, 6, "Overflow");
      await page.waitForTimeout(900);
      const dense = await measureStage(page);
      console.log(`    · ${dense.columns} col × ${JSON.stringify(dense.cardBox)} · visible ${dense.visibleCards}/${dense.cards} · field scrolls ${dense.fieldScrolls}`);
      assertStage(`stage-live-dense12-${label}`, dense, 12);
      check(`stage-live-dense12-${label}`, "overflow is contained by the work area — the shell never moves",
        !dense.docVOverflow && !!dense.strip && Math.abs(dense.strip.bottom - dense.viewport.h) < 2);
      check(`stage-live-dense12-${label}`, "the queue never grew into the card field",
        !!dense.queue && dense.queue.height < dense.viewport.h * 0.2, dense.queue ? `${Math.round(dense.queue.height)}px` : "missing");
      await shootStage(page, `stage-live-dense12-${label}`,
        `Twelve ideas @ ${label} — the field absorbs them, the chrome does not move`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── Zero and one: the sparse end of the density range ──
  {
    const { context, page } = await openStage(browser, LAPTOP, { pillar: "INCLUSIVE BIOMIMETIC CARE" });
    try {
      console.log("\n  stage-live-one-1280x720");
      const one = await measureStage(page);
      assertStage("stage-live-one", one, 1);
      check("stage-live-one", "a single idea is given the wall rather than a lonely tile",
        !!one.cardBox && one.cardBox.h > 200, JSON.stringify(one.cardBox));
      await shootStage(page, "stage-live-one-1280x720",
        "One idea on the stage — the field gives it the wall @ 1280×720");

      // Set the only idea aside from the Control Strip → the empty state.
      console.log("\n  stage-live-empty-1280x720");
      await page.locator('[data-qa="stage-card"]').first().hover();
      await page.locator('[data-qa="stage-card"] button[aria-label="Select for a Control Strip action"]').first().click();
      await page.waitForTimeout(400);
      await page.locator('[data-qa="control-strip"] button', { hasText: "Set aside" }).click();
      await page.waitForTimeout(1200);
      const empty = await measureStage(page);
      assertStage("stage-live-empty", empty, 0);
      check("stage-live-empty", "a team with nothing filed gets a deliberate empty state, not a blank field",
        empty.emptyState);
      check("stage-live-empty", "the header still reports the team and its zero",
        /0 IDEAS ON THE STAGE/i.test(empty.header), empty.header.slice(0, 60));
      await shootStage(page, "stage-live-empty-1280x720",
        "The active team has nothing filed — a deliberate empty state @ 1280×720");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The protected run: ballot → returns → shortlist → full shortlist ──
  {
    const { context, page } = await openStage(browser, LAPTOP);
    try {
      console.log("\n  stage-live-voting-1280x720");
      await page.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
      await page.waitForTimeout(2600);
      const voting = await measureStage(page);
      check("stage-live-voting", "the ballot overlay takes the work area", voting.ballot && voting.cards === 0);
      check("stage-live-voting", "the Control Strip stayed put and turned to closing the ballot",
        !!voting.strip && Math.abs(voting.strip.bottom - voting.viewport.h) < 2 && /close the ballot/i.test(voting.stripText),
        voting.stripText.slice(0, 80));
      const ballot = await measureBallot(page);
      console.log(
        `    · count ${Math.round(ballot.count.width)}×${Math.round(ballot.count.height)}` +
        ` · scan ${Math.round(ballot.scan.width)}×${Math.round(ballot.scan.height)}` +
        ` · QR ${Math.round(ballot.qr.bottom)} / fold ${Math.round(ballot.strip.top)}` +
        ` · caption ${Math.round(ballot.caption.bottom)}`,
      );
      assertBallot("stage-live-voting-1280x720", ballot);
      await shootStage(page, "stage-live-voting-1280x720", "The ballot is open — the count and the way in, side by side @ 1280×720");

      console.log("\n  stage-live-returns-1280x720");
      await page.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
      await page.waitForTimeout(1000);
      await page.locator('[data-qa="control-strip"] button', { hasText: "Show the returns" }).click();
      await page.waitForTimeout(2600);
      const returns = await measureStage(page);
      check("stage-live-returns", "the returns rank every team's ideas together", returns.returns);
      check("stage-live-returns", "the returns keep exactly one Kruger — the leader",
        returns.krugers <= 1, `found ${returns.krugers}`);
      check("stage-live-returns", "no queue band intrudes on the returns", !returns.queue);
      check("stage-live-returns", "the Control Strip never moved",
        !!returns.strip && Math.abs(returns.strip.bottom - returns.viewport.h) < 2);
      await shootStage(page, "stage-live-returns-1280x720", "The returns — unchanged by this pass @ 1280×720");

      console.log("\n  stage-live-shortlist-1280x720");
      await page.locator('[data-qa="control-strip"] button', { hasText: "Advance to the Shortlist" }).click();
      await page.waitForTimeout(1600);
      const lineup = await measureStage(page);
      check("stage-live-shortlist", "the category shortlist is reached and holds no queue band", !lineup.queue);
      check("stage-live-shortlist", "the Control Strip offers the next category",
        /next category|full shortlist/i.test(lineup.stripText), lineup.stripText.slice(0, 80));
      await shootStage(page, "stage-live-shortlist-1280x720", "The category shortlist @ 1280×720");

      console.log("\n  stage-live-full-shortlist-1280x720");
      await page.locator("button", { hasText: "THE FULL SHORTLIST" }).first().click();
      await page.waitForTimeout(1800);
      const full = await measureStage(page);
      check("stage-live-full-shortlist", "the full shortlist is reached",
        /the full shortlist/i.test(full.stripText), full.stripText.slice(0, 60));
      check("stage-live-full-shortlist", "the Control Strip is still on the bottom edge",
        !!full.strip && Math.abs(full.strip.bottom - full.viewport.h) < 2);
      await shootStage(page, "stage-live-full-shortlist-1280x720", "The full shortlist @ 1280×720");

      // Back to presenting: the composition returns intact.
      await page.locator("button", { hasText: "THE TRANSPARENCY STANDARD" }).first().click();
      await page.waitForTimeout(1600);
      const back = await measureStage(page);
      check("stage-live-return-to-presenting", "the presenting composition comes back whole",
        back.queueRows.length === 2 && back.cards > 0 && back.krugers === 0,
        `${back.cards} cards · ${back.queueRows.length} queue rows · ${back.krugers} kruger`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The ballot at the room's other two sizes ──
  // 1280×720 is asserted inside the protected run above, where the room
  // reaches the ballot the way a facilitator does. These two confirm the
  // landscape composition did not buy 720p at the taller sizes' expense.
  for (const [label, size] of [["1440x900", HALL], ["1920x1080", PROJECTOR]]) {
    const { context, page } = await openStage(browser, size);
    try {
      console.log(`\n  stage-live-voting-${label}`);
      await page.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
      await page.waitForTimeout(2600);
      const b = await measureBallot(page);
      console.log(
        `    · QR ${Math.round(b.qr.top)}–${Math.round(b.qr.bottom)} / fold ${Math.round(b.strip.top)}` +
        ` · caption ${Math.round(b.caption.bottom)}`,
      );
      assertBallot(`stage-live-voting-${label}`, b);
      await shootStage(page, `stage-live-voting-${label}`, `The ballot @ ${label}`);
    } finally {
      await page.close();
      await context.close();
    }
  }
}

// ── The idea-focus suite (U4) ────────────────────────────────
// What the room does after it has read the wall: it opens ONE idea.
// This suite reviews that state on the shipped Stage — the shared
// typographic plate standing in for a print that was never developed,
// the manuscript's hierarchy at room scale, the boundaries of
// previous/next, the actions that close it, and the Board card the
// same component still has to render unchanged.
async function measureFocus(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const px = (el) => (el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0);
    const card = document.querySelector('[role="dialog"]');
    const plate = card ? card.querySelector('[data-qa="stage-plate"]') : null;
    const img = card ? card.querySelector("img") : null;
    const region = img
      ? img.closest('div[style*="aspect-ratio"]')
      : plate
      ? plate.parentElement
      : null;
    const title = card ? card.querySelector("input") : null;
    const areas = card ? Array.from(card.querySelectorAll("textarea")) : [];
    const kruger = document.querySelector('[data-qa="focus-kruger"]');
    const active = document.activeElement;
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      open: !!card,
      card: rect(card),
      transform: card ? getComputedStyle(card).transform : "",
      region: rect(region),
      plate: rect(plate),
      plateTitle: plate ? (plate.querySelector("h3")?.textContent || "").trim() : null,
      plateTitlePx: plate ? px(plate.querySelector("h3")) : 0,
      // The plate never repeats what the manuscript already holds in
      // full: in focus it carries the name, never the description.
      plateHasCopy: plate ? !!plate.querySelector("p") : false,
      plateFooter: plate ? (plate.querySelector(".slug.truncate")?.textContent || "").trim() : "",
      print: img
        ? (() => {
            const b = img.getBoundingClientRect();
            const r = region ? region.getBoundingClientRect() : b;
            const w = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left));
            const h = Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top));
            return {
              ratio: b.height ? b.width / b.height : 0,
              visible: b.width && b.height ? (w * h) / (b.width * b.height) : 0,
              width: b.width,
            };
          })()
        : null,
      titleValue: title ? title.value : null,
      titlePx: px(title),
      fieldPx: areas.map(px),
      description: areas[0] ? areas[0].value : null,
      // The picture region's own chrome: the close chip plus whatever
      // acts on the picture (the print chips).
      regionButtons: region
        ? Array.from(region.querySelectorAll("button")).map((b) => (b.innerText || "").replace(/\s+/g, " ").trim())
        : [],
      actions: card
        ? Array.from(card.querySelectorAll("button"))
            .map((b) => (b.innerText || "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
        : [],
      krugers: document.querySelectorAll(".kruger-bar").length,
      krugerText: kruger ? kruger.innerText.replace(/\s+/g, " ").trim() : "",
      focusInside: !!card && !!active && card.contains(active),
      // Where focus landed once the card closed — the card the room
      // opened it from, or nothing.
      focusReturnedTo:
        active && active.getAttribute("data-qa") === "stage-card" ? active.getAttribute("aria-label") : null,
      cards: document.querySelectorAll('[data-qa="stage-card"]').length,
      plates: document.querySelectorAll('[data-qa="stage-card"][data-fill="plate"]').length,
      shortlisted: document.querySelectorAll('[data-qa="stage-card"] button[aria-pressed="true"]').length,
      benchLabel: (() => {
        const b = Array.from(document.querySelectorAll("button")).find((el) => /set aside \(/i.test(el.textContent || ""));
        return b ? (b.textContent || "").replace(/\s+/g, " ").trim() : "";
      })(),
      fieldScrollTop: Math.round(document.querySelector('[data-qa="stage-field"]')?.scrollTop ?? -1),
      fieldScrolls: (() => {
        const f = document.querySelector('[data-qa="stage-field"]');
        return f ? f.scrollHeight > f.clientHeight + 1 : false;
      })(),
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

/** Open Confidence's whole board: two developed activation frames and one
 *  idea that was never pictured — the only wall in the showcase that
 *  puts a real key visual beside a plate. */
async function openMixedConfidence(browser, size) {
  const { context, page } = await openStage(browser, size);
  await page.locator('[data-qa="queue-row"]', { hasText: "Confidence" }).click();
  await page.waitForTimeout(1100);
  await releasePresentGate(page);
  return { context, page };
}

async function runFocusSuite(browser) {
  console.log("\n── IDEA FOCUS + THE PLATE ────────────────────────");

  for (const [label, size] of [["1280x720", LAPTOP], ["1920x1080", PROJECTOR]]) {
    const { context, page } = await openMixedConfidence(browser, size);
    try {
      const wall = await measureStage(page);
      check(`stage-focus-${label}`, "the wall under review really is mixed — a real key visual beside a plate",
        wall.fills.includes("print") && wall.fills.includes("plate"), JSON.stringify(wall.fills));
      check(`stage-focus-${label}`, "the overview holds no Kruger — the viewport marks the presenter",
        wall.krugers === 0, `found ${wall.krugers}`);
      await shootStage(page, `stage-plate-wall-${label}`,
        `The plate beside a real activation frame, one title size on both @ ${label}`);

      // ── The text-only path ──
      console.log(`\n  stage-focus-plate-${label}`);
      await page.locator('[data-qa="stage-card"][data-fill="plate"]').first().click();
      await page.waitForTimeout(1200);
      const plate = await measureFocus(page);
      console.log(
        `    · card ${Math.round(plate.card.width)}×${Math.round(plate.card.height)}` +
        ` · plate ${Math.round(plate.plate?.width || 0)}×${Math.round(plate.plate?.height || 0)} @ ${plate.plateTitlePx}px` +
        ` · title ${plate.titlePx}px · fields ${JSON.stringify(plate.fieldPx)}`,
      );
      check(`stage-focus-plate-${label}`, "a text-only idea opens as a spread, not a column with nothing in it",
        !!plate.plate && plate.plate.width > 300 && plate.plate.height > 180,
        plate.plate ? `${Math.round(plate.plate.width)}×${Math.round(plate.plate.height)}` : "no plate");
      check(`stage-focus-plate-${label}`, "the picture region is filled edge to edge — no blank media area",
        !!plate.region && !!plate.plate &&
        Math.abs(plate.plate.width - plate.region.width) < 2 && Math.abs(plate.plate.height - plate.region.height) < 2,
        plate.region ? `region ${Math.round(plate.region.width)}×${Math.round(plate.region.height)}` : "no region");
      check(`stage-focus-plate-${label}`, "the plate carries the idea's own name, at room scale",
        plate.plateTitle === plate.titleValue && plate.plateTitlePx >= 30,
        `"${plate.plateTitle}" @ ${plate.plateTitlePx}px`);
      check(`stage-focus-plate-${label}`, "the plate names the team and the platform it belongs to",
        /confidence/i.test(plate.plateFooter) && /proof-over-polish/i.test(plate.plateFooter), plate.plateFooter);
      check(`stage-focus-plate-${label}`, "the description is not printed twice — the manuscript holds it, the plate does not",
        !plate.plateHasCopy && !!plate.description && plate.description.length > 60);
      check(`stage-focus-plate-${label}`, "the plate is the display and the name field is the control",
        plate.titlePx < plate.plateTitlePx, `field ${plate.titlePx}px vs plate ${plate.plateTitlePx}px`);
      check(`stage-focus-plate-${label}`, "the idea outranks the fields that support it",
        plate.fieldPx.length === 3 && plate.fieldPx[0] > plate.fieldPx[1] && plate.fieldPx[0] >= 24,
        JSON.stringify(plate.fieldPx));
      check(`stage-focus-plate-${label}`, "the Stage actions are all still on the card",
        ["Done", "Set aside", "Shortlist"].every((a) => plate.actions.some((t) => t === a || t.includes(a))),
        JSON.stringify(plate.actions));
      check(`stage-focus-plate-${label}`, "exactly one Kruger, and it marks the idea the room opened",
        plate.krugers === 1 && /confidence/i.test(plate.krugerText), `${plate.krugers} · "${plate.krugerText}"`);
      check(`stage-focus-plate-${label}`, "the page never scrolls behind the focus state", !plate.docOverflow);
      await shootStage(page, `stage-focus-plate-${label}`,
        `Idea focus — a text-only idea on the shared plate @ ${label}`);

      // ── The developed path ── two steps on, to the idea whose
      //    activation frame was left behind by a rewrite: a real key
      //    visual that still carries a picture action.
      console.log(`\n  stage-focus-print-${label}`);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(600);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1300);
      const printed = await measureFocus(page);
      console.log(
        `    · print ${Math.round(printed.print?.width || 0)}px · ratio ${(printed.print?.ratio || 0).toFixed(2)}` +
        ` · ${Math.round((printed.print?.visible || 0) * 100)}% of the frame visible · title ${printed.titlePx}px`,
      );
      check(`stage-focus-print-${label}`, "the developed print takes the picture region",
        !!printed.print && printed.print.width > 300, printed.print ? `${Math.round(printed.print.width)}px` : "no print");
      check(`stage-focus-print-${label}`, "the print holds its 16:9 frame",
        !!printed.print && Math.abs(printed.print.ratio - 16 / 9) < 0.05, (printed.print?.ratio || 0).toFixed(3));
      check(`stage-focus-print-${label}`, "the spread's modest crop keeps at least 75% of the frame",
        !!printed.print && printed.print.visible >= 0.75, `${Math.round((printed.print?.visible || 0) * 100)}%`);
      check(`stage-focus-print-${label}`, "title, full description and print all read at room scale",
        printed.titlePx >= 26 && printed.fieldPx[0] >= 24 && !!printed.description,
        `title ${printed.titlePx}px · idea ${printed.fieldPx[0]}px`);
      check(`stage-focus-print-${label}`, "frame choosing stays a room conversation — the picture keeps its own chips",
        printed.regionButtons.some((t) => /choose another|generate again/i.test(t)),
        JSON.stringify(printed.regionButtons));
      check(`stage-focus-print-${label}`, "exactly one Kruger here too", printed.krugers === 1, `found ${printed.krugers}`);
      await shootStage(page, `stage-focus-print-${label}`,
        `Idea focus — a developed 16:9 activation frame @ ${label}`);

      // ── The full shortlist: the same two fills, at the moment the
      //    room actually chooses ──
      console.log(`\n  stage-shortlist-plate-${label}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      await page.locator("button", { hasText: "THE FULL SHORTLIST" }).first().click();
      await page.waitForTimeout(1700);
      const lineup = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[data-qa="shortlist-card"]'));
        const mat = (c) => {
          const el = c.querySelector('div[style*="aspect-ratio"]');
          const r = el ? el.getBoundingClientRect() : null;
          return r ? { ratio: r.width / r.height, width: r.width } : null;
        };
        return {
          count: cards.length,
          fills: cards.map((c) => c.getAttribute("data-fill")),
          mats: cards.map(mat),
          titlePx: [
            ...new Set(cards.map((c) => Math.round(parseFloat(getComputedStyle(c.querySelector("h3")).fontSize)))),
          ],
          plateCopy: cards
            .filter((c) => c.getAttribute("data-fill") === "plate")
            .map((c) => (c.querySelector('[data-qa="stage-plate"] p')?.textContent || "").trim().length),
        };
      });
      console.log(`    · ${lineup.count} shortlisted · fills ${lineup.fills.join(",")} · titles ${lineup.titlePx.join("/")}px`);
      check(`stage-shortlist-${label}`, "the shortlist really mixes printed and text-only ideas",
        lineup.fills.includes("print") && lineup.fills.includes("plate"), JSON.stringify(lineup.fills));
      check(`stage-shortlist-${label}`, "every shortlist card is a 16:9 mat — a print or a plate, never a bare caption",
        lineup.mats.every((m) => m && Math.abs(m.ratio - 16 / 9) < 0.06),
        JSON.stringify(lineup.mats.map((m) => (m ? m.ratio.toFixed(2) : "none"))));
      check(`stage-shortlist-${label}`, "ONE title size across the shortlist, printed or not",
        lineup.titlePx.length === 1, lineup.titlePx.join(" / "));
      check(`stage-shortlist-${label}`, "a text-only shortlist card carries its idea, not just its name",
        lineup.plateCopy.every((n) => n > 40), JSON.stringify(lineup.plateCopy));
      await shootStage(page, `stage-shortlist-plate-${label}`,
        `The full shortlist — text-only ideas hold the same 16:9 mat as prints @ ${label}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── Navigation: the collection's boundaries ──
  {
    const { context, page } = await openMixedConfidence(browser, LAPTOP);
    try {
      console.log("\n  stage-focus-navigation");
      await page.locator('[data-qa="stage-card"]').first().click();
      await page.waitForTimeout(1000);
      const first = await measureFocus(page);
      check("stage-focus-nav", "the position reports the ACTIVE team's own collection",
        /confidence 1\/3/i.test(first.krugerText), first.krugerText);

      const step = async () => {
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(650);
        return measureFocus(page);
      };
      await step();
      const last = await step();
      check("stage-focus-nav", "next walks to the end of this team's Stage collection",
        /confidence 3\/3/i.test(last.krugerText), last.krugerText);
      const crossed = await step();
      check("stage-focus-nav", "at the team's boundary it crosses to the next team, renumbered from one",
        /skinfirst 1\/1/i.test(crossed.krugerText), crossed.krugerText);
      check("stage-focus-nav", "the team metadata crosses with it",
        crossed.titleValue !== last.titleValue && !!crossed.titleValue, `${last.titleValue} → ${crossed.titleValue}`);
      const wrapped = await step();
      check("stage-focus-nav", "at the collection's end it wraps to its first idea",
        /realness 1\/1/i.test(wrapped.krugerText), wrapped.krugerText);
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(650);
      const back = await measureFocus(page);
      check("stage-focus-nav", "previous from the first idea wraps to the last",
        back.titleValue === crossed.titleValue, `${back.titleValue}`);
      check("stage-focus-nav", "the collection is the STAGE's, not the whole board — a gated idea is never reached",
        !/gasp test|long copy|ligature/i.test(back.titleValue || ""), back.titleValue || "");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── Closing returns the room to the same wall, in the same place ──
  {
    const { context, page } = await openMixedConfidence(browser, LAPTOP);
    try {
      console.log("\n  stage-focus-return (scroll position)");
      await quickAdd(page, 9, "Filed for the fold");
      await page.waitForTimeout(900);
      await page.evaluate(() => {
        const f = document.querySelector('[data-qa="stage-field"]');
        if (f) f.scrollTop = f.scrollHeight;
      });
      await page.waitForTimeout(400);
      const before = await measureFocus(page);
      check("stage-focus-return", "the twelve-idea wall really is scrolled off its top",
        before.fieldScrolls && before.fieldScrollTop > 20, `scrollTop ${before.fieldScrollTop}, scrolls ${before.fieldScrolls}`);
      await page.locator('[data-qa="stage-card"]').last().click();
      await page.waitForTimeout(900);
      check("stage-focus-return", "the overview stays mounted beneath the focus state",
        (await measureFocus(page)).cards === 12);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      const after = await measureFocus(page);
      check("stage-focus-return", "closing lands on the same overview",
        !after.open && after.cards === 12, `${after.cards} cards`);
      check("stage-focus-return", "…at the same scroll position",
        Math.abs(after.fieldScrollTop - before.fieldScrollTop) <= 2,
        `${before.fieldScrollTop} → ${after.fieldScrollTop}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The actions still act, and still return the room to the wall ──
  {
    const { context, page } = await openMixedConfidence(browser, LAPTOP);
    try {
      console.log("\n  stage-focus-actions");
      await page.locator('[data-qa="stage-card"]').first().click();
      await page.waitForTimeout(900);
      await page.locator('[role="dialog"] button', { hasText: /^★? ?Shortlist$/ }).last().click();
      await page.waitForTimeout(1200);
      const shortlisted = await measureFocus(page);
      check("stage-focus-actions", "Shortlist writes through and returns to the overview",
        !shortlisted.open && shortlisted.cards === 3 && shortlisted.shortlisted === 1,
        `${shortlisted.shortlisted} shortlisted · open ${shortlisted.open}`);

      await page.locator('[data-qa="stage-card"]').nth(1).click();
      await page.waitForTimeout(900);
      await page.locator('[role="dialog"] button', { hasText: "Set aside" }).click();
      await page.waitForTimeout(1300);
      const benched = await measureFocus(page);
      check("stage-focus-actions", "Set aside takes the idea off the wall and shows it on the bench",
        !benched.open && benched.cards === 2 && /set aside \(1\)/i.test(benched.benchLabel),
        `${benched.cards} cards · "${benched.benchLabel}"`);

      await page.locator('[data-qa="stage-card"]').first().click();
      await page.waitForTimeout(900);
      await page.locator('[role="dialog"] button', { hasText: /Confidence ▾/ }).click();
      await page.waitForTimeout(400);
      await page.locator("button", { hasText: /Move to Realness/i }).click();
      await page.waitForTimeout(1400);
      const moved = await measureFocus(page);
      check("stage-focus-actions", "Reassign moves the idea to another team's wall and closes onto this one",
        !moved.open && moved.cards === 1, `${moved.cards} cards`);
      await shootStage(page, "stage-focus-actions-1280x720",
        "After shortlist, set aside and reassign — the room is back on the same wall");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── Motion and the keyboard ──
  for (const [label, reduced] of [["motion", false], ["reduced-motion", true]]) {
    const context = await browser.newContext({
      viewport: LAPTOP,
      deviceScaleFactor: 1,
      ...(reduced ? { reducedMotion: "reduce" } : {}),
    });
    const page = await context.newPage();
    try {
      console.log(`\n  stage-focus-${label}`);
      await page.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);

      // Opened from the keyboard, so the card that raised it is a real
      // focus target to come back to.
      await page.locator('[data-qa="stage-card"]').first().focus();
      const opener = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
      await page.keyboard.press("Enter");
      const instant = await measureFocus(page);
      const identity = /^(none|matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\))$/.test(instant.transform);
      check(`stage-focus-${label}`, reduced
        ? "with reduced motion the card is simply there — no arrival travel"
        : "the arrival is an event — the card travels in",
        reduced ? identity : !identity, instant.transform);

      await page.waitForTimeout(900);
      const open = await measureFocus(page);
      check(`stage-focus-${label}`, "focus lands inside the overlay", open.focusInside);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      const closed = await measureFocus(page);
      check(`stage-focus-${label}`, "focus returns to the card that raised it",
        !closed.open && closed.focusReturnedTo === opener, `${closed.focusReturnedTo} vs ${opener}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The Board must not have moved ──
  {
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  board-open-card-regression");
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1600);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(1100);
      const text = await measureFocus(page);
      console.log(`    · card ${Math.round(text.card.width)}px · title ${text.titlePx}px · fields ${JSON.stringify(text.fieldPx)}`);
      check("board-open-card", "a text-only idea on the Board still opens as the manuscript column",
        !text.plate && Math.abs(text.card.width - 760) < 3, `${Math.round(text.card.width)}px, plate ${!!text.plate}`);
      check("board-open-card", "its title keeps the Board's own size", text.titlePx === 34, `${text.titlePx}px`);
      check("board-open-card", "its three framework fields are still peers at 18px",
        text.fieldPx.length === 3 && text.fieldPx.every((p) => p === 18), JSON.stringify(text.fieldPx));
      check("board-open-card", "the Board's action hierarchy is unchanged — Coach stays, the Stage actions stay away",
        text.actions.some((t) => /Coach this idea/i.test(t)) && !text.actions.some((t) => /^Set aside$/i.test(t)),
        JSON.stringify(text.actions));
      await shootStage(page, "board-open-card-text-1600x1000",
        "The same component on the Board — unchanged column, sizing and actions");

      console.log("\n  board-open-card-printed");
      await page.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1600);
      await page.locator('[data-qa="board-card"]:has(img)').first().click();
      await page.waitForTimeout(1300);
      const printed = await measureFocus(page);
      console.log(
        `    · card ${Math.round(printed.card.width)}px · print ratio ${(printed.print?.ratio || 0).toFixed(2)}` +
        ` · ${Math.round((printed.print?.visible || 0) * 100)}% visible · chips ${JSON.stringify(printed.regionButtons)}`,
      );
      check("board-open-card", "a printed idea still opens as the spread",
        Math.abs(printed.card.width - 1420) < 3 && !printed.plate, `${Math.round(printed.card.width)}px`);
      check("board-open-card", "the print keeps its 16:9 frame and its modest crop",
        !!printed.print && Math.abs(printed.print.ratio - 16 / 9) < 0.05 && printed.print.visible >= 0.75,
        `${(printed.print?.ratio || 0).toFixed(2)} · ${Math.round((printed.print?.visible || 0) * 100)}%`);
      check("board-open-card", "the print chips are still anchored on the picture",
        printed.regionButtons.some((t) => /choose another|generate again/i.test(t)),
        JSON.stringify(printed.regionButtons));
      check("board-open-card", "its framework fields are peers here too",
        printed.fieldPx.length === 3 && printed.fieldPx.every((p) => p === 18), JSON.stringify(printed.fieldPx));
      await shootStage(page, "board-open-card-printed-1600x1000",
        "The printed Board spread — chips, crop and field hierarchy unchanged");
    } finally {
      await page.close();
      await context.close();
    }
  }
}

// ── The cross-surface proof (U6) ─────────────────────────────
// The other five suites each prove one surface against its own unit.
// This one proves the three TOGETHER, and it does it by walking the room
// rather than by collecting stills: a card on the Board becomes an open
// idea; the Stage's active team becomes a focused idea and then a ballot;
// the Newsroom takes a live idea while the room watches. Every state the
// walk passes through is audited against the design contract — one
// Kruger, no red display type on dark, the projector floor, the serif
// law, the 16:9 print frame, one primary in the Control Strip — and the
// same idea is read on all three surfaces to check they tell one truth.

/** The laws in `docs/ogilvy-showcase-direction.md` that can be measured
 *  rather than judged. Run against whatever the room is looking at. */
async function auditContract(page) {
  return page.evaluate(() => {
    const RED = "rgb(235, 63, 67)";
    const leaves = Array.from(document.querySelectorAll("h1,h2,h3,h4,p,span,div,button,li,td,th"))
      .filter((el) => {
        if (el.childElementCount > 0) return false;
        if (!(el.textContent || "").trim()) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
      });
    const describe = (el) => {
      const cs = getComputedStyle(el);
      return {
        text: (el.textContent || "").trim().slice(0, 40),
        px: Math.round(parseFloat(cs.fontSize)),
        family: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
        color: cs.color,
      };
    };
    const strip = document.querySelector('[data-qa="control-strip"]');
    return {
      krugers: document.querySelectorAll(".kruger-bar").length,
      // Round 7 item 5 / "no red running text on dark": red is a ground
      // for a mark, never a face for display type.
      redDisplay: leaves
        .filter((el) => {
          const cs = getComputedStyle(el);
          return cs.color === RED && parseFloat(cs.fontSize) >= 20;
        })
        .map(describe),
      // Round 4 item 2, the serif law: Ogilvy Serif earns its place at
      // ≥28px as a named moment; below 24px it is Sans.
      serifUnder24: leaves
        .filter((el) => {
          const cs = getComputedStyle(el);
          return /Ogilvy Serif/i.test(cs.fontFamily) && parseFloat(cs.fontSize) < 24;
        })
        .map(describe),
      // The standing projector rule, applied to what it is actually
      // about: the copy the room READS. Headings, idea titles and
      // running prose sit at or above 16px. The 10–13px micro-register
      // (slugs, stamps, chips, count pips) is a separate sanctioned
      // class and is censused below, not gated — see the ledger's
      // "what this pass did not touch".
      primaryUnderFloor: leaves
        .filter((el) => {
          const cs = getComputedStyle(el);
          const px = parseFloat(cs.fontSize);
          if (px >= 16) return false;
          // An uppercase, tracked line is an eyebrow or a slug — the
          // contract's own 12–13px label register, not display type.
          if (cs.textTransform === "uppercase" && parseFloat(cs.letterSpacing) >= 1) return false;
          const words = (el.textContent || "").trim().split(/\s+/).length;
          return /^H[1-3]$/.test(el.tagName) || (el.tagName === "P" && words >= 8);
        })
        .map(describe),
      microRegister: leaves
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
        .map(describe),
      // Round 7 item 2: one primary per Control Strip state.
      stripPrimaries: strip
        ? Array.from(strip.querySelectorAll("button")).filter(
            (b) => getComputedStyle(b).backgroundColor === RED,
          ).map((b) => (b.innerText || "").trim())
        : [],
      stripBottom: strip ? strip.getBoundingClientRect().bottom : null,
      viewportH: window.innerHeight,
    };
  });
}

// Every micro-register sighting the audit meets, so the census is one
// number at the end of the run rather than an assertion nobody can act on.
const micro = new Map();

function assertContract(name, a, { krugers = 1 } = {}) {
  check(name, `at most ${krugers} Kruger on the screen — red marks the room's current object, once`,
    a.krugers <= krugers, `found ${a.krugers}`);
  check(name, "no red display type on the dark register",
    a.redDisplay.length === 0, JSON.stringify(a.redDisplay));
  check(name, "the serif law holds — no Ogilvy Serif under 24px",
    a.serifUnder24.length === 0, JSON.stringify(a.serifUnder24));
  check(name, "every heading and every run of prose clears the 16px projector floor",
    a.primaryUnderFloor.length === 0, JSON.stringify(a.primaryUnderFloor));
  if (a.stripBottom !== null) {
    check(name, "one primary in the Control Strip, and the strip is still on the bottom edge",
      a.stripPrimaries.length <= 1 && Math.abs(a.stripBottom - a.viewportH) < 2,
      `${JSON.stringify(a.stripPrimaries)} · bottom ${Math.round(a.stripBottom)} of ${a.viewportH}`);
  }
  for (const m of a.microRegister) {
    const key = `${m.px}px ${m.family} — "${m.text}"`;
    micro.set(key, (micro.get(key) || 0) + 1);
  }
}

async function shootProof(page, name, caption, full = false) {
  await mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: full });
  results.captures.push({ name, caption, file });
}

/** What a surface says about the ideas it is showing — the shape all
 *  three have to agree on. */
const READ_BOARD = () => {
  const cards = Array.from(document.querySelectorAll('[data-qa="board-card"]'));
  return {
    titles: cards.map((c) => (c.querySelector("h3, h2")?.textContent || "").trim()),
    printed: cards.filter((c) => c.querySelector("img")).map((c) => (c.querySelector("h3, h2")?.textContent || "").trim()),
    descriptions: cards.map((c) => {
      const ps = Array.from(c.querySelectorAll("p")).map((el) => (el.textContent || "").trim());
      return ps.sort((a, b) => b.length - a.length)[0] || "";
    }),
    tabCounts: Array.from(document.querySelectorAll('[data-qa="board-tabs"] button')).map((b) => {
      const m = (b.textContent || "").match(/(\d+)\s*$/);
      return m ? Number(m[1]) : 0;
    }),
  };
};

const READ_STAGE = () => {
  const cards = Array.from(document.querySelectorAll('[data-qa="stage-card"]'));
  return {
    titles: cards.map((c) => (c.querySelector("h3")?.textContent || "").trim()),
    printed: cards.filter((c) => c.getAttribute("data-fill") === "print")
      .map((c) => (c.querySelector("h3")?.textContent || "").trim()),
    team: document.querySelector('[data-qa="active-team"] h2')?.textContent?.trim() || "",
  };
};

async function runProofSuite(browser) {
  console.log("\n══ THE CROSS-SURFACE PROOF (U6) ══════════════════");

  // ── FLOW 1 — THE BOARD: a card on the wall becomes an open idea ──
  // group-2 is the hard case on both axes: the longest configured
  // platform name, and the only board that mixes real activation frames
  // with text-only ideas.
  {
    const context = await browser.newContext({ viewport: NARROW, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  FLOW 1 · the Board — wall → open idea → back to the wall");
      await page.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1600);

      const narrow = await measureBoard(page);
      console.log(`    · 918×929 — "${narrow.h1Text}" @ ${narrow.h1Size}px · ${narrow.gridColumnCount} col · ${narrow.cardCount} cards`);
      assertBoard("proof-board-narrow", narrow);
      assertContract("proof-board-narrow", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-board-narrow-918x929",
        "The Board at 918×929 — the longest platform name owns the band, the making band heads the wall", true);

      // The same wall at the laptop width the room actually works on.
      await page.setViewportSize(LAPTOP);
      await page.waitForTimeout(900);
      const mixed = await measureBoard(page);
      console.log(`    · 1280×720 — ${mixed.gridColumnCount} col × ${Math.round(mixed.gridColumnWidth)}px · ${mixed.printedCards} printed`);
      assertBoard("proof-board-mixed", mixed);
      check("proof-board-mixed", "the wall really is mixed — prints beside text-only ideas",
        mixed.printedCards > 0 && mixed.printedCards < mixed.cardCount,
        `${mixed.printedCards} of ${mixed.cardCount}`);
      check("proof-board-mixed", "every print keeps its full 16:9 frame at the card's inner width",
        mixed.printFrames.every((p) => Math.abs(p.ratio - 16 / 9) < 0.06 && p.fillsMat > 0.99),
        JSON.stringify(mixed.printFrames.map((p) => `${p.ratio.toFixed(2)}/${p.fillsMat.toFixed(2)}`)));
      await shootProof(page, "proof-board-mixed-1280x720",
        "The same board at 1280×720 — mixed prints and text, one description per idea", true);

      const boardTruth = await page.evaluate(READ_BOARD);

      // ── the flow: the card the room clicks becomes the open idea ──
      const closedTitle = boardTruth.titles[0];
      const closedDescription = boardTruth.descriptions[0];
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(1100);
      const open = await measureFocus(page);
      check("proof-board-open", "the card the room clicked is the idea that opened",
        open.open && open.titleValue === closedTitle, `"${open.titleValue}" vs "${closedTitle}"`);
      check("proof-board-open", "the open card carries the same description, in full and editable",
        closedDescription.length > 40 && open.description === closedDescription,
        `closed "${closedDescription.slice(0, 44)}…"`);
      check("proof-board-open", "no Kruger follows the idea onto the Board — the Board is not the room's screen",
        open.krugers === 0, `found ${open.krugers}`);
      assertContract("proof-board-open", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-board-open-1280x720",
        "The Board flow's end — the clicked card, open, with the same description in full");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      const back = await measureBoard(page);
      check("proof-board-open", "closing lands the room back on the wall it came from",
        back.cardCount === mixed.cardCount &&
          JSON.stringify(back.frames) === JSON.stringify(mixed.frames),
        `${back.cardCount} cards, frames ${JSON.stringify(back.frames)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── FLOW 2 — THE STAGE: active team → focus → ballot → returns ──
  {
    const { context, page } = await openStage(browser, LAPTOP);
    try {
      console.log("\n  FLOW 2 · the Stage — active team → focus → ballot → returns → shortlist");
      const cold = await measureStage(page);
      check("proof-stage-open", "the room opens on the configured team, with the rest in the queue",
        /^realness$/i.test(cold.team) && cold.queueRows.length === 2, `${cold.team} · ${cold.queueRows.length} queued`);
      check("proof-stage-open", "the Control Strip names the same team the viewport holds",
        cold.stripText.includes("REALNESS"), cold.stripText.slice(0, 60));

      // Hand the wall to the only team whose board mixes prints and plates.
      await page.locator('[data-qa="queue-row"]', { hasText: "Confidence" }).click();
      await page.waitForTimeout(1200);
      await releasePresentGate(page);
      await quickAdd(page, 3, "Filed on the Stage");
      await page.waitForTimeout(1000);

      const six = await measureStage(page);
      console.log(`    · six — ${six.columns} col × ${JSON.stringify(six.cardBox)} · fills ${six.fills.join(",")} · visible ${six.visibleCards}/${six.cards}`);
      assertStage("proof-stage-six", six, 6);
      check("proof-stage-six", "six ideas all read at once at 1280×720 — the density R8 protects",
        !six.fieldScrolls && six.visibleCards === 6, `${six.visibleCards}/6, scrolls ${six.fieldScrolls}`);
      check("proof-stage-six", "ONE title size across the wall, print and plate alike",
        six.titleSizes.length === 1, six.titleSizes.join(" / "));
      assertContract("proof-stage-six", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-stage-six-1280x720",
        "Six mixed ideas on the active team's wall — one anatomy, two fills, no Kruger @ 1280×720");

      // ── focus: the print, then the plate, reached by navigating ──
      await page.locator('[data-qa="stage-card"][data-fill="print"]').first().click();
      await page.waitForTimeout(1200);
      const printed = await measureFocus(page);
      console.log(`    · focus/print — ${Math.round(printed.print?.width || 0)}px · ratio ${(printed.print?.ratio || 0).toFixed(2)} · ${Math.round((printed.print?.visible || 0) * 100)}% visible · Kruger "${printed.krugerText}"`);
      check("proof-stage-focus-print", "the print takes the picture region at its full 16:9, modestly cropped at worst",
        !!printed.print && Math.abs(printed.print.ratio - 16 / 9) < 0.05 && printed.print.visible >= 0.75,
        `${(printed.print?.ratio || 0).toFixed(3)} · ${Math.round((printed.print?.visible || 0) * 100)}%`);
      check("proof-stage-focus-print", "THE one Kruger of the whole pass — the focus position chip",
        printed.krugers === 1 && /\d+\/\d+/.test(printed.krugerText), `${printed.krugers} · "${printed.krugerText}"`);
      assertContract("proof-stage-focus-print", await auditContract(page));
      await shootProof(page, "proof-stage-focus-print-1280x720",
        "Idea focus on a developed activation frame — the single Kruger rides the position chip @ 1280×720");

      // Navigation, not a second click: walk BACK through the active
      // team's own collection until an idea that was never pictured.
      let plate = printed;
      for (let i = 0; i < 8 && !plate.plate; i++) {
        await page.keyboard.press("ArrowLeft");
        await page.waitForTimeout(650);
        plate = await measureFocus(page);
      }
      console.log(`    · focus/plate — plate ${Math.round(plate.plate?.width || 0)}×${Math.round(plate.plate?.height || 0)} @ ${plate.plateTitlePx}px · Kruger "${plate.krugerText}"`);
      check("proof-stage-focus-plate", "previous/next reaches a text-only idea without leaving focus",
        !!plate.plate && plate.open, plate.plate ? "reached" : "never found a plate");
      check("proof-stage-focus-plate", "the plate fills the picture region — never a blank media hole",
        !!plate.region && Math.abs(plate.plate.width - plate.region.width) < 2 &&
        Math.abs(plate.plate.height - plate.region.height) < 2,
        plate.region ? `${Math.round(plate.region.width)}×${Math.round(plate.region.height)}` : "no region");
      check("proof-stage-focus-plate", "the description is printed once — the manuscript holds it, the plate does not",
        !plate.plateHasCopy && !!plate.description && plate.description.length > 60);
      check("proof-stage-focus-plate", "still exactly one Kruger, and the position travelled with the idea",
        plate.krugers === 1 && plate.krugerText !== printed.krugerText,
        `"${printed.krugerText}" → "${plate.krugerText}"`);
      assertContract("proof-stage-focus-plate", await auditContract(page));
      await shootProof(page, "proof-stage-focus-plate-1280x720",
        "The same focus state on an idea that was never pictured — the typographic plate @ 1280×720");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);

      // ── ten-plus: overflow is obvious and no fixed chrome moves ──
      await quickAdd(page, 6, "Overflow");
      await page.waitForTimeout(1000);
      const dense = await measureStage(page);
      console.log(`    · twelve — visible ${dense.visibleCards}/${dense.cards} · field scrolls ${dense.fieldScrolls}`);
      assertStage("proof-stage-tenplus", dense, 12);
      check("proof-stage-tenplus", "the overflow scrolls INSIDE the work area — the shell never moves",
        dense.fieldScrolls && !dense.docVOverflow);
      check("proof-stage-tenplus", "the queue never grew into the card field",
        !!dense.queue && dense.queue.height < dense.viewport.h * 0.2, `${Math.round(dense.queue?.height || 0)}px`);
      assertContract("proof-stage-tenplus", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-stage-tenplus-1280x720",
        "Twelve ideas — the field absorbs them, the queue and the Control Strip hold @ 1280×720");

      // ── the ballot: the protected state, repaired for 720p ──
      await page.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
      await page.waitForTimeout(2600);
      const ballot = await measureBallot(page);
      console.log(`    · ballot — QR ${Math.round(ballot.qr.top)}–${Math.round(ballot.qr.bottom)} · caption ${Math.round(ballot.caption.bottom)} · fold ${Math.round(ballot.strip.top)}`);
      assertBallot("proof-stage-voting", ballot);
      assertContract("proof-stage-voting", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-stage-voting-1280x720",
        "The ballot — the count and the way in, both whole @ 1280×720");

      // ── the returns: the ONE state where red declares a winner ──
      await page.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
      await page.waitForTimeout(1000);
      await page.locator('[data-qa="control-strip"] button', { hasText: "Show the returns" }).click();
      await page.waitForTimeout(2800);
      const returns = await measureStage(page);
      const leader = await page.evaluate(() => {
        const RED = "rgb(235, 63, 67)";
        return {
          redGrounds: Array.from(document.querySelectorAll("div")).filter(
            (el) => getComputedStyle(el).backgroundColor === RED,
          ).length,
          marks: document.querySelectorAll('svg path[stroke="#002663"]').length,
          topRank: document.body.innerText.includes("#1"),
        };
      });
      console.log(`    · returns — ${leader.redGrounds} red slab(s) · ${leader.marks} china-mark(s) · .kruger-bar ${returns.krugers}`);
      check("proof-stage-returns", "the returns rank every team's ideas of the category together", returns.returns);
      // Round 18 (user ruling 2026-08-03, "no more circling at all"): the
      // returns declare their leader with the red vote slab and the rank
      // ALONE — no china-marker, no Kruger bar. The circle was a third red
      // on a card that already said it twice. The one `.kruger-bar` this
      // pass ships lives on the focus position chip.
      check("proof-stage-returns", "the leader is declared once — one red slab, no china-marker, no Kruger bar",
        returns.krugers === 0 && leader.redGrounds === 1 && leader.marks === 0 && leader.topRank,
        `${leader.redGrounds} slab · ${leader.marks} mark · ${returns.krugers} kruger`);
      check("proof-stage-returns", "no queue band intrudes on the returns", !returns.queue);
      assertContract("proof-stage-returns", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-stage-returns-1280x720",
        "The returns — one Kruger, on the leading idea @ 1280×720");

      // ── the full shortlist: the wall the room chooses from ──
      await page.locator("button", { hasText: "THE FULL SHORTLIST" }).first().click();
      await page.waitForTimeout(1900);
      const lineup = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('[data-qa="shortlist-card"]'));
        return {
          count: cards.length,
          fills: cards.map((c) => c.getAttribute("data-fill")),
          titlePx: [...new Set(cards.map((c) => Math.round(parseFloat(getComputedStyle(c.querySelector("h3")).fontSize))))],
          mats: cards.map((c) => {
            const el = c.querySelector('div[style*="aspect-ratio"]');
            const r = el ? el.getBoundingClientRect() : null;
            return r ? r.width / r.height : 0;
          }),
        };
      });
      console.log(`    · full shortlist — ${lineup.count} cards · fills ${lineup.fills.join(",")} · titles ${lineup.titlePx.join("/")}px`);
      check("proof-stage-full-shortlist", "every shortlist card is a 16:9 mat — a print or a plate, never a bare caption",
        lineup.count > 0 && lineup.mats.every((r) => Math.abs(r - 16 / 9) < 0.06),
        JSON.stringify(lineup.mats.map((r) => r.toFixed(2))));
      check("proof-stage-full-shortlist", "ONE title size here too, printed or not",
        lineup.titlePx.length === 1, lineup.titlePx.join(" / "));
      assertContract("proof-stage-full-shortlist", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-stage-full-shortlist-1280x720",
        "The full shortlist — the same two fills, the same title size @ 1280×720");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The projector matrix — the same Stage states at 1920×1080 ──
  {
    const { context, page } = await openStage(browser, PROJECTOR);
    try {
      console.log("\n  proof-stage @ 1920×1080");
      await page.locator('[data-qa="queue-row"]', { hasText: "Confidence" }).click();
      await page.waitForTimeout(1200);
      await releasePresentGate(page);
      await quickAdd(page, 3, "Filed on the Stage");
      await page.waitForTimeout(1000);
      const six = await measureStage(page);
      console.log(`    · six — ${six.columns} col × ${JSON.stringify(six.cardBox)} · visible ${six.visibleCards}/${six.cards}`);
      assertStage("proof-stage-six-projector", six, 6);
      assertContract("proof-stage-six-projector", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-stage-six-1920x1080",
        "The same six on a 1080p wall — the anatomy holds, the frames grow @ 1920×1080");

      await page.locator('[data-qa="stage-card"][data-fill="print"]').first().click();
      await page.waitForTimeout(1300);
      const printed = await measureFocus(page);
      check("proof-stage-focus-projector", "the focused print holds its frame at projector size",
        !!printed.print && Math.abs(printed.print.ratio - 16 / 9) < 0.05 && printed.print.visible >= 0.75,
        `${(printed.print?.ratio || 0).toFixed(3)} · ${Math.round((printed.print?.visible || 0) * 100)}%`);
      check("proof-stage-focus-projector", "and still exactly one Kruger", printed.krugers === 1, `found ${printed.krugers}`);
      assertContract("proof-stage-focus-projector", await auditContract(page));
      await shootProof(page, "proof-stage-focus-print-1920x1080",
        "Idea focus at projector size — one Kruger, full frame @ 1920×1080");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── FLOW 3 — THE NEWSROOM: cold load → a live idea lands ──
  {
    const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  FLOW 3 · the Newsroom — cold load → unequal totals → a live idea");
      await page.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector('[data-qa="team-row"]', { timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1700);

      const load = await measureNewsroom(page);
      console.log(`    · load — ${load.marquee.map((s) => `${s.label} ${s.value}`).join(" · ")}`);
      assertTracking("proof-newsroom-load", load);
      assertContract("proof-newsroom-load", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-newsroom-load-1280x720",
        "The Newsroom as the room opens — configured order, exact coaching count, no ranking");

      await broadcast(page, insertEvents("ideas", UNEQUAL_BATCH));
      await page.waitForTimeout(2600);
      const unequal = await measureNewsroom(page);
      console.log(`    · unequal — totals ${JSON.stringify(unequal.totals)}`);
      assertTracking("proof-newsroom-tracking", unequal);
      check("proof-newsroom-tracking", "the totals really are unequal and configured order is provably not total order",
        new Set(unequal.totals).size === 3 && unequal.totals[1] < unequal.totals[2] && unequal.totals[1] < unequal.totals[0],
        JSON.stringify(unequal.totals));
      check("proof-newsroom-tracking", "ZERO Krugers on this surface — the desk tracks the room, it does not rank it",
        unequal.krugers === 0, `found ${unequal.krugers}`);
      assertContract("proof-newsroom-tracking", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-newsroom-tracking-1280x720",
        "Deliberately unequal team totals — no rank numeral, no leader red, no reorder @ 1280×720");

      await broadcast(page, insertEvents("ideas", LIVE_BATCH));
      await page.waitForTimeout(2600);
      const live = await measureNewsroom(page);
      console.log(`    · live — totals ${JSON.stringify(live.totals)} · pace ${JSON.stringify(live.pace)}`);
      assertTracking("proof-newsroom-live", live);
      check("proof-newsroom-live", "the live idea moves the team total, the marquee and Pace",
        live.totals[2] === unequal.totals[2] + LIVE_BATCH.length &&
        live.marquee[0].value === unequal.marquee[0].value + LIVE_BATCH.length &&
        live.pace[2] === "surging",
        `${unequal.totals[2]} → ${live.totals[2]} · pace ${live.pace[2]}`);
      check("proof-newsroom-live", "the wire carries it", live.wireTop.includes(LIVE_BATCH[0].name), live.wireTop.slice(0, 70));
      check("proof-newsroom-live", "and the rows never moved — the team that surged is still the last row",
        JSON.stringify(live.order) === JSON.stringify(unequal.order) && live.totals[2] > live.totals[0],
        JSON.stringify(live.order));
      assertContract("proof-newsroom-live", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-newsroom-live-1280x720",
        "A live idea lands — the numbers move, the order does not @ 1280×720");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // The Newsroom on the projector, since the room reads it standing up.
  {
    const context = await browser.newContext({ viewport: PROJECTOR, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  proof-newsroom @ 1920×1080");
      await page.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector('[data-qa="team-row"]', { timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1700);
      await broadcast(page, insertEvents("ideas", [...UNEQUAL_BATCH, ...LIVE_BATCH]));
      await page.waitForTimeout(2600);
      const m = await measureNewsroom(page);
      assertTracking("proof-newsroom-projector", m);
      assertContract("proof-newsroom-projector", await auditContract(page), { krugers: 0 });
      await shootProof(page, "proof-newsroom-tracking-1920x1080",
        "The same unequal room on a 1080p wall — still a tracking desk @ 1920×1080");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── One truth across three surfaces ──
  // Read cold, in a context of its own, so nothing the flows filed can
  // flatter the comparison.
  {
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  proof-agreement (Board ↔ Stage ↔ Newsroom)");
      await page.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.locator('[data-qa="queue-row"]', { hasText: "Confidence" }).click();
      await page.waitForTimeout(1200);
      await releasePresentGate(page);
      const stage = await page.evaluate(READ_STAGE);

      await page.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1600);
      const board = await page.evaluate(READ_BOARD);

      await page.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForSelector('[data-qa="team-row"]', { timeout: 30000 });
      await page.waitForTimeout(1700);
      const desk = await measureNewsroom(page);
      const confidenceRow = desk.order.indexOf("group-2");

      console.log(`    · Stage "${stage.team}" ${stage.titles.length} · Board ${board.titles.length} in view, tabs ${JSON.stringify(board.tabCounts)} · Newsroom row ${desk.totals[confidenceRow]}`);
      check("proof-agreement", "every idea the Stage shows is an idea from that team's Board, by name",
        stage.titles.length > 0 && stage.titles.every((t) => board.titles.includes(t)),
        `stage ${JSON.stringify(stage.titles)}`);
      check("proof-agreement", "an idea that is printed on the Board is printed on the Stage, and only those",
        JSON.stringify([...stage.printed].sort()) ===
          JSON.stringify(board.printed.filter((t) => stage.titles.includes(t)).sort()),
        `stage ${JSON.stringify(stage.printed)} vs board ${JSON.stringify(board.printed)}`);
      check("proof-agreement", "the team identity is the same object on both",
        /confidence/i.test(stage.team) && /confidence/i.test(desk.names[confidenceRow]),
        `${stage.team} / ${desk.names[confidenceRow]}`);
      check("proof-agreement", "the Newsroom's total for that team is the sum of its own category tabs",
        desk.totals[confidenceRow] === board.tabCounts.reduce((a, b) => a + b, 0),
        `newsroom ${desk.totals[confidenceRow]} vs tabs ${JSON.stringify(board.tabCounts)}`);
    } finally {
      await page.close();
      await context.close();
    }
  }
}

// ── The identity suite (U7) ──────────────────────────────────
// Two rulings settled on 2026-08-03, walked together because they
// answer the same question about one idea: WHICH IDEA IS THIS, and DID
// THE ROOM SEE IT?
//
//   1. THE BALLOT VOTES ON WHAT THE ROOM SAW. The phone's options and
//      the returns' rows are the Stage's present-gated collection — no
//      more, no less. Nothing a team selected is removed; a team that
//      selected nothing still puts its whole board up.
//   2. THE № IS THE IDEA'S IDENTITY, NOT ITS SEAT. Assigned at creation
//      inside its team + category, it survives coaching, re-sorting and
//      set-aside, agrees between the Board and the Stage, and is
//      qualified with the team (`CONFIDENCE 03`) wherever teams stand
//      together.
//
// Both are walked on the shipped surfaces with the room's own controls.

/** The phone the room votes on — PHONE is declared with the other
 *  viewports at the top of the file, so the Board suite can reach it. */

/** Title + printed number for whatever cards a surface is showing. */
async function readNumbered(page, cardSel) {
  return page.evaluate((sel) => {
    // SEAT IS THE SURFACE'S OWN ORDER, NOT THE DOM'S. The Board's wall is
    // a masonry, so its DOM runs column by column — and since Round 19
    // seated the making pockets at the head of column one, the board's
    // FIRST idea is no longer the first card in the DOM (it sits in
    // column two, beside the pockets). A board card publishes its sort
    // position as data-qa-seat; where that exists it is the order. Every
    // other surface (the Stage, the returns, the shortlist) lays out in
    // its own order and keeps DOM order.
    const rows = Array.from(document.querySelectorAll(sel)).map((c, i) => ({
      seat: c.dataset.qaSeat != null ? Number(c.dataset.qaSeat) + 1 : i + 1,
      title: (c.querySelector("h3") || c.querySelector("h2"))?.textContent?.trim() || "",
      tag: (c.querySelector('[data-qa="idea-no"]')?.textContent || "").replace(/\s+/g, " ").trim(),
    }));
    return rows.sort((a, b) => a.seat - b.seat);
  }, cardSel);
}

/** `№03` → 3 · `CONFIDENCE 03` → 3 */
const noOf = (tag) => {
  const m = (tag || "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
};
/** A qualified tag names its team; a bare one carries no letters at all. */
const isQualified = (tag) => /[A-Za-z]{3}/.test((tag || "").replace(/№/g, ""));
/** title → № , key-order independent so a re-sort cannot fake a match. */
const numberMap = (rows) =>
  JSON.stringify(
    rows
      .map((r) => [r.title, noOf(r.tag)])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
const titleSet = (rows) => JSON.stringify(rows.map((r) => r.title).sort());

/** Read the whole ballot the phone is offering. */
async function readBallot(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-qa="ballot-option"]')).map((el) =>
      (el.querySelector("h3")?.textContent || "").trim(),
    ),
  );
}

async function runIdentitySuite(browser) {
  console.log("\n══ THE IDENTITY PASS (U7) ════════════════════════");

  // ── FLOW 1 — the Board: coaching re-sorts the wall, not the numbers ──
  // group-2 / New Craft is the hard case: one coached idea and two
  // drafts, so coaching the LAST card lifts it past a draft and the old
  // positional № would have handed it a different name mid-session.
  {
    const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  FLOW 1 · the Board — coach an idea; the wall moves, the № does not");
      await page.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1600);

      const before = await readNumbered(page, '[data-qa="board-card"]');
      console.log(`    · before  ${before.map((r) => `${r.seat}:${r.tag}`).join("   ")}`);
      check("identity-board", "every card on the wall carries a number",
        before.length > 2 && before.every((r) => noOf(r.tag) != null),
        JSON.stringify(before.map((r) => r.tag)));
      check("identity-board", "the numbers are unique inside the team's category",
        new Set(before.map((r) => noOf(r.tag))).size === before.length,
        JSON.stringify(before.map((r) => r.tag)));
      check("identity-board", "the Board's number stands bare — this is one team's surface",
        before.every((r) => !isQualified(r.tag)), JSON.stringify(before.map((r) => r.tag)));
      await shootProof(page, "identity-board-before-1280x720",
        "The Board before coaching — the wall in status order, every frame numbered", true);

      // The last card is a draft; coaching it moves it up the status
      // sort. That is the exact move that used to rename it.
      const target = before[before.length - 1];
      // Reached by its SEAT, not by its DOM index: the wall's masonry
      // columns and the board's sort order are different sequences now.
      await page.locator(`[data-qa="board-card"][data-qa-seat="${target.seat - 1}"]`).click();
      await page.waitForTimeout(1100);
      await page.locator("button", { hasText: "Coach this idea" }).first().click();
      await page.waitForTimeout(1400);
      await page.locator("button", { hasText: "The Provocateur" }).first().click();
      await page.waitForTimeout(3400);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      // Belt and braces: if the card is still open, close it the way the
      // room does. The assertion below reads the WALL, not the card.
      const done = page.locator("button", { hasText: /^Done$/ });
      if (await done.count()) { await done.first().click().catch(() => {}); }
      await page.waitForTimeout(1600);

      const after = await readNumbered(page, '[data-qa="board-card"]');
      const movedTo = after.findIndex((r) => r.title === target.title) + 1;
      console.log(`    · after   ${after.map((r) => `${r.seat}:${r.tag}`).join("   ")}`);
      console.log(`    · coached "${target.title}" — seat ${target.seat} → ${movedTo}, № ${target.tag}`);
      check("identity-board-coached", "coaching really did re-sort the wall under the room",
        movedTo > 0 && movedTo !== target.seat, `seat ${target.seat} → ${movedTo}`);
      check("identity-board-coached", "the coached idea kept its own number",
        noOf(after.find((r) => r.title === target.title)?.tag) === noOf(target.tag),
        `${target.tag} → ${after.find((r) => r.title === target.title)?.tag}`);
      check("identity-board-coached", "and nothing else on the wall was renumbered either",
        numberMap(after) === numberMap(before), `${numberMap(before)} → ${numberMap(after)}`);
      check("identity-board-coached", "seat and № have come apart — the number no longer follows the sort",
        after.some((r) => noOf(r.tag) !== r.seat),
        JSON.stringify(after.map((r) => `${r.seat}:${r.tag}`)));
      await shootProof(page, "identity-board-after-1280x720",
        "The same board after coaching — the card moved up the wall, its № stayed with the idea", true);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── FLOW 2 — the Board and the Stage name the same idea the same ──
  // Both surfaces are read cold on the same seed, and they deliberately
  // sort in OPPOSITE directions: the Board runs status-then-oldest, the
  // Stage runs newest-first. Under the old positional №, seat 1 on one
  // wall was seat 3 on the other and both called themselves "01".
  {
    const boardCtx = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
    const boardPage = await boardCtx.newPage();
    const stageCtx = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
    const stagePage = await stageCtx.newPage();
    try {
      console.log("\n  FLOW 2 · Board ⇄ Stage — the same idea, the same number");
      await boardPage.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(boardPage);
      await boardPage.waitForTimeout(1600);
      const board = await readNumbered(boardPage, '[data-qa="board-card"]');

      await stagePage.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
      await stagePage.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
      await hideDevChrome(stagePage);
      await stagePage.waitForTimeout(1500);
      await stagePage.locator('[data-qa="queue-row"]', { hasText: "Confidence" }).click();
      await stagePage.waitForTimeout(1200);
      // Hand the team its whole board back, so the Stage shows the same
      // three ideas the Board does rather than the one it brought.
      await releasePresentGate(stagePage);
      const stage = await readNumbered(stagePage, '[data-qa="stage-card"]');

      console.log(`    · board  ${board.map((r) => `${r.seat}:${r.tag}`).join("   ")}`);
      console.log(`    · stage  ${stage.map((r) => `${r.seat}:${r.tag}`).join("   ")}`);
      check("identity-agreement", "the two surfaces are showing the same ideas",
        titleSet(board) === titleSet(stage), `${titleSet(board)} vs ${titleSet(stage)}`);
      check("identity-agreement", "every idea carries the SAME number on the Board and on the Stage",
        numberMap(board) === numberMap(stage), `${numberMap(board)} vs ${numberMap(stage)}`);
      check("identity-agreement", "and they still disagree about the ORDER — which is what proves the number is not the order",
        JSON.stringify(board.map((r) => r.title)) !== JSON.stringify(stage.map((r) => r.title)),
        `${board[0]?.title} vs ${stage[0]?.title}`);
      check("identity-agreement", "the single-team Stage wall keeps the number bare too",
        stage.every((r) => !isQualified(r.tag)), JSON.stringify(stage.map((r) => r.tag)));
      await shootProof(stagePage, "identity-stage-wall-1280x720",
        "Confidence's whole board on the Stage — sorted newest-first, numbered by creation", true);
    } finally {
      await boardPage.close();
      await boardCtx.close();
      await stagePage.close();
      await stageCtx.close();
    }
  }

  // ── FLOW 3 — the ballot votes on what the room saw ──
  // One context holds both the room's screen and the phone, because the
  // showcase store is per-tab and joins over the BroadcastChannel: a
  // phone that scans the QR after the vote is called must join the room
  // already in progress, which is exactly what is being driven here.
  {
    const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
    const stage = await context.newPage();
    try {
      console.log("\n  FLOW 3 · the ballot — the phone offers exactly what the Stage presented");
      await stage.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
      await stage.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
      await hideDevChrome(stage);
      await stage.waitForTimeout(1500);

      // Walk the room: every team takes the floor once, and what it puts
      // on the wall is what the room saw.
      const presented = [];
      const walls = [];
      for (const team of ["Realness", "Confidence", "Skinfirst"]) {
        const row = stage.locator('[data-qa="queue-row"]', { hasText: team });
        if (await row.count()) {
          await row.first().click();
          await stage.waitForTimeout(1100);
        }
        const wall = await readNumbered(stage, '[data-qa="stage-card"]');
        walls.push(`${team} ${wall.length}`);
        presented.push(...wall.map((r) => r.title));
      }
      console.log(`    · the room saw ${presented.length} ideas — ${walls.join(" · ")}`);
      check("identity-ballot", "the room's walk showed at least one idea per team",
        presented.length >= 3, walls.join(" · "));

      // THE GATE HAS TO BE GATING, or the rest of this flow proves
      // nothing: one team's Board holds strictly more ideas under this
      // brief than that team put on the Stage.
      {
        const desk = await context.newPage();
        try {
          await desk.goto(`${BASE}/group-2`, { waitUntil: "networkidle", timeout: 30000 });
          await hideDevChrome(desk);
          await desk.waitForTimeout(1500);
          const held = (await readNumbered(desk, '[data-qa="board-card"]')).length;
          const confidenceWall = Number(walls[1]?.split(" ")[1] ?? 0);
          console.log(`    · Confidence holds ${held} under this brief and presented ${confidenceWall}`);
          check("identity-ballot", "the present gate really excludes — a team's board is larger than its wall",
            held > confidenceWall, `${held} held vs ${confidenceWall} presented`);
        } finally {
          await desk.close();
        }
      }

      await stage.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
      await stage.waitForTimeout(2600);
      const ballotGeom = await measureBallot(stage);
      assertBallot("identity-ballot-stage-1280x720", ballotGeom);
      await shootProof(stage, "identity-ballot-stage-1280x720",
        "The Stage calls the vote — the count and the way in, side by side @ 1280×720");

      // The phone joins the room already in progress.
      const phone = await context.newPage();
      await phone.setViewportSize(PHONE);
      await phone.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(phone);
      await phone.waitForSelector('[data-qa="ballot-option"]', { timeout: 30000 });
      await phone.waitForTimeout(1200);

      const phoneBallot = await readBallot(phone);
      console.log(`    · the phone offers ${phoneBallot.length} — ${phoneBallot.join(" · ")}`);
      check("identity-ballot-390x844", "the ballot is exactly the set the Stage presented — no more, no less",
        JSON.stringify([...phoneBallot].sort()) === JSON.stringify([...presented].sort()),
        `${JSON.stringify([...phoneBallot].sort())} vs ${JSON.stringify([...presented].sort())}`);
      await shootProof(phone, "identity-ballot-phone-390x844",
        "The phone ballot at 390×844 — the same ideas the room was shown, in the voter's own shuffle", true);

      // The same ballot on the room's own laptop size.
      await phone.setViewportSize(LAPTOP);
      await phone.waitForTimeout(900);
      const wideBallot = await readBallot(phone);
      check("identity-ballot-1280x720", "the same set at 1280×720 — the scope is the data's, not the layout's",
        JSON.stringify([...wideBallot].sort()) === JSON.stringify([...presented].sort()),
        JSON.stringify([...wideBallot].sort()));
      await shootProof(phone, "identity-ballot-1280x720",
        "The same ballot at 1280×720 — identical set", true);
      await phone.close();

      // ── the returns rank that set and nothing else ──
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
      await stage.waitForTimeout(1100);
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Show the returns" }).click();
      await stage.waitForTimeout(2800);
      const returns = await readNumbered(stage, '[data-qa="returns-card"]');
      console.log(`    · the returns rank ${returns.length} — ${returns.map((r) => r.tag).join(" · ")}`);
      check("identity-returns", "the returns rank exactly what the room saw",
        titleSet(returns) === JSON.stringify([...presented].sort()),
        `${titleSet(returns)} vs ${JSON.stringify([...presented].sort())}`);
      check("identity-returns", "every returns row is qualified with its team — three teams each own a №01",
        returns.length > 0 && returns.every((r) => isQualified(r.tag) && noOf(r.tag) != null),
        JSON.stringify(returns.map((r) => r.tag)));
      await shootProof(stage, "identity-returns-1280x720",
        "The returns — only the ideas the room was shown, each named TEAM + number", true);

      // ── the full shortlist qualifies too ──
      await stage.locator("button", { hasText: "THE FULL SHORTLIST" }).first().click();
      await stage.waitForTimeout(2000);
      const shortlist = await readNumbered(stage, '[data-qa="shortlist-card"]');
      console.log(`    · the full shortlist — ${shortlist.map((r) => r.tag).join(" · ")}`);
      check("identity-shortlist", "every card on the shared shortlist names its team beside the number",
        shortlist.length > 1 && shortlist.every((r) => isQualified(r.tag) && noOf(r.tag) != null),
        JSON.stringify(shortlist.map((r) => r.tag)));
      check("identity-shortlist", "the shortlist's numbers are the ideas' own, not seats on this wall",
        shortlist.some((r) => noOf(r.tag) !== r.seat),
        JSON.stringify(shortlist.map((r) => `${r.seat}:${r.tag}`)));
      await shootProof(stage, "identity-full-shortlist-1280x720",
        "The full shortlist — every keep named TEAM + number, three columns of teams together", true);
    } finally {
      await stage.close();
      await context.close();
    }
  }
}

// ══ THE PHONE (U9) ═══════════════════════════════════════════
//
// Two of the three failures open items B names on the phone, and
// neither can be judged from a still: one only happens when a software
// keyboard is up, and the other only happens after a reload.
//
// THE KEYBOARD, and why this is a simulation rather than a device. A
// headless Chromium has no software keyboard, so nothing here can prove
// the fix on an iPhone — the runbook still owes one pass on a real
// handset. What it CAN prove is the contract the fix is built on:
// given a `visualViewport` that reports N pixels of the page covered,
// the primary action stays inside the part the participant can see.
// That is the whole mechanism, so the shim below is a fair test of it —
// it replaces `window.visualViewport` with an object of the same shape
// that reports a keyboard of a chosen height and fires the same
// `resize` event the real one does. Everything the page does with that
// number — the sticky offset, the layout, the target size — is the
// browser's own, unmocked.
//
// THE RECEIPT is driven for real: the Stage opens a ballot, the phone
// votes on it, the Stage closes it, and the phone is RELOADED. That
// reload is the whole defect. It is then walked into a second category,
// because a receipt that survives a reload but reports the wrong ballot
// is worse than the sheet it replaced.

/** An iPhone keyboard, roughly: enough to bury a footer, and far past
 *  the browser-furniture floor the page filters out. */
const KEYBOARD_PX = 336;

/**
 * Replace `window.visualViewport` with one this harness can drive.
 * Installed with `addInitScript`, so the page's own mount-time read
 * sees it — the hook subscribes once and never re-reads the global.
 */
const KEYBOARD_SHIM = () => {
  let kb = 0;
  const target = new EventTarget();
  const fake = {
    get width() { return window.innerWidth; },
    get height() { return window.innerHeight - kb; },
    get offsetTop() { return 0; },
    get offsetLeft() { return 0; },
    get pageTop() { return window.scrollY; },
    get pageLeft() { return window.scrollX; },
    get scale() { return 1; },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  Object.defineProperty(window, "visualViewport", { configurable: true, get: () => fake });
  window.__qaKeyboard = (px) => { kb = px; target.dispatchEvent(new Event("resize")); };
};

async function raiseKeyboard(page, px) {
  await page.evaluate((n) => window.__qaKeyboard(n), px);
  await page.waitForTimeout(350);
}

async function measureFilingBar(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const bar = document.querySelector('[data-qa="quick-add-action"]');
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      // What the participant can actually see. With the keyboard up
      // this is shorter than the layout viewport, and every geometry
      // law below is judged against IT, not against innerHeight.
      visible: window.visualViewport ? Math.round(window.visualViewport.height) : window.innerHeight,
      bar: rect(bar),
      action: rect(bar ? bar.querySelector("button") : null),
      actionLabel: (bar?.querySelector("button")?.textContent || "").trim(),
      textarea: rect(document.querySelector("textarea")),
      docOverflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

const LONG_IDEA =
  "A standing critique every Thursday, open to the whole floor, where anyone can bring work in " +
  "progress and have it taken apart properly — no seniority in the room, no defending the brief, " +
  "and the person who brought it writes down what they heard before they leave.";

async function runPhoneSuite(browser) {
  console.log("\n══ THE PHONE (U9) ════════════════════════════════");

  // ── 1. THE PRIMARY ACTION ABOVE THE KEYBOARD ──
  for (const size of [PHONE, PHONE_LG]) {
    const name = `phone-filing-bar-${size.width}x${size.height}`;
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    await context.addInitScript(KEYBOARD_SHIM);
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-2/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);

      const rest = await measureFilingBar(page);
      console.log(`    · at rest — bar ${Math.round(rest.bar?.top ?? -1)}→${Math.round(rest.bar?.bottom ?? -1)} of ${rest.viewport.h}`);
      check(name, "the phone's primary action is a filing bar, not a button in the flow",
        !!rest.bar && !!rest.action && /ADD IDEA/i.test(rest.actionLabel), rest.actionLabel);
      check(name, "at rest the bar holds the foot of the sheet",
        !!rest.bar && Math.abs(rest.bar.bottom - rest.viewport.h) <= 1,
        rest.bar ? `bar ends ${Math.round(rest.bar.bottom)} of ${rest.viewport.h}` : "missing");
      check(name, "ADD IDEA is a real thumb target",
        !!rest.action && rest.action.height >= 44 && rest.action.width >= 44,
        rest.action ? `${Math.round(rest.action.width)}×${Math.round(rest.action.height)}` : "missing");
      check(name, "the phone never scrolls sideways", !rest.docOverflow);
      await shootProof(page, `${name}-rest`,
        `Quick Add at ${size.width}×${size.height} — the filing bar at the foot of the paper`);

      // The room's actual sequence: the participant types, and the
      // keyboard has been up the whole time (the textarea autofocuses).
      await page.locator("textarea").fill(LONG_IDEA);
      await raiseKeyboard(page, KEYBOARD_PX);
      const up = await measureFilingBar(page);
      console.log(
        `    · keyboard ${KEYBOARD_PX}px — visible ${up.visible}` +
        ` · bar ${Math.round(up.bar?.top ?? -1)}→${Math.round(up.bar?.bottom ?? -1)}` +
        ` · action ends ${Math.round(up.action?.bottom ?? -1)}`,
      );
      check(name, "the keyboard really is up as far as the page is concerned",
        up.visible === up.viewport.h - KEYBOARD_PX, `${up.visible} of ${up.viewport.h}`);
      check(name, "ADD IDEA is still on the screen with the keyboard up — the defect itself",
        !!up.action && up.action.bottom <= up.visible + 1 && up.action.top >= 0,
        up.action ? `action ends ${Math.round(up.action.bottom)} against a visible ${up.visible}` : "missing");
      check(name, "the bar rode the keyboard rather than being scrolled under it",
        !!up.bar && Math.abs(up.bar.bottom - up.visible) <= 1,
        up.bar ? `bar ends ${Math.round(up.bar.bottom)} against a visible ${up.visible}` : "missing");
      check(name, "the bar does not cover the idea being written",
        !!up.bar && !!up.textarea && up.textarea.bottom <= up.bar.top + 1,
        up.bar && up.textarea ? `text ends ${Math.round(up.textarea.bottom)}, bar starts ${Math.round(up.bar.top)}` : "missing");
      check(name, "the target survived the move",
        !!up.action && up.action.height >= 44, `${Math.round(up.action?.height ?? -1)}px`);
      check(name, "and the phone still does not scroll sideways", !up.docOverflow);
      await mkdir(OUT_DIR, { recursive: true });
      const clipped = path.join(OUT_DIR, `${name}-keyboard.png`);
      await page.screenshot({ path: clipped, clip: { x: 0, y: 0, width: size.width, height: up.visible } });
      results.captures.push({
        name: `${name}-keyboard`, file: clipped,
        caption: `Quick Add at ${size.width}×${size.height} with a ${KEYBOARD_PX}px keyboard — what the participant can see`,
      });

      // And back. The bar has to unwind as cleanly as it rode up, or a
      // phone that dismisses the keyboard is left with a floating bar.
      await raiseKeyboard(page, 0);
      const down = await measureFilingBar(page);
      check(name, "the bar returns to the foot when the keyboard goes away",
        !!down.bar && Math.abs(down.bar.bottom - down.viewport.h) <= 1,
        down.bar ? `bar ends ${Math.round(down.bar.bottom)} of ${down.viewport.h}` : "missing");
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 2. HOW IT DEGRADES WHERE THERE IS NO KEYBOARD ──
  // A browser with no `visualViewport` at all, at a width with no
  // software keyboard. The bar must be an ordinary sticky footer and
  // nothing else — no JavaScript, no offset, no leftover state.
  {
    const name = "phone-filing-bar-no-visualviewport-600x900";
    const context = await browser.newContext({ viewport: ONECOL, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      Object.defineProperty(window, "visualViewport", { configurable: true, get: () => undefined });
    });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-2/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1400);
      const m = await measureFilingBar(page);
      const noVV = await page.evaluate(() => !window.visualViewport);
      console.log(`    · visualViewport removed: ${noVV} · bar ends ${Math.round(m.bar?.bottom ?? -1)} of ${m.viewport.h}`);
      check(name, "the page really is running without visualViewport", noVV);
      check(name, "the bar is an ordinary sticky footer where there is no keyboard to clear",
        !!m.bar && Math.abs(m.bar.bottom - m.viewport.h) <= 1,
        m.bar ? `bar ends ${Math.round(m.bar.bottom)} of ${m.viewport.h}` : "missing");
      check(name, "the action is unchanged and still a target",
        !!m.action && m.action.height >= 44 && /ADD IDEA/i.test(m.actionLabel));
      check(name, "and nothing scrolls sideways", !m.docOverflow);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 3. THE RECEIPT SURVIVES A RELOAD ──
  // One context holds the Stage and the phone: showcase realtime is a
  // BroadcastChannel, so a phone in another browser would never see the
  // ballot open — the same reason the identity suite works this way.
  {
    const context = await browser.newContext({ viewport: LAPTOP, deviceScaleFactor: 1 });
    const stage = await context.newPage();
    let phone;
    try {
      console.log("\n  phone-receipt — vote, close the ballot, reload");
      await stage.goto(`${BASE}/center-court`, { waitUntil: "networkidle", timeout: 30000 });
      await stage.waitForSelector('[data-qa="active-team"]', { timeout: 30000 });
      await hideDevChrome(stage);
      await stage.waitForTimeout(1500);
      const firstCategory = await stage.evaluate(() =>
        (document.querySelector('[data-qa="control-strip"]')?.innerText || "").trim());

      await stage.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
      await stage.waitForTimeout(2200);

      phone = await context.newPage();
      await phone.setViewportSize(PHONE);
      await phone.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(phone);
      await phone.waitForSelector('[data-qa="ballot-option"]', { timeout: 30000 });
      await phone.waitForTimeout(1000);

      // Two ticks, cast the way a voter casts them. The MARK is the
      // only thing that votes — the row itself opens the idea to read
      // (Ballot.tsx: "Votes register ONLY here, never on the row").
      const marks = phone.locator('[data-qa="ballot-option"] button');
      const optionCount = await marks.count();
      const cast = Math.min(2, optionCount);
      for (let i = 0; i < cast; i++) {
        await marks.nth(i).click();
        await phone.waitForTimeout(700);
      }
      console.log(`    · the phone cast ${cast} of ${optionCount} on the open ballot`);
      check("phone-receipt", "the phone actually cast a ballot to have a receipt for",
        cast === 2, `${cast} of ${optionCount}`);
      await shootProof(phone, "phone-receipt-ballot-390x844",
        "The open ballot at 390×844 — two votes cast from this phone", true);

      // The facilitator closes the vote. This is where the neutral
      // sheet used to come back and tell a voter nothing had happened.
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
      await stage.waitForTimeout(2200);
      const closed = await readSheet(phone);
      console.log(`    · closed  → "${closed.standing}" / "${closed.helper.slice(0, 60)}…"`);
      check("phone-receipt", "closing the ballot leaves the phone a receipt, not the waiting sheet",
        /ballot is in/i.test(closed.standing), closed.standing);
      check("phone-receipt", "the receipt counts what this phone put in",
        new RegExp(`\\b${cast}\\s+votes?\\b`).test(closed.helper), closed.helper.slice(0, 80));

      // THE DEFECT. A reload used to throw the receipt away.
      await phone.reload({ waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(phone);
      await phone.waitForTimeout(1800);
      const reloaded = await readSheet(phone);
      console.log(`    · reloaded → "${reloaded.standing}" / "${reloaded.helper.slice(0, 60)}…"`);
      check("phone-receipt-reload", "the receipt survives a reload — the defect itself",
        /ballot is in/i.test(reloaded.standing), reloaded.standing);
      check("phone-receipt-reload", "and it still reports the same count under the same category",
        reloaded.helper === closed.helper, `"${reloaded.helper.slice(0, 80)}"`);
      check("phone-receipt-reload", "the reloaded phone is never told the room is still waiting",
        !/waiting for the room/i.test(reloaded.standing + reloaded.helper));
      await shootProof(phone, "phone-receipt-reloaded-390x844",
        "The same phone after a reload — the receipt is still there, naming its own category", true);

      // ── A SECOND CATEGORY ──
      // A receipt that survives a reload but reports the wrong ballot
      // is worse than the sheet it replaced. Walk the room on.
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Show the returns" }).click();
      await stage.waitForTimeout(2000);
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Advance to the Shortlist" }).click();
      await stage.waitForTimeout(1800);
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Next category" }).click();
      await stage.waitForTimeout(1800);
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Open the ballot" }).click();
      await stage.waitForTimeout(2400);
      const secondCategory = await stage.evaluate(() =>
        (document.querySelector('[data-qa="control-strip"]')?.innerText || "").trim());
      check("phone-receipt-second", "the room really did move to a second category",
        secondCategory !== firstCategory, `${firstCategory.slice(0, 24)} → ${secondCategory.slice(0, 24)}`);

      await phone.waitForSelector('[data-qa="ballot-option"]', { timeout: 30000 });
      await phone.waitForTimeout(1200);
      const secondMarks = phone.locator('[data-qa="ballot-option"] button');
      await secondMarks.first().click();
      await phone.waitForTimeout(900);
      await stage.locator('[data-qa="control-strip"] button', { hasText: "Close the ballot" }).click();
      await stage.waitForTimeout(2200);
      await phone.reload({ waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(phone);
      await phone.waitForTimeout(1800);
      const second = await readSheet(phone);
      console.log(`    · second  → "${second.standing}" / "${second.helper.slice(0, 70)}…"`);
      check("phone-receipt-second", "the second ballot writes its own receipt",
        /ballot is in/i.test(second.standing) && /\b1\s+vote\b/.test(second.helper),
        second.helper.slice(0, 80));
      check("phone-receipt-second", "and it reports the second category, not the first",
        second.helper !== closed.helper, `"${second.helper.slice(0, 80)}"`);
      await shootProof(phone, "phone-receipt-second-category-390x844",
        "A second ballot, a second receipt — the phone reports the vote it just cast, not the one before", true);
    } finally {
      if (phone) await phone.close();
      await stage.close();
      await context.close();
    }
  }

  // ── 4. A PHONE THAT CAST NOTHING ──
  // Its own browser context, so it has its own storage and its own
  // showcase bus: no ballot has ever been open for it. The neutral
  // sheet is the correct standing and must be unchanged.
  {
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log("\n  phone-receipt-none — a phone that never voted");
      await page.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1800);
      const sheet = await readSheet(page);
      console.log(`    · "${sheet.standing}" / "${sheet.helper.slice(0, 60)}…"`);
      check("phone-receipt-none", "a phone that cast nothing still gets the neutral sheet",
        !/ballot is in/i.test(sheet.standing) && sheet.helper.length > 0, sheet.standing);
      await shootProof(page, "phone-receipt-none-390x844",
        "A phone that has cast nothing — the neutral sheet, unchanged", true);
    } finally {
      await page.close();
      await context.close();
    }
  }
}

/** The ballot's non-ballot standing: the `Sheet`'s two lines. */
async function readSheet(page) {
  return page.evaluate(() => {
    const ps = Array.from(document.querySelectorAll("p"));
    return {
      standing: (ps[0]?.textContent || "").replace(/\s+/g, " ").trim(),
      helper: (ps[1]?.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// U3 + U7 — RESILIENCE: what the room is told when a write fails
// ═══════════════════════════════════════════════════════════════
// U3 and U7 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
//
// The audit's headline is that no write path in the app checked its
// error, so a Present toggle, a Darkroom commission and a phone capture
// could all fail against a real Postgres and say nothing. Every other
// suite here drives the HAPPY path; this one is the only place the
// build is asked what it does when the store says no.
//
// HOW A FAILURE IS FORCED. This checkout has no database, so there is
// nothing to break. `lib/supabase.ts` therefore reads a fault list off
// the page — `window.__showcaseFaults` — and returns a PostgREST-shaped
// error instead of mutating. Faults match on table, verb and, crucially,
// on the COLUMNS the payload touches, which is what lets this suite
// reproduce the audit's worst case exactly: reject the print columns
// and nothing else, then prove the participant's paragraph survived.
//
// The fault mechanism is showcase-only and store-agnostic; it never
// exists in a deployment, because a configured client never constructs
// the shim.
const RESILIENCE_SLUGS = {
  autosave: '[data-qa="autosave-slug"]',
  present: '[data-qa="present-failed"]',
  print: '[data-qa="print-failed"]',
  quickAdd: '[data-qa="quick-add-failed"]',
};

/** Arm (or, with `[]`, disarm) the showcase's forced failures. */
async function setFaults(page, faults) {
  await page.evaluate((f) => {
    window.__showcaseFaults = f;
  }, faults);
}

/** The open card's whole reported state, in one read. */
async function readCardState(page) {
  return page.evaluate((sel) => {
    const slug = document.querySelector(sel.autosave);
    const text = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : null);
    const fields = Array.from(document.querySelectorAll("input, textarea")).map((el) => el.value);
    const present = Array.from(document.querySelectorAll("button")).find((b) =>
      /On the Stage|Present this/.test((b.innerText || "").trim()),
    );
    return {
      saveState: slug ? slug.dataset.state : null,
      saveSlug: text(slug),
      saveColor: slug ? getComputedStyle(slug).color : null,
      presentLabel: present ? (present.innerText || "").trim() : null,
      presentFailed: text(document.querySelector(sel.present)),
      printFailed: text(document.querySelector(sel.print)),
      fields,
      // A failure may change what a surface SAYS, never whether its
      // controls exist (Round 19 item 5's corollary).
      buttons: Array.from(document.querySelectorAll("button")).map((b) => (b.innerText || "").trim()).filter(Boolean),
      // Round 13: the MARK registers and then holds still. Scoped to
      // the slug and its subtree — the page keeps a live wire and a
      // connection pip running elsewhere, and neither is this mark.
      animating: slug && slug.getAnimations
        ? slug.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length
        : 0,
    };
  }, RESILIENCE_SLUGS);
}

async function runResilienceSuite(browser) {
  console.log("\n── RESILIENCE — a failed write is not a silent one ─");

  // ── 1 · The open card: the autosave slug learns to say no ──
  {
    const name = "resilience-open-card-autosave";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(900);

      const before = await readCardState(page);
      check(name, "the card opens saying Saved, as it always has",
        before.saveState === "saved" && before.saveSlug === "Saved", `${before.saveState} · "${before.saveSlug}"`);

      // Reject every write to `ideas` — the shape of a schema the
      // deployment never migrated.
      await setFaults(page, [{ table: "ideas", op: "update" }]);
      const box = page.locator("textarea").first();
      await box.click();
      await box.type(" — a sentence the room typed while the store was refusing.", { delay: 8 });
      await page.waitForTimeout(1400);

      const failed = await readCardState(page);
      const typed = failed.fields.find((v) => v.includes("while the store was refusing"));
      console.log(`    · slug "${failed.saveSlug}" @ ${failed.saveColor} · ${failed.buttons.length} controls still on the bar`);
      check(name, "the slug says the save did not land, instead of going on saying Saved",
        failed.saveState === "failed" && failed.saveSlug === "Not saved · Retry",
        `${failed.saveState} · "${failed.saveSlug}"`);
      check(name, "the failure reads in red, in the same micro-register as every other true fact on the card",
        failed.saveColor === "rgb(235, 63, 67)", failed.saveColor);
      check(name, "every word the participant typed is still in the field",
        !!typed, JSON.stringify(failed.fields.map((v) => v.slice(0, 30))));
      check(name, "the card keeps every control it had — a failed write changes what a surface says, not what it offers",
        failed.buttons.length >= before.buttons.length,
        `${before.buttons.length} → ${failed.buttons.length}`);
      check(name, "the mark registers and then holds still — nothing animates while the room reads it",
        failed.animating === 0, `${failed.animating} running animations`);

      const shot = path.join(OUT_DIR, `${name}.png`);
      await mkdir(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "The open card, told no — the slug says so and the sentence is still there" });

      // ── The same card, the fault lifted: it recovers by itself ──
      await setFaults(page, []);
      await box.type(" Again.", { delay: 8 });
      await page.waitForTimeout(1500);
      const recovered = await readCardState(page);
      check(name, "the next save that lands clears the mark — a transient failure does not leave a card looking broken",
        recovered.saveState === "saved" && recovered.saveSlug === "Saved",
        `${recovered.saveState} · "${recovered.saveSlug}"`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 2 · U7: the save sends only what changed ──
  // Proved through the fault mechanism rather than a network log: a
  // fault armed on the `name` column alone can only fire if the save
  // actually carries `name`. Edit the description; if the write still
  // shipped all four fields, this fails.
  {
    const name = "resilience-field-level-writes";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(900);

      await setFaults(page, [{ table: "ideas", op: "update", columns: ["name"] }]);

      // Only the description moves.
      const box = page.locator("textarea").first();
      await box.click();
      await box.type(" The description alone.", { delay: 8 });
      await page.waitForTimeout(1400);
      const afterDesc = await readCardState(page);
      check(name, "a description edit does not carry the title with it — the write goes through a fault armed on `name`",
        afterDesc.saveState === "saved",
        `${afterDesc.saveState} · "${afterDesc.saveSlug}"`);

      // Now the title moves, and the same fault must bite.
      const title = page.locator("input").first();
      await title.click();
      await title.type("!", { delay: 8 });
      await page.waitForTimeout(1400);
      const afterName = await readCardState(page);
      check(name, "a title edit DOES carry `name` — the fault bites, so the field-level test is not vacuous",
        afterName.saveState === "failed",
        `${afterName.saveState} · "${afterName.saveSlug}"`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 3 · U7: someone else wrote first ──
  {
    const name = "resilience-remote-edit";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      // A card whose id this suite KNOWS, filed the way a quick-add
      // files one — the harness cannot read an id off the wall, and
      // guessing one is how a conflict test passes by accident.
      const openId = "qa-conflict-idea";
      await broadcast(page, insertEvents("ideas", [
        { ...qaIdea(openId, "team-one", "category_1", "The Idea Two Laptops Opened", 30) },
      ]));
      await page.waitForTimeout(1600);
      const conflictCard = page.locator('[data-qa="board-card"]', { hasText: "The Idea Two Laptops Opened" });
      check(name, "the idea under test is on the wall", (await conflictCard.count()) > 0);
      await conflictCard.first().click();
      await page.waitForTimeout(900);
      const opened = await readCardState(page);
      const localSentence = " The sentence this laptop is typing.";

      // A second surface writes the same row: the store's copy moves on
      // and its `updated_at` moves with it. The bus is the same one a
      // second tab crosses.
      // The WHOLE row, because the showcase bus replaces a row rather
      // than patching it — the same thing a real refetch does.
      const remoteRow = {
        ...qaIdea(openId, "team-one", "category_1", "The Idea Two Laptops Opened", 30),
        description: "Rewritten from the other laptop while this card was open.",
        updated_at: new Date(Date.now() + 60000).toISOString(),
      };
      await broadcast(page, [
        { eventType: "UPDATE", new: remoteRow, old: { id: openId }, table: "ideas", schema: "public" },
      ]);
      const remote = remoteRow.updated_at;
      await page.waitForTimeout(1400);

      await page.locator("textarea").first().click();
      await page.locator("textarea").first().type(localSentence, { delay: 8 });
      await page.waitForTimeout(1600);

      const conflicted = await readCardState(page);
      const kept = conflicted.fields.some((v) => v.includes("this laptop is typing"));
      console.log(`    · remote stamp ${remote} · slug "${conflicted.saveSlug}"`);
      check(name, "the card reports the remote edit rather than overwriting it",
        conflicted.saveState === "conflict" && conflicted.saveSlug === "Not saved · Edited elsewhere",
        `${conflicted.saveState} · "${conflicted.saveSlug}"`);
      check(name, "nothing this laptop typed was discarded by the conflict",
        kept, JSON.stringify(conflicted.fields.map((v) => v.slice(0, 30))));
      check(name, "the conflict is reported in the slug that already existed — no new component",
        conflicted.buttons.length >= opened.buttons.length,
        `${opened.buttons.length} → ${conflicted.buttons.length}`);

      const shot = path.join(OUT_DIR, `${name}.png`);
      await mkdir(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "Two laptops on one idea — the second writer is told, and keeps its words" });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 4 · The Present gate does not claim a seat it was refused ──
  {
    const name = "resilience-present-refused";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(900);
      const before = await readCardState(page);

      // The exact error the audit predicts against an unmigrated schema.
      await setFaults(page, [{ table: "ideas", op: "update", columns: ["presenting"] }]);
      await page.locator("button", { hasText: /On the Stage|Present this/ }).first().click();
      await page.waitForTimeout(1200);

      const after = await readCardState(page);
      console.log(`    · "${before.presentLabel}" → "${after.presentLabel}" · ${after.presentFailed}`);
      check(name, "the toggle goes back to where it was — the gate never shows a state the row refused",
        after.presentLabel === before.presentLabel,
        `${before.presentLabel} → ${after.presentLabel}`);
      check(name, "the card says the Stage did not take it",
        after.presentFailed === "Not sent to the Stage", String(after.presentFailed));
      check(name, "the Present control is still there to press again",
        after.buttons.some((b) => /On the Stage|Present this/.test(b)));

      const shot = path.join(OUT_DIR, `${name}.png`);
      await mkdir(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "A refused Present — the star goes back and the bar says why" });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 5 · THE ONE THAT COSTS A PARTICIPANT THEIR PARAGRAPH ──
  // The audit's worst consequence of defect #1: `commissionPrint` used
  // to send `name` and `description` in the SAME statement as the print
  // columns, so a print column the deployment never migrated took the
  // participant's text edits down with it. R7 split the statement. This
  // rejects the print columns and nothing else, and then proves the
  // text is on the row.
  {
    const name = "resilience-commission-keeps-text";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);

      // An idea with no print, so "Picture it" is on the bar.
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(900);

      const paragraph = " The paragraph a failed commission used to take with it.";
      const box = page.locator("textarea").first();
      await box.click();
      await box.type(paragraph, { delay: 8 });
      await page.waitForTimeout(1400);

      // Only the print columns are refused. `name` and `description`
      // are not in this fault, so the first of the two writes must land.
      await setFaults(page, [
        { table: "ideas", op: "update", columns: ["print_status", "print_source", "print_note", "print_options", "print_url"] },
      ]);

      const picture = page.locator("button", { hasText: /Picture it|Visualize/ }).first();
      const hasPicture = (await picture.count()) > 0;
      check(name, "the open card offers a commission to refuse", hasPicture);
      if (hasPicture) {
        await picture.click();
        await page.waitForTimeout(700);
        // The note card stands between every commission and the clock.
        const send = page.locator("button", { hasText: /^(Picture it|Visualize|Send|New sheet|Generate again)$/ }).last();
        if (await send.count()) {
          await send.click();
        }
        await page.waitForTimeout(1600);
      }

      const after = await readCardState(page);
      const stillTyped = after.fields.some((v) => v.includes("used to take with it"));
      console.log(`    · print slug ${after.printFailed} · text in field: ${stillTyped}`);
      check(name, "the card says the darkroom did not take the commission — AND that the text is safe",
        after.printFailed === "Not sent · your text is saved", String(after.printFailed));
      check(name, "the participant's paragraph is still on the card",
        stillTyped, JSON.stringify(after.fields.map((v) => v.slice(-32))));
      check(name, "no darkroom stamp for a commission that never started",
        !after.buttons.some((b) => /In the darkroom|Generating/.test(b)) &&
        !(after.printFailed || "").includes("darkroom…"));

      // AND the text is on the ROW, not just in the field: reopen the
      // card from the wall and read what the store gives back.
      await setFaults(page, []);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(1000);
      const reopened = await readCardState(page);
      check(name, "the text SURVIVED the failed commission — this is the edit the old single statement discarded",
        reopened.fields.some((v) => v.includes("used to take with it")),
        JSON.stringify(reopened.fields.map((v) => v.slice(-32))));

      const shot = path.join(OUT_DIR, `${name}.png`);
      await mkdir(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "A refused commission — the darkroom said no and the paragraph stayed" });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 6 · The phone: a capture surface never eats an idea ──
  {
    const name = "resilience-phone-capture";
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);

      await setFaults(page, [{ table: "ideas", op: "insert" }]);
      const idea = "The idea the phone must not eat.";
      await page.locator("textarea").first().fill(idea);
      await page.waitForTimeout(300);
      await page.locator('[data-qa="quick-add-action"] button').first().click();
      await page.waitForTimeout(1400);

      const m = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return {
          line: el ? (el.textContent || "").replace(/\s+/g, " ").trim() : null,
          lineColor: el ? getComputedStyle(el).color : null,
          textarea: document.querySelector("textarea")?.value || "",
          // The stamp is its OWN element reading exactly "ADDED" — the
          // failure line reads "NOT ADDED · …" and uppercases in CSS,
          // so a body-text match finds the wrong thing.
          added: Array.from(document.querySelectorAll("div")).some(
            (el) => (el.textContent || "").trim() === "ADDED",
          ),
          docOverflow: document.documentElement.scrollWidth > window.innerWidth,
          actionVisible: (() => {
            const b = document.querySelector('[data-qa="quick-add-action"] button');
            if (!b) return false;
            const r = b.getBoundingClientRect();
            return r.bottom <= window.innerHeight + 1 && r.height >= 44;
          })(),
        };
      }, RESILIENCE_SLUGS.quickAdd);

      console.log(`    · "${m.line}" · textarea holds ${m.textarea.length} chars · ADDED fired: ${m.added}`);
      check(name, "the ADDED stamp does not fire for an idea the board never took",
        !m.added);
      check(name, "the textarea still holds the idea — a capture surface that clears on a failed write has destroyed it",
        m.textarea === idea, `"${m.textarea.slice(0, 40)}"`);
      check(name, "the phone says what happened and what to do",
        m.line === "Not added · your idea is still here. Try again.", String(m.line));
      check(name, "the failure line reads in red, on the bar that issued the write",
        m.lineColor === "rgb(235, 63, 67)", String(m.lineColor));
      check(name, "the failure did not push the primary action off the phone",
        m.actionVisible);
      check(name, "the phone still does not scroll sideways at 390×844", !m.docOverflow);

      const shot = path.join(OUT_DIR, `${name}.png`);
      await mkdir(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "The phone, refused — the idea is still in the box @ 390×844" });

      // And it recovers: lift the fault, press again, the idea files.
      await setFaults(page, []);
      await page.locator('[data-qa="quick-add-action"] button').first().click();
      await page.waitForTimeout(700);
      // The stamp holds for 1200ms, so it is read while it is up.
      await page.waitForTimeout(0);
      const after = await page.evaluate((sel) => ({
        line: document.querySelector(sel) ? "still failing" : null,
        textarea: document.querySelector("textarea")?.value || "",
        added: Array.from(document.querySelectorAll("div")).some(
          (el) => (el.textContent || "").trim() === "ADDED",
        ),
      }), RESILIENCE_SLUGS.quickAdd);
      check(name, "pressing ADD IDEA again files it — the retry is the control that was already there",
        after.line === null && after.textarea === "" && after.added,
        `line ${after.line} · textarea "${after.textarea}" · ADDED ${after.added}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 7 · No fault, no marks. The happy path is untouched. ──
  {
    const name = "resilience-no-regression";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(900);
      const box = page.locator("textarea").first();
      await box.click();
      await box.type(" A save with nothing in its way.", { delay: 8 });
      await page.waitForTimeout(1500);
      const m = await readCardState(page);
      check(name, "with nothing forced to fail the card saves and says Saved",
        m.saveState === "saved" && m.saveSlug === "Saved", `${m.saveState} · "${m.saveSlug}"`);
      check(name, "no failure mark appears anywhere on a working card",
        m.presentFailed === null && m.printFailed === null,
        `${m.presentFailed} · ${m.printFailed}`);

      // The Present toggle, unobstructed, still moves and stays moved.
      const label = m.presentLabel;
      await page.locator("button", { hasText: /On the Stage|Present this/ }).first().click();
      await page.waitForTimeout(1100);
      const toggled = await readCardState(page);
      check(name, "an unobstructed Present toggle moves and stays moved",
        toggled.presentLabel !== label && toggled.presentFailed === null,
        `${label} → ${toggled.presentLabel}`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 8 · U2: SCHEMA DRIFT — the manifest itself is the gate ──
  // Defect #1's regression test. Groups 1–7 force failures through the
  // FAULT list; this one arms nothing. It withholds the six migration-001
  // columns from the generated manifest instead —
  // `window.__showcaseWithholdColumns` — which is the strict shim's
  // stand-in for a deployment that seeded from schema.sql and skipped
  // the migrations. The write is refused by the schema layer itself,
  // with PGRST204, exactly as the live PostgREST refused it for two
  // silent weeks. Restore the manifest and the same actions succeed —
  // which is the proof this unit would have caught the defect on the
  // day the six columns were introduced.
  {
    const name = "resilience-schema-drift";
    const MIGRATION_001_COLUMNS = [
      "presenting", "print_status", "print_options", "print_url", "print_source", "print_note",
    ];
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);
      await page.locator('[data-qa="board-card"]').first().click();
      await page.waitForTimeout(900);
      const before = await readCardState(page);

      // The unmigrated store: schema.sql applied, migration 001 skipped.
      await page.evaluate((cols) => {
        window.__showcaseWithholdColumns = { ideas: cols };
      }, MIGRATION_001_COLUMNS);

      // Present — the only writer of `presenting` in the app.
      await page.locator("button", { hasText: /On the Stage|Present this/ }).first().click();
      await page.waitForTimeout(1200);
      const refused = await readCardState(page);
      check(name, "with the six columns absent from the manifest, Present is refused — no fault list involved",
        refused.presentLabel === before.presentLabel && refused.presentFailed === "Not sent to the Stage",
        `${before.presentLabel} → ${refused.presentLabel} · ${refused.presentFailed}`);

      // The Darkroom commission: the text write (name/description — real
      // columns) lands, the print write (withheld columns) is refused.
      const paragraph = " Typed against an unmigrated store.";
      const box = page.locator("textarea").first();
      await box.click();
      await box.type(paragraph, { delay: 8 });
      await page.waitForTimeout(1400);
      const savedState = await readCardState(page);
      check(name, "the autosave still lands — name and description ARE in schema.sql",
        savedState.saveState === "saved", `${savedState.saveState} · "${savedState.saveSlug}"`);

      const picture = page.locator("button", { hasText: /Picture it|Visualize/ }).first();
      if ((await picture.count()) > 0) {
        await picture.click();
        await page.waitForTimeout(700);
        const send = page.locator("button", { hasText: /^(Picture it|Visualize|Send|New sheet|Generate again)$/ }).last();
        if (await send.count()) await send.click();
        await page.waitForTimeout(1600);
      }
      const commission = await readCardState(page);
      const stillTyped = commission.fields.some((v) => v.includes("unmigrated store"));
      check(name, "the commission is refused by the withheld schema and says the text is safe",
        commission.printFailed === "Not sent · your text is saved", String(commission.printFailed));
      check(name, "the participant's paragraph survived the schema-level refusal",
        stillTyped, JSON.stringify(commission.fields.map((v) => v.slice(-30))));

      const shot = path.join(OUT_DIR, `${name}.png`);
      await mkdir(OUT_DIR, { recursive: true });
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "The unmigrated store, refused by the manifest — defect #1 can no longer be silent" });

      // Restore the manifest: the SAME actions now succeed.
      await page.evaluate(() => { window.__showcaseWithholdColumns = undefined; });
      await page.locator("button", { hasText: /On the Stage|Present this/ }).first().click();
      await page.waitForTimeout(1200);
      const restored = await readCardState(page);
      check(name, "manifest restored — the same Present toggle moves and sticks",
        restored.presentLabel !== before.presentLabel && restored.presentFailed === null,
        `${before.presentLabel} → ${restored.presentLabel} · ${restored.presentFailed}`);
    } finally {
      await page.close();
      await context.close();
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// U4 — THE PRESENT GATE'S THIRD STATE (`present-gate`)
// ═══════════════════════════════════════════════════════════════
// U4 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
//
// "This team chose nothing" and "this deployment cannot read the
// field" used to produce the same behaviour — the fallback — and the
// fallback is the dangerous one: against an unmigrated store the
// ballot silently widened to ideas the room was never shown. The gate
// (lib/present-gate) now tells them apart on the schema's own
// contract: `presenting boolean NOT NULL DEFAULT false` means no
// readable row can lack the field, so a bucket whose every active row
// lacks it is the missing-column signature.
//
// HOW THE UNREADABLE STORE IS SIMULATED. The showcase bus replaces
// rows wholesale, and the shim's own inserts materialise the schema
// default — so a row broadcast WITHOUT the field is exactly what an
// unmigrated PostgREST serves: the column stripped from every row.
// Each scenario deletes the category's seeds and files its own
// fixture, in its own context, so nothing leaks between scenarios.

// Creative Culture's seeded ideas, every team — the category the
// fixtures below replace. Ids are the stable showcase seeds
// (lib/showcase-data.ts); if the seed set changes this list fails
// loudly rather than testing a half-replaced category.
const CAT3_SEED_IDS = ["idea-06", "idea-07", "idea-12", "idea-13", "idea-19", "idea-20", "idea-21"];

/** A row the way an UNMIGRATED deployment returns one: the present-gate
 *  and print columns simply absent. PostgREST strips a missing column
 *  from EVERY row it serves — which is why "no active row carries the
 *  field" is a signature and not a heuristic. */
function unreadableIdea(id, teamId, category, name, minutesAgo) {
  const row = qaIdea(id, teamId, category, name, minutesAgo);
  delete row.presenting;
  delete row.print_status;
  delete row.print_options;
  delete row.print_url;
  delete row.print_source;
  delete row.print_note;
  return row;
}

const settingsEvent = (key, value) => ({
  eventType: "UPDATE",
  new: { key, value, updated_at: new Date().toISOString() },
  old: { key },
  table: "workshop_settings",
  schema: "public",
});

const workshopStateEvent = (pillar, extra = {}) =>
  settingsEvent(
    "workshop_state",
    JSON.stringify({ pillar, team: null, view: "pillar", voting_open: true, show_counts: false, ...extra }),
  );

// Two active ideas per team under Creative Culture. `qaIdea` carries
// `presenting: false` — the migrated store's honest "chose nothing".
const GATE_READABLE = [
  qaIdea("qa-gate-h1", "team-one", "category_3", "The Quiet Tuesday", 60),
  qaIdea("qa-gate-h2", "team-one", "category_3", "The Open Studio", 58),
  qaIdea("qa-gate-t1", "team-two", "category_3", "The Long Lunch Table", 56),
  qaIdea("qa-gate-t2", "team-two", "category_3", "The Second Draft Club", 54),
  qaIdea("qa-gate-b1", "team-three", "category_3", "The Friday Wall", 52),
  qaIdea("qa-gate-b2", "team-three", "category_3", "The House Style Hour", 50),
];
const GATE_READABLE_TITLES = GATE_READABLE.map((r) => r.name);

// The same six, served by a store that cannot read the field.
const GATE_UNREADABLE = GATE_READABLE.map((r) =>
  unreadableIdea(r.id, r.team_id, r.category, r.name, 55),
);

// One team selected, one chose nothing, one team's rows lack the field.
// Partial readability is still a set the room cannot trust.
const GATE_MIXED = [
  { ...qaIdea("qa-gate-h1", "team-one", "category_3", "The Quiet Tuesday", 60), presenting: true },
  qaIdea("qa-gate-h2", "team-one", "category_3", "The Open Studio", 58),
  qaIdea("qa-gate-t1", "team-two", "category_3", "The Long Lunch Table", 56),
  qaIdea("qa-gate-t2", "team-two", "category_3", "The Second Draft Club", 54),
  unreadableIdea("qa-gate-b1", "team-three", "category_3", "The Friday Wall", 52),
  unreadableIdea("qa-gate-b2", "team-three", "category_3", "The House Style Hour", 50),
];

/** Replace Creative Culture with a fixture and call the vote on it. */
async function stageGateFixture(page, rows) {
  await broadcast(page, [
    ...deleteEvents("ideas", CAT3_SEED_IDS),
    ...insertEvents("ideas", rows),
    workshopStateEvent("category_3"),
  ]);
  // The phones re-read phase on the settings event, then fetch ideas
  // behind an up-to-800ms anti-thundering-herd jitter.
  await page.waitForTimeout(2800);
}

const REFUSAL_STANDING = "The ballot can\u2019t open.";

async function runPresentGateSuite(browser) {
  console.log("\n══ THE PRESENT GATE'S THIRD STATE (U4) ═══════════");
  await mkdir(OUT_DIR, { recursive: true });

  // ── 1 · The unreadable store: the phone refuses, and says why ──
  {
    const name = "gate-unreadable-vote-390x844";
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1200);
      await stageGateFixture(page, GATE_UNREADABLE);

      const sheet = await readSheet(page);
      const m = await page.evaluate(() => {
        const ps = Array.from(document.querySelectorAll("p"));
        const standing = ps[0] ? getComputedStyle(ps[0]) : null;
        const helper = ps[1] ? getComputedStyle(ps[1]) : null;
        return {
          options: document.querySelectorAll('[data-qa="ballot-option"]').length,
          standingSize: standing ? parseFloat(standing.fontSize) : 0,
          helperSize: helper ? parseFloat(helper.fontSize) : 0,
          standingColor: standing ? standing.color : null,
          docOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      console.log(`    · standing "${sheet.standing}" · ${m.options} options offered`);
      check(name, "the ballot REFUSES — no surface offers a vote on an unreadable gate",
        m.options === 0, `${m.options} options`);
      check(name, "the standing says the ballot cannot open",
        sheet.standing === REFUSAL_STANDING, `"${sheet.standing}"`);
      check(name, "the helper names the fix — the missing present-gate field",
        /presenting/.test(sheet.helper) && /schema fix/.test(sheet.helper), sheet.helper.slice(0, 90));
      check(name, "the refusal is facilitator-addressed, not participant-blaming",
        /Facilitator:/.test(sheet.helper), sheet.helper.slice(0, 90));
      check(name, "the refusal is legible on paper — reading sizes, no red flood",
        m.standingSize >= 18 && m.helperSize >= 16 && m.standingColor !== "rgb(235, 63, 67)",
        `${m.standingSize}px / ${m.helperSize}px @ ${m.standingColor}`);
      check(name, "no horizontal scroll at 390×844", !m.docOverflow);

      const shot = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "An unreadable gate — the ballot refuses on paper and names the fix @ 390×844" });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 2 · The legitimate fallback: a team that chose nothing still ballots ──
  {
    const name = "gate-chose-nothing-vote";
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1200);
      await stageGateFixture(page, GATE_READABLE);

      const options = await readBallot(page);
      console.log(`    · ${options.length} options: ${options.join(" · ")}`);
      check(name, "every team chose nothing, and the whole active board is on the ballot — the fallback is untouched",
        options.length === GATE_READABLE_TITLES.length &&
          GATE_READABLE_TITLES.every((t) => options.includes(t)),
        JSON.stringify(options));
      const sheet = await readSheet(page);
      check(name, "no refusal standing on a readable gate",
        sheet.standing !== REFUSAL_STANDING, `"${sheet.standing}"`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 3 · The mixed category: partial readability refuses too ──
  {
    const name = "gate-mixed-vote";
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/vote`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1200);
      await stageGateFixture(page, GATE_MIXED);

      const sheet = await readSheet(page);
      const options = await readBallot(page);
      console.log(`    · standing "${sheet.standing}" · ${options.length} options offered`);
      check(name, "one selected team + one chose-nothing team + one unreadable team → the ballot refuses",
        sheet.standing === REFUSAL_STANDING, `"${sheet.standing}"`);
      check(name, "it does NOT quietly offer the two readable teams — partial readability is still a set the room cannot trust",
        options.length === 0, `${options.length} options`);
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 4 · Quick-add's ballot makes the same refusal ──
  {
    const name = "gate-unreadable-quickadd-390x844";
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1/quick-add`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1200);
      await stageGateFixture(page, GATE_UNREADABLE);

      const m = await page.evaluate(() => {
        const refusal = document.querySelector('[data-qa="ballot-unreadable"]');
        return {
          refusal: refusal ? (refusal.textContent || "").replace(/\s+/g, " ").trim() : null,
          options: document.querySelectorAll('[data-qa="ballot-option"]').length,
          docOverflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      console.log(`    · refusal present: ${!!m.refusal} · ${m.options} options`);
      check(name, "the team's own phone refuses the same way — no drift between the two ballots",
        !!m.refusal && m.options === 0, `${m.options} options`);
      check(name, "the copy names the fix here too",
        !!m.refusal && /presenting/.test(m.refusal) && /Facilitator:/.test(m.refusal),
        (m.refusal || "").slice(0, 90));
      check(name, "no horizontal scroll at 390×844", !m.docOverflow);

      const shot = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "Quick-add's ballot, refusing on the same unreadable gate @ 390×844" });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 5 · The Stage: the wall stays up and tells the truth; the returns refuse ──
  {
    const name = "gate-stage-unreadable";
    const { context, page } = await openStage(browser, LAPTOP, { pillar: "Inclusive Biomimetic Care" });
    try {
      console.log(`\n  ${name}`);
      await broadcast(page, [
        ...deleteEvents("ideas", CAT3_SEED_IDS),
        ...insertEvents("ideas", GATE_UNREADABLE),
      ]);
      await page.waitForTimeout(2200);

      const wall = await page.evaluate(() => ({
        note: (document.querySelector('[data-qa="gate-unreadable"]')?.textContent || "").trim(),
        // .slug uppercases in CSS and innerText reflects it — match either case.
        fallbackNote: /showing all — none selected yet/i.test(document.body.innerText),
        cards: document.querySelectorAll('[data-qa="stage-card"]').length,
      }));
      console.log(`    · wall note "${wall.note}" · ${wall.cards} cards still up`);
      check(name, "the wall KEEPS the active board — a room mid-session does not lose its screen over a schema fault",
        wall.cards === 2, `${wall.cards} cards`);
      check(name, "the header says the selections could not be read",
        wall.note === "selections could not be read — showing the active board", `"${wall.note}"`);
      check(name, "it does not claim the team chose nothing — the fallback note stays out",
        !wall.fallbackNote);

      const shot = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "The Stage on an unreadable gate — the wall holds, the header tells the truth" });

      // The returns, on the same broken store.
      await broadcast(page, [workshopStateEvent("category_3", { voting_open: false, show_counts: true })]);
      await page.waitForTimeout(1800);
      const returns = await page.evaluate(() => ({
        refusal: (document.querySelector('[data-qa="returns-unreadable"]')?.textContent || "").replace(/\s+/g, " ").trim(),
        rankedHeader: /The returns —/.test(document.body.innerText),
      }));
      console.log(`    · returns refusal present: ${!!returns.refusal}`);
      check(name, "the returns refuse rather than ranking a set the room never saw",
        !!returns.refusal && !returns.rankedHeader, returns.refusal.slice(0, 80));
      check(name, "the returns' refusal names the fix",
        /presenting/.test(returns.refusal) && /schema fix/.test(returns.refusal), returns.refusal.slice(0, 90));

      const shot2 = path.join(OUT_DIR, `${name}-returns.png`);
      await page.screenshot({ path: shot2 });
      results.captures.push({ name: `${name}-returns`, file: shot2, caption: "The returns on the same store — refused, with the reason on the wall" });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 6 · The Stage's fallback note is byte-for-byte what it was ──
  {
    const name = "gate-stage-chose-nothing";
    const { context, page } = await openStage(browser, LAPTOP, { pillar: "Inclusive Biomimetic Care" });
    try {
      console.log(`\n  ${name}`);
      await broadcast(page, [
        ...deleteEvents("ideas", CAT3_SEED_IDS),
        ...insertEvents("ideas", GATE_READABLE),
      ]);
      await page.waitForTimeout(2200);
      const wall = await page.evaluate(() => ({
        // .slug uppercases in CSS and innerText reflects it — match either case.
        fallbackNote: /showing all — none selected yet/i.test(document.body.innerText),
        unreadableNote: !!document.querySelector('[data-qa="gate-unreadable"]'),
        cards: document.querySelectorAll('[data-qa="stage-card"]').length,
      }));
      console.log(`    · fallback note: ${wall.fallbackNote} · ${wall.cards} cards`);
      check(name, "a team that chose nothing still presents its whole active board, with the fallback note unchanged",
        wall.fallbackNote && wall.cards === 2, `note ${wall.fallbackNote} · ${wall.cards} cards`);
      check(name, "and the unreadable note stays out of a readable wall", !wall.unreadableNote);
    } finally {
      await page.close();
      await context.close();
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// U6 — THE DARKROOM RECOVERS FROM A REFRESH (`darkroom`)
// ═══════════════════════════════════════════════════════════════
// U6 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
//
// The develop clock is a setTimeout in the commissioning tab, so a
// refresh used to strand `print_status='developing'` forever — no code
// path wrote it back, and commissionPrint refused a row it saw as
// developing. The recovery is judged from `updated_at` (no new
// column): older than the ceiling while developing ⇒ the clock is
// dead, the flag becomes the quiet DIDN'T FINISH fact, and the open
// card offers one click that abandons explicitly and commissions
// clean.
//
// Round 14 holds: the 20–30s develop is NOT shortened. The stranding
// is driven by broadcasting a stale `updated_at` over the showcase
// bus; the one real develop this suite waits out proves the recovery
// lands a sheet at the real duration.

// The ceiling moved to 180s on 2026-08-06 when the develop became real
// work: a live sheet is three parallel model renders and can legitimately
// outrun the showcase's staged 20-30s beat. The ceiling only ever judges a
// tab WATCHING someone else's develop, so calling a healthy render dead at
// 45s would have offered a recovery that abandons a sheet about to land and
// pays for a second one. This suite's staleness must clear the REAL ceiling,
// which is why the stranded rows are aged five minutes rather than two —
// two cleared 45s and does not clear 180s, and that is exactly how this
// suite caught the change.
const DARKROOM_CEILING_NOTE = "180s ceiling (lib/darkroom DEVELOP_CEILING_MS) — sized for a live three-render develop";

/** A row stranded `developing` before this page ever loaded. */
function strandedIdea(id, name, minutesAgo = 5) {
  return {
    ...qaIdea(id, "team-one", "category_1", name, 30),
    print_status: "developing",
    print_note: "Warmer, with people.",
    updated_at: AGO(minutesAgo),
  };
}

/** One card's darkroom-state read, scoped by its title. */
async function readBoardCardFlags(page, title) {
  return page.evaluate((t) => {
    const card = Array.from(document.querySelectorAll('[data-qa="board-card"]')).find((el) =>
      (el.textContent || "").includes(t),
    );
    if (!card) return null;
    return {
      stalledFlag: (card.querySelector('[data-qa="stalled-flag"]')?.textContent || "").trim() || null,
      spinning: card.querySelectorAll(".animate-spin").length,
      text: (card.textContent || "").replace(/\s+/g, " ").trim(),
    };
  }, title);
}

/** The open card's darkroom-state read. */
async function readOpenDarkroomState(page) {
  return page.evaluate(() => {
    const text = (el) => (el ? (el.textContent || "").replace(/\s+/g, " ").trim() : null);
    return {
      retry: text(document.querySelector('[data-qa="retry-develop"]')),
      stalledLine: text(document.querySelector('[data-qa="stalled-line"]')),
      printFailed: text(document.querySelector('[data-qa="print-failed"]')),
      working: /Generating…|In the darkroom…/.test(document.body.innerText),
      sheetUp: /one request, three (images|frames)/i.test(document.body.innerText),
      fields: Array.from(document.querySelectorAll("input, textarea")).map((el) => el.value),
    };
  });
}

async function pollFor(page, fn, timeoutMs, stepMs = 1000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    last = await fn();
    if (last && last.ok) return last;
    await page.waitForTimeout(stepMs);
  }
  return last ?? { ok: false };
}

async function runDarkroomRecoverySuite(browser) {
  console.log("\n══ THE DARKROOM RECOVERS (U6) ════════════════════");
  await mkdir(OUT_DIR, { recursive: true });

  // ── 1 · Strand → one click → a real develop lands, in both tabs ──
  {
    const name = "darkroom-strand-recover";
    // ONE context, two pages: BroadcastChannel does not cross contexts,
    // and the commissioning-tab law is exactly a two-tab fact.
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    try {
      console.log(`\n  ${name} (${DARKROOM_CEILING_NOTE})`);
      await pageA.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await pageB.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(pageA);
      await pageA.waitForTimeout(1500);

      const title = "The Stranded Develop";
      await broadcast(pageA, insertEvents("ideas", [strandedIdea("qa-strand", title)]));
      await pageA.waitForTimeout(1800);

      const flags = await readBoardCardFlags(pageA, title);
      console.log(`    · board flag "${flags?.stalledFlag}" · ${flags?.spinning ?? "?"} spinners`);
      check(name, "the stranded card wears the quiet DIDN'T FINISH flag, not the working one",
        !!flags && /didn.t finish/i.test(flags.stalledFlag || ""), JSON.stringify(flags));
      check(name, "and nothing on it spins — no clock is running and the card must not claim one",
        !!flags && flags.spinning === 0, `${flags?.spinning} spinners`);

      await pageA.locator('[data-qa="board-card"]', { hasText: title }).first().click();
      await pageA.waitForTimeout(1000);
      const open = await readOpenDarkroomState(pageA);
      console.log(`    · open card: retry "${open.retry}" · line "${open.stalledLine}"`);
      check(name, "the open card offers the commission again — one click, a real control",
        open.retry === "Try again", String(open.retry));
      check(name, "beside the quiet fact, in the flag vocabulary",
        !!open.stalledLine && /didn.t finish/i.test(open.stalledLine), String(open.stalledLine));
      check(name, "and does not show the working slug over a dead clock", !open.working);

      const shot = path.join(OUT_DIR, `${name}-stalled.png`);
      await pageA.screenshot({ path: shot });
      results.captures.push({ name: `${name}-stalled`, file: shot, caption: "A stranded develop — the quiet flag on the card, the one-click retry on the bar" });

      const fieldsBefore = open.fields.filter((v) => v.length > 0);

      // ONE CLICK.
      await pageA.locator('[data-qa="retry-develop"]').click();
      await pageA.waitForTimeout(1600);
      const retried = await readOpenDarkroomState(pageA);
      check(name, "taking it clears the stall and develops normally — the working state is honest again",
        retried.working && !retried.retry, JSON.stringify({ working: retried.working, retry: retried.retry }));

      // The other tab sees the develop through the bus, as ever.
      await pageB.waitForTimeout(1200);
      const flagsB = await readBoardCardFlags(pageB, title);
      check(name, "tab B sees the develop running — the re-commission crossed the bus",
        !!flagsB && flagsB.spinning > 0 && !flagsB.stalledFlag, JSON.stringify(flagsB));

      // The real 20–30s beat, waited out rather than shortened.
      const landed = await pollFor(pageA, async () => {
        const m = await readOpenDarkroomState(pageA);
        return { ok: m.sheetUp, m };
      }, 40000);
      check(name, "the develop LANDS — a full sheet of three at the real duration, no shortcut taken",
        landed.ok);
      const flagsB2 = await readBoardCardFlags(pageB, title);
      check(name, "tab B holds the landed sheet too",
        !!flagsB2 && /options ready|sheet ready/i.test(flagsB2.text), (flagsB2?.text || "").slice(-60));

      // Recovery never touches the words.
      const after = await readOpenDarkroomState(pageA);
      const fieldsAfter = after.fields.filter((v) => v.length > 0);
      check(name, "recovering a stranded develop touched neither name nor description",
        JSON.stringify(fieldsAfter) === JSON.stringify(fieldsBefore),
        `${JSON.stringify(fieldsBefore.map((v) => v.slice(0, 20)))} → ${JSON.stringify(fieldsAfter.map((v) => v.slice(0, 20)))}`);

      const shot2 = path.join(OUT_DIR, `${name}-landed.png`);
      await pageA.screenshot({ path: shot2 });
      results.captures.push({ name: `${name}-landed`, file: shot2, caption: "The same idea, one click and one real develop later — the sheet is up" });
    } finally {
      await pageA.close();
      await pageB.close();
      await context.close();
    }
  }

  // ── 2 · A develop still inside the ceiling is protected ──
  {
    const name = "darkroom-inflight-protected";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);

      const title = "The Develop In Flight";
      await broadcast(page, insertEvents("ideas", [
        { ...strandedIdea("qa-inflight", title), updated_at: new Date().toISOString() },
      ]));
      await page.waitForTimeout(1800);

      const flags = await readBoardCardFlags(page, title);
      check(name, "a fresh `developing` row wears the working flag, not the stall",
        !!flags && !flags.stalledFlag && flags.spinning > 0, JSON.stringify(flags));

      await page.locator('[data-qa="board-card"]', { hasText: title }).first().click();
      await page.waitForTimeout(1000);
      const open = await readOpenDarkroomState(page);
      check(name, "the open card refuses a second commission — no retry control inside the ceiling",
        open.retry === null && open.working, JSON.stringify({ retry: open.retry, working: open.working }));
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── 3 · The recovery itself can be refused — and says so ──
  {
    const name = "darkroom-recover-refused";
    const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      console.log(`\n  ${name}`);
      await page.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
      await hideDevChrome(page);
      await page.waitForTimeout(1500);

      const title = "The Twice-Unlucky Develop";
      await broadcast(page, insertEvents("ideas", [strandedIdea("qa-strand-2", title)]));
      await page.waitForTimeout(1800);
      await page.locator('[data-qa="board-card"]', { hasText: title }).first().click();
      await page.waitForTimeout(1000);

      // The abandon write carries print_status; refuse exactly that.
      await setFaults(page, [{ table: "ideas", op: "update", columns: ["print_status"] }]);
      await page.locator('[data-qa="retry-develop"]').click();
      await page.waitForTimeout(1200);

      const refused = await readOpenDarkroomState(page);
      console.log(`    · print slug "${refused.printFailed}" · retry still offered: ${refused.retry !== null}`);
      check(name, "a refused recovery reports on the bar's quiet line (U3's wrapper)",
        refused.printFailed === "Not sent · your text is saved", String(refused.printFailed));
      check(name, "and the stall is NOT dressed as a fresh develop — the flag and the retry stay",
        refused.retry === "Try again" && !!refused.stalledLine && !refused.working,
        JSON.stringify({ retry: refused.retry, line: refused.stalledLine }));

      // Lift the fault; the control that is already there is the retry.
      await setFaults(page, []);
      await page.locator('[data-qa="retry-develop"]').click();
      await page.waitForTimeout(1600);
      const recovered = await readOpenDarkroomState(page);
      check(name, "the same click recovers once the store allows it",
        recovered.working && recovered.retry === null,
        JSON.stringify({ working: recovered.working, retry: recovered.retry }));
    } finally {
      await page.close();
      await context.close();
    }
  }
}


// ═══════════════════════════════════════════════════════════════
// U8 — THE COACH EXCHANGE SURVIVES (`coach`)
// ═══════════════════════════════════════════════════════════════
// U8 of docs/plans/2026-08-04-001-harden-for-live-deployment-plan.md.
//
// The takeover's exchange was memory-only: closing it lost the whole
// conversation while the idea went on counting as coached, and the
// Newsroom's exact coaching count never saw a takeover exchange at
// all. The exchange now persists through the SAME training_notes path
// the training rooms write — one row per completed exchange, the
// record before the stamp — and rehydrates when the takeover reopens,
// across a close and across a full page reload (a second tab holds
// the showcase store; the reloaded tab re-joins over the bus, which is
// exactly how a real backend would hold it for free).
//
// The Newsroom is this suite's ledger: at the end the coaching count
// must have moved by EXACTLY the completed exchanges — one from the
// recorded flow, three from the three-coach flow, nothing from the
// abandoned beat and nothing from the refused insert. An exact total
// also proves no double-write anywhere on the path.

async function openCoachOn(page, title) {
  await page.locator('[data-qa="board-card"]', { hasText: title }).first().click();
  await page.waitForTimeout(900);
  await page.locator("button", { hasText: "Coach this idea" }).first().click();
  await page.waitForTimeout(1100);
}

async function readExchange(page) {
  return page.evaluate(() => ({
    users: document.querySelectorAll('[data-qa="exchange-user"]').length,
    plates: document.querySelectorAll('[data-qa="exchange-plate"]').length,
    noteFailed: (document.querySelector('[data-qa="coach-note-failed"]')?.textContent || "").trim() || null,
  }));
}

/** Close the takeover (Esc) and then the card (Done), back to the wall. */
async function closeCoachAndCard(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  const done = page.locator("button", { hasText: /^Done$/ });
  if (await done.count()) await done.first().click().catch(() => {});
  await page.waitForTimeout(900);
}

async function cardIsCoached(page, title) {
  return page.evaluate((t) => {
    const card = Array.from(document.querySelectorAll('[data-qa="board-card"]')).find((el) =>
      (el.textContent || "").includes(t),
    );
    return card ? /coached/i.test(card.querySelector(".stamp")?.textContent || "") : null;
  }, title);
}

async function runCoachExchangeSuite(browser) {
  console.log("\n══ THE COACH EXCHANGE SURVIVES (U8) ══════════════");
  await mkdir(OUT_DIR, { recursive: true });

  // One context: the Board tab does the coaching, the Newsroom tab is
  // the ledger AND the store's keeper across the Board tab's reload.
  const context = await browser.newContext({ viewport: DESK, deviceScaleFactor: 1 });
  const board = await context.newPage();
  const newsroom = await context.newPage();
  try {
    await newsroom.goto(`${BASE}/big-board`, { waitUntil: "networkidle", timeout: 30000 });
    await newsroom.waitForSelector('[data-qa="team-row"]', { timeout: 30000 });
    await board.goto(`${BASE}/group-1`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevChrome(board);
    await board.waitForTimeout(1500);

    const ledger0 = await newsroom.evaluate(() => {
      const el = document.querySelector('[data-qa="marquee-stat"][data-label="Coaching sessions"]');
      return el ? Number(el.dataset.value) : null;
    });
    check("coach-ledger", "the Newsroom's exact coaching count is readable before anything moves",
      ledger0 !== null, String(ledger0));

    await broadcast(board, insertEvents("ideas", [
      qaIdea("qa-coach-1", "team-one", "category_1", "The Coachable Idea", 40),
      qaIdea("qa-coach-2", "team-one", "category_1", "The Abandoned Beat", 39),
      qaIdea("qa-coach-3", "team-one", "category_1", "The Thrice-Coached Idea", 38),
      qaIdea("qa-coach-4", "team-one", "category_1", "The Unrecorded Exchange", 37),
    ]));
    await board.waitForTimeout(1800);

    // ── 1 · One exchange: recorded, stamped, restored — twice ──
    {
      const name = "coach-exchange-recorded";
      console.log(`\n  ${name}`);
      await openCoachOn(board, "The Coachable Idea");
      await board.locator("button", { hasText: "The Provocateur" }).first().click();
      await board.waitForTimeout(3200);
      let x = await readExchange(board);
      check(name, "the exchange landed — the seeded ask and the coach's plate",
        x.users === 1 && x.plates === 1, JSON.stringify(x));
      check(name, "and nothing says unrecorded", x.noteFailed === null, String(x.noteFailed));

      await closeCoachAndCard(board);
      check(name, "the idea is COACHED — the stamp follows a real, recorded exchange",
        (await cardIsCoached(board, "The Coachable Idea")) === true);

      // Reopen: the exchange is THERE, and no second round 1 composes.
      await openCoachOn(board, "The Coachable Idea");
      await board.locator("button", { hasText: "The Provocateur" }).first().click();
      await board.waitForTimeout(2600);
      x = await readExchange(board);
      check(name, "closing the takeover destroyed nothing — reopening restores the whole exchange",
        x.users === 1 && x.plates === 1, JSON.stringify(x));
      const shot = path.join(OUT_DIR, `${name}-restored.png`);
      await board.screenshot({ path: shot });
      results.captures.push({ name: `${name}-restored`, file: shot, caption: "The takeover reopened — the exchange restored from its record, no re-compose" });
      await closeCoachAndCard(board);

      // The hard half: a full page RELOAD mid-session. The Newsroom tab
      // keeps the store; the reloaded Board re-joins over the bus.
      await board.reload({ waitUntil: "networkidle" });
      await hideDevChrome(board);
      await board.waitForTimeout(2000);
      check(name, "the COACHED stamp survives the reload",
        (await cardIsCoached(board, "The Coachable Idea")) === true);
      await openCoachOn(board, "The Coachable Idea");
      await board.locator("button", { hasText: "The Provocateur" }).first().click();
      await board.waitForTimeout(2600);
      x = await readExchange(board);
      check(name, "and so does the exchange — refreshing mid-conversation no longer erases it",
        x.users === 1 && x.plates === 1, JSON.stringify(x));
      await closeCoachAndCard(board);
    }

    // ── 2 · Abandon during the beat: nothing kept, nothing counted ──
    {
      const name = "coach-abandon-during-beat";
      console.log(`\n  ${name}`);
      await openCoachOn(board, "The Abandoned Beat");
      await board.locator("button", { hasText: "The Sharpener" }).first().click();
      // The composing beat runs ~1.1s; leave inside it.
      await board.waitForTimeout(300);
      await board.keyboard.press("Escape");
      await board.waitForTimeout(1800);
      const done = board.locator("button", { hasText: /^Done$/ });
      if (await done.count()) await done.first().click().catch(() => {});
      await board.waitForTimeout(900);
      check(name, "abandoning before any reply marks nothing",
        (await cardIsCoached(board, "The Abandoned Beat")) === false);
    }

    // ── 3 · Three exchanges → three records, one stamp ──
    {
      const name = "coach-three-exchanges";
      console.log(`\n  ${name}`);
      await openCoachOn(board, "The Thrice-Coached Idea");
      for (const coachName of ["The Provocateur", "The Sharpener", "The Listener"]) {
        await board.locator("button", { hasText: coachName }).first().click();
        await board.waitForTimeout(3200);
        // Back to the picker for the next coach.
        await board.locator("button", { hasText: /^‹$/ }).first().click();
        await board.waitForTimeout(600);
      }
      await closeCoachAndCard(board);
      check(name, "three exchanges still make ONE stamp",
        (await cardIsCoached(board, "The Thrice-Coached Idea")) === true);
    }

    // ── 4 · The record refused: the exchange says so and no stamp goes on ──
    {
      const name = "coach-note-refused";
      console.log(`\n  ${name}`);
      await setFaults(board, [{ table: "training_notes", op: "insert" }]);
      await openCoachOn(board, "The Unrecorded Exchange");
      await board.locator("button", { hasText: "The Tastemaker" }).first().click();
      await board.waitForTimeout(3200);
      const x = await readExchange(board);
      console.log(`    · plates ${x.plates} · noteFailed "${x.noteFailed}"`);
      check(name, "the reply still lands — the room's conversation is not hostage to the store",
        x.plates === 1, JSON.stringify(x));
      check(name, "the surface says the exchange is not on record",
        !!x.noteFailed && /Not recorded/.test(x.noteFailed), String(x.noteFailed));
      const shot = path.join(OUT_DIR, `${name}.png`);
      await board.screenshot({ path: shot });
      results.captures.push({ name, file: shot, caption: "A refused record — the exchange stands, the slug says it is not on the idea's record" });
      await closeCoachAndCard(board);
      check(name, "and the idea is NOT marked coached — the stamp never outruns the record",
        (await cardIsCoached(board, "The Unrecorded Exchange")) === false);
      await setFaults(board, []);
    }

    // ── 5 · The ledger: the count moved by exactly the recorded exchanges ──
    {
      const name = "coach-ledger";
      console.log(`\n  ${name}`);
      // 1 (recorded) + 3 (three coaches) + 0 (abandoned) + 0 (refused).
      const expected = ledger0 + 4;
      const ledger = await waitForCoachingCount(newsroom, expected, 45000);
      console.log(`    · coaching sessions ${ledger0} → ${ledger.seen} (expected ${expected})`);
      check(name, "the Newsroom's coaching count moved by EXACTLY the completed exchanges — one per record, no double-write, nothing for abandons or refusals",
        ledger.ok, `${ledger0} → ${ledger.seen}, expected ${expected}`);
      const m = await newsroom.evaluate(() =>
        Array.from(document.querySelectorAll('[data-qa="marquee-stat"]')).map((el) => el.dataset.label),
      );
      check(name, "the marquee still reads its four settled metrics in order — the Newsroom itself is unchanged",
        JSON.stringify(m) === JSON.stringify(MARQUEE_LABELS), JSON.stringify(m));
    }
  } finally {
    await board.close();
    await newsroom.close();
    await context.close();
  }
}

// ── The comparison sheet ─────────────────────────────────────
function sheetHtml(captures, verdict) {
  const pick = (name) => captures.find((c) => c.name === name);
  const pair = (title, note, a, b) => `
    <section>
      <h2>${title}</h2>
      <p class="note">${note}</p>
      <div class="pair">
        ${[a, b].map((n) => {
          const c = pick(n);
          return c ? `<figure><img src="${path.basename(c.file)}" alt="${c.caption}" /><figcaption>${c.caption}</figcaption></figure>` : "";
        }).join("")}
      </div>
    </section>`;

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  :root { --ink:#231F20; --red:#EB3F43; --quiet:#6e6a6c; }
  * { box-sizing: border-box; }
  body { margin:0; padding:44px 48px 56px; background:#fff; color:var(--ink);
         font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; width:1680px;
         text-wrap:pretty; }
  h1 { font-family:Georgia,"Times New Roman",serif; font-size:46px; line-height:1.08;
       margin:0 0 10px; text-wrap:balance; }
  h2 { font-size:19px; letter-spacing:0.02em; margin:0 0 4px; }
  .slug { font-family:"Courier New",monospace; font-size:11px; letter-spacing:0.08em;
          text-transform:uppercase; color:var(--red); margin:0 0 10px; }
  .lede { font-size:15px; line-height:1.6; max-width:900px; color:#4a4749; margin:0 0 26px; }
  .note { font-size:13px; line-height:1.5; color:var(--quiet); margin:0 0 12px; max-width:1000px; }
  section { margin:0 0 34px; padding-top:18px; border-top:1px solid rgba(35,31,32,0.22); }
  .pair { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  figure { margin:0; }
  img { width:100%; display:block; border:1px solid rgba(35,31,32,0.28); }
  figcaption { font-size:12px; color:var(--quiet); margin-top:7px; letter-spacing:0.01em; }
  .verdict { border:2px solid var(--red); padding:20px 22px; margin:0 0 30px; }
  .verdict h2 { color:var(--red); font-size:15px; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:8px; }
  .verdict p { font-size:15px; line-height:1.6; margin:0 0 8px; max-width:1180px; }
  .verdict ul { margin:8px 0 0; padding-left:18px; font-size:14px; line-height:1.65; color:#3a3739; max-width:1180px; }
  .verdict li { margin-bottom:4px; }
</style></head><body>
  <p class="slug">Stage lab · U1 · queue placement decision · mock — do not ship</p>
  <h1>Where the room that isn’t presenting&nbsp;goes.</h1>
  <p class="lede">Two placements for the inactive-team queue, rendered inside the whole shared screen —
    real Stage header proportions, the live category tabs, and the production control strip — so each
    candidate is judged as a room-facing screen rather than a detached card comp. Same content and the
    same hierarchy in both: team name, creative platform, idea count, and an always-visible handoff.</p>
  ${verdict}
  ${pair("The readability bar — six mixed ideas at 1280×720",
    "Three developed prints and three text-only ideas on the typographic plate. This is the size the plan protects. Stacked builds three columns of 396px; the rail builds two of 451px. Both hold all six without scrolling.",
    "stage-stacked-mixed6-1280x720", "stage-rail-mixed6-1280x720")}
  ${pair("The same six at 1920×1080",
    "Three columns of 609px against two of 771px. Neither placement is under pressure at six ideas, which is why the decision is made under load, below.",
    "stage-stacked-mixed6-1920x1080", "stage-rail-mixed6-1920x1080")}
  ${pair("The composed five at 1280×720",
    "The density a team usually brings to the Stage. Note how much vertical room the field still has under the grid — that is the space the stacked band spends.",
    "stage-stacked-five-1280x720", "stage-rail-five-1280x720")}
  ${pair("Density — twelve ideas at 1280×720",
    "The column count falls out of the width the queue leaves behind; the card anatomy never changes. Whatever does not fit scrolls inside the work area, and no fixed chrome moves.",
    "stage-stacked-dense12-1280x720", "stage-rail-dense12-1280x720")}
  ${pair("Density at 1920×1080 — where the candidates separate",
    "Twelve ideas at projector size. The stacked field holds nine before the fold; the rail holds six, because the 300px it took never comes back.",
    "stage-stacked-dense12-1920x1080", "stage-rail-dense12-1920x1080")}
  ${pair("Idea focus — temporary, local, one Kruger",
    "The overview stays mounted beneath. The print mounts as a full 16:9 frame; a text-only idea gets the typographic plate composed from data it already carries — frame number, title, description, team, platform, category. No fabricated imagery.",
    "stage-focus-print-1280x720", "stage-focus-plate-1280x720")}
</body></html>`;
}

async function renderSheet(browser, verdictHtml) {
  console.log("\n── COMPARISON SHEET ──────────────────────────────");
  const htmlPath = path.join(OUT_DIR, "_sheet.html");
  await writeFile(htmlPath, sheetHtml(results.captures, verdictHtml), "utf8");
  const context = await browser.newContext({ viewport: { width: 1680, height: 1200 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    await mkdir(path.dirname(SHEET_PATH), { recursive: true });
    await page.screenshot({ path: SHEET_PATH, fullPage: true });
    console.log(`  → ${SHEET_PATH}`);
  } finally {
    await page.close();
    await context.close();
    await rm(htmlPath, { force: true });
  }
}

// ── THE FACILITATOR'S SESSION (U8 of the harness, U5 of the plan) ──
//
// Drives the real login and the real gate rather than reading the code:
// the password goes in through the form, the cookie comes back through
// the browser, and every gated route is called twice — once with a
// session and once without.
//
// The suite proves BOTH directions, and the second one is the point:
// no room-facing surface is ever asked to authenticate, and none of the
// paths a participant's device touches has become a 401.

/** The facilitator password, from the process env or from app/.env.local.
 *  Never printed. The suite cannot prove anything without it, so its
 *  absence is a FAILED check rather than a quiet skip. */
async function adminCredentials() {
  let password = process.env.ADMIN_PASSWORD || "";
  let secret = process.env.ADMIN_SESSION_SECRET || "";
  if (!password) {
    try {
      const raw = await readFile(path.join(REPO, "app", ".env.local"), "utf8");
      for (const line of raw.split("\n")) {
        const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
        if (!m) continue;
        const value = m[2].replace(/^["']|["']$/g, "");
        if (m[1] === "ADMIN_PASSWORD" && !password) password = value;
        if (m[1] === "ADMIN_SESSION_SECRET" && !secret) secret = value;
      }
    } catch {
      /* no .env.local — reported by the caller */
    }
  }
  return { password, secret: secret || password };
}

/** Mint a token in the app's own scheme, so the suite can present one
 *  that is correctly signed and genuinely expired — the case a forged
 *  cookie cannot reach. */
async function mintQaToken(secret, expiryEpochSeconds) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const payload = `v1.${expiryEpochSeconds}`;
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const b64 = Buffer.from(new Uint8Array(sig)).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${payload}.${b64}`;
}

// Every route the plan gates, with a body the handler would otherwise
// accept — so a 401 can only be the session and never validation.
const GATED_CALLS = [
  { method: "PUT", path: "/api/settings", data: { key: "workshop_state", value: "HIJACKED FROM A PUBLIC URL" }, note: "rewrites the room's screen" },
  { method: "PUT", path: "/api/settings/briefs", data: { category: "category_1", brief_context: "x" } },
  { method: "PUT", path: "/api/settings/coach-prompts", data: { coach_type: "provocateur", system_prompt: "x" }, note: "rewrites the coaches' prompts" },
  { method: "POST", path: "/api/ticker", data: { message: "x" } },
  { method: "PATCH", path: "/api/ticker", data: { id: "00000000-0000-0000-0000-000000000000", is_active: false }, note: "the console's wire toggle, rewired through the API" },
  { method: "DELETE", path: "/api/ticker?id=00000000-0000-0000-0000-000000000000" },
  { method: "PATCH", path: "/api/teams/group-1", data: { display_name: "x" }, note: "the console's team edits, rewired through the API" },
  { method: "GET", path: "/api/phase" },
  { method: "POST", path: "/api/phase", data: { pillar: null, view: null } },
  { method: "POST", path: "/api/merge", data: { idea_ids: ["a", "b"], category: "category_1", team_id: "t" } },
  { method: "POST", path: "/api/report", data: { facilitatorNotes: "x" }, note: "a 120s model call" },
  { method: "POST", path: "/api/breaking-news", data: {} },
  { method: "PATCH", path: "/api/ideas/00000000-0000-0000-0000-000000000000", data: { name: "x" } },
  { method: "DELETE", path: "/api/ideas/00000000-0000-0000-0000-000000000000" },
];

// The room's own paths. A 401 on ANY of these is a failed unit — the
// room does not authenticate. Status codes vary (400 for a deliberately
// empty body, 503 with no model key); only "not refused for want of a
// session" is asserted.
const OPEN_CALLS = [
  // The Scout is pitched from the team Board — a room surface. Gating it
  // degraded a participant feature to canned pitches with no explanation,
  // so it carries `/api/coach`'s posture instead.
  { method: "POST", path: "/api/scout", data: { teamId: "t", pillar: "category_1", existingIdeas: [] } },
  { method: "GET", path: "/api/settings?key=workshop_state" },
  { method: "GET", path: "/api/ticker" },
  { method: "GET", path: "/api/teams" },
  { method: "GET", path: "/api/report" },
  { method: "GET", path: "/api/ideas?category=category_1" },
  { method: "POST", path: "/api/ideas", data: {}, note: "the room captures ideas" },
  { method: "POST", path: "/api/votes", data: {}, note: "the ballot" },
  { method: "DELETE", path: "/api/votes" },
  { method: "POST", path: "/api/coach", data: {}, note: "a participant tool — open by design" },
];

// The surfaces the room works on. None may be redirected to a login.
const ROOM_SURFACES = ["/", "/group-2", "/group-2/quick-add", "/vote", "/big-board", "/center-court"];

/** A 503 from the gate ("Admin console is not configured") and a 503
 *  from a route with no model key ("AI service not configured") are
 *  different facts. The suite reads the body so it can never mistake one
 *  for the other. */
const REFUSED_BY_THE_GATE = /Admin session required|Admin console is not configured/;

async function apiCall(request, base, call) {
  const options = call.data === undefined ? {} : { data: call.data };
  const res = await request.fetch(base + call.path, { method: call.method, ...options });
  return { status: res.status(), body: await res.text().catch(() => "") };
}

async function runSessionSuite(browser) {
  console.log("\n══ THE FACILITATOR'S SESSION (U5) ════════════════");
  await mkdir(OUT_DIR, { recursive: true });

  const { password, secret } = await adminCredentials();
  check("session", "the suite has a facilitator password to drive the real gate with",
    !!password, "set ADMIN_PASSWORD in app/.env.local or the environment");
  if (!password) return;

  // ── The gate, with no session ──
  {
    const context = await browser.newContext({ viewport: LAPTOP });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 30000 });
      check("session-closed", "the console refuses a visitor with no session",
        new URL(page.url()).pathname === "/admin-login", page.url());
      const body = await page.evaluate(() => document.body.innerText);
      check("session-closed", "and nothing of the console painted on the way past",
        !/workshop settings|coach prompts/i.test(body));
      check("session-closed", "a clean arrival is not accused of a wrong password",
        !/wrong password/i.test(body));

      await hideDevChrome(page);
      const cleanFile = path.join(OUT_DIR, "session-login-clean-1280x720.png");
      await page.screenshot({ path: cleanFile });
      results.captures.push({
        name: "session-login-clean-1280x720", file: cleanFile,
        caption: "The door, arrived at cleanly — the workbench register, one field, no accusation",
      });

      // The refusal has to SAY SO. A prior build showed nothing on a
      // second wrong attempt: the message was seeded into state once and
      // typing had already cleared it, while a client-side push never
      // remounted the route. Both attempts are driven here.
      for (const attempt of [1, 2]) {
        await page.fill('input[type="password"]', `wrong-password-${attempt}`);
        // Wait on the POST rather than on the URL: both attempts land on
        // the same ?error=1 address, so a URL wait would resolve on the
        // PREVIOUS attempt's result and prove nothing about this one.
        await Promise.all([
          page.waitForResponse(
            (r) => r.url().includes("/api/admin-login") && r.request().method() === "POST",
            { timeout: 15000 },
          ),
          page.click('button[type="submit"]'),
        ]);
        await page.waitForLoadState("networkidle");
        const text = await page.evaluate(() => document.body.innerText);
        check("session-closed", `attempt ${attempt} with a wrong password says so`,
          /wrong password/i.test(text), text.slice(0, 80).replace(/\n/g, " "));
        check("session-closed", `attempt ${attempt} sets no session cookie`,
          !(await context.cookies()).some((c) => c.name === "basecamp_admin_session"));
        if (attempt === 1) {
          await hideDevChrome(page);
          const file = path.join(OUT_DIR, "session-login-refused-1280x720.png");
          await page.screenshot({ path: file });
          results.captures.push({
            name: "session-login-refused-1280x720", file,
            caption: "A wrong password, reported — red on the line and on the field's rule, once",
          });
        }
      }

      // Every gated route, unauthenticated.
      const before = await context.request.fetch(`${BASE}/api/settings?key=workshop_state`);
      const beforeBody = await before.text();
      for (const call of GATED_CALLS) {
        const { status, body } = await apiCall(context.request, BASE, call);
        check("session-closed", `${call.method} ${call.path.split("?")[0]} refuses without a session${call.note ? ` — ${call.note}` : ""}`,
          status === 401 && REFUSED_BY_THE_GATE.test(body), `got ${status}`);
      }
      const after = await context.request.fetch(`${BASE}/api/settings?key=workshop_state`);
      check("session-closed", "the room's screen is exactly where it was after all of that",
        (await after.text()) === beforeBody);

      // And nothing the room does was taken away.
      for (const call of OPEN_CALLS) {
        const { status, body } = await apiCall(context.request, BASE, call);
        check("session-open-by-design", `${call.method} ${call.path.split("?")[0]} is not refused for want of a session${call.note ? ` — ${call.note}` : ""}`,
          !REFUSED_BY_THE_GATE.test(body), `got ${status} ${body.slice(0, 60)}`);
      }

      // A forged cookie, and a correctly signed one that has run out.
      await context.addCookies([{ name: "basecamp_admin_session", value: "v1.9999999999.notasignature", url: BASE }]);
      const forged = await context.request.fetch(`${BASE}/api/settings`, { method: "PUT", data: { key: "workshop_state", value: "x" } });
      check("session-closed", "a forged signature is refused", forged.status() === 401, `got ${forged.status()}`);

      await context.clearCookies();
      const expired = await mintQaToken(secret, Math.floor(Date.now() / 1000) - 60);
      await context.addCookies([{ name: "basecamp_admin_session", value: expired, url: BASE }]);
      const stale = await context.request.fetch(`${BASE}/api/settings`, { method: "PUT", data: { key: "workshop_state", value: "x" } });
      check("session-closed", "a correctly signed token past its expiry is refused",
        stale.status() === 401, `got ${stale.status()}`);
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 30000 });
      check("session-closed", "and the console sends the facilitator back to the door, saying the session ended",
        /admin-login/.test(page.url()) && /expired=1/.test(page.url()), page.url());
      const expiredText = await page.evaluate(() => document.body.innerText);
      check("session-closed", "an ended session is not reported as a wrong password",
        !/wrong password/i.test(expiredText) && /session has ended/i.test(expiredText));
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The gate, with the one password ──
  {
    const context = await browser.newContext({ viewport: LAPTOP });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 30000 });
      await page.fill('input[type="password"]', password);
      await Promise.all([
        page.waitForURL((u) => new URL(u).pathname === "/admin", { timeout: 30000 }),
        page.click('button[type="submit"]'),
      ]);
      await page.waitForLoadState("networkidle");
      check("session-open", "the right password opens the console", new URL(page.url()).pathname === "/admin");

      const jar = await context.cookies();
      const cookie = jar.find((c) => c.name === "basecamp_admin_session");
      check("session-open", "a session cookie was issued", !!cookie);
      check("session-open", "it is httpOnly — no script on the origin can read it", !!cookie?.httpOnly);
      check("session-open", "it is SameSite=Lax", cookie?.sameSite === "Lax", String(cookie?.sameSite));
      check("session-open", "it is scoped to the whole app, path /", cookie?.path === "/");
      check("session-open", "IT IS NOT THE PASSWORD — the credential never became the cookie",
        !!cookie && !cookie.value.includes(password));
      check("session-open", "the pre-U5 plaintext cookie is not present", !jar.some((c) => c.name === "admin_auth"));

      const visible = await page.evaluate(() => document.cookie);
      check("session-open", "document.cookie carries neither the session nor the password",
        !visible.includes("basecamp_admin_session") && !visible.includes(password), visible.slice(0, 60));

      // The gated routes, now, with the session the browser holds.
      const probe = await context.request.fetch(`${BASE}/api/settings`, {
        method: "PUT",
        data: { key: "qa_admin_session_probe", value: `session ${Date.now()}` },
      });
      check("session-open", "a gated route accepts the session", probe.status() === 200, `got ${probe.status()}`);
      const ticker = await context.request.fetch(`${BASE}/api/ticker`, { method: "POST", data: { message: "QA session probe" } });
      check("session-open", "a second gated route accepts the same session",
        ticker.status() === 201 || ticker.status() === 200, `got ${ticker.status()}`);

      await hideDevChrome(page);
      const file = path.join(OUT_DIR, "session-console-open-1280x720.png");
      await page.screenshot({ path: file });
      results.captures.push({
        name: "session-console-open-1280x720", file,
        caption: "One password at the start of the day, and the console is simply open",
      });
    } finally {
      await page.close();
      await context.close();
    }
  }

  // ── The room never authenticates ──
  {
    const context = await browser.newContext({ viewport: LAPTOP });
    const page = await context.newPage();
    try {
      for (const surface of ROOM_SURFACES) {
        await page.goto(`${BASE}${surface}`, { waitUntil: "networkidle", timeout: 60000 });
        const landed = new URL(page.url()).pathname;
        check("session-room", `${surface} is never asked for a password`,
          landed !== "/admin-login", `landed on ${landed}`);
        const text = await page.evaluate(() => document.body.innerText.trim().length);
        check("session-room", `${surface} renders its own content with no session`, text > 0, `${text} chars`);
      }
      const jar = await context.cookies();
      check("session-room", "walking every room surface issues no session cookie",
        !jar.some((c) => c.name === "basecamp_admin_session"));
    } finally {
      await page.close();
      await context.close();
    }
  }
}

// ── FAIL CLOSED — run this one deliberately ──────────────────
//
// The defect: with ADMIN_PASSWORD unset the middleware used to return
// `NextResponse.next()`, so one forgotten env var published the console.
// Proving the inversion needs a server started WITHOUT the variable, and
// Next 16 refuses a second dev server against the same directory — so
// this cannot ride along inside `all`. The recipe below leaves the
// running dev server alone, because a second copy of the source with no
// `.env.local` is a different directory:
//
//   cd <repo> && rm -rf .u5-noadmin && mkdir .u5-noadmin
//   cp -R app/app app/components app/lib app/public .u5-noadmin/
//   cp app/next.config.ts app/tsconfig.json app/package.json \
//      app/postcss.config.mjs app/eslint.config.mjs app/middleware.ts .u5-noadmin/
//   ln -s ../app/node_modules .u5-noadmin/node_modules
//   (cd .u5-noadmin && npx next dev -p 3099)
//   node scripts/visual-qa-board-stage-newsroom.mjs session-unconfigured http://localhost:3099
//   # then kill the server and: rm -rf .u5-noadmin
//
// The copy must sit INSIDE the repo. Turbopack rejects a symlink that
// points out of its inferred filesystem root, which is what makes the
// same recipe in /tmp fail with "Symlink ... is invalid".
//
// Run it whenever middleware.ts or lib/admin-session.ts changes. It is
// the check that the room's console cannot be published by an omission.
async function runSessionUnconfiguredSuite(browser) {
  console.log("\n══ FAIL CLOSED — NO ADMIN_PASSWORD (U5) ══════════");
  await mkdir(OUT_DIR, { recursive: true });

  const context = await browser.newContext({ viewport: LAPTOP });
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 30000 });
    const landed = new URL(page.url());
    check("session-unconfigured", "an unconfigured console is DENIED, not published",
      landed.pathname === "/admin-login", page.url());
    check("session-unconfigured", "and it says the console is not configured rather than offering a login that cannot work",
      landed.searchParams.get("unconfigured") === "1", page.url());

    const text = await page.evaluate(() => document.body.innerText);
    check("session-unconfigured", "the standing names the missing variable",
      /not configured/i.test(text) && /ADMIN_PASSWORD/.test(text));
    check("session-unconfigured", "no password field is offered, because no password would work",
      (await page.locator('input[type="password"]').count()) === 0);
    check("session-unconfigured", "and it says the room is unaffected", /room/i.test(text));

    await hideDevChrome(page);
    const file = path.join(OUT_DIR, "session-unconfigured-1280x720.png");
    await page.screenshot({ path: file });
    results.captures.push({
      name: "session-unconfigured-1280x720", file,
      caption: "No ADMIN_PASSWORD — the console is closed, and the standing says so instead of asking",
    });

    for (const call of GATED_CALLS) {
      const { status, body } = await apiCall(context.request, BASE, call);
      check("session-unconfigured", `${call.method} ${call.path.split("?")[0]} is refused, not served`,
        status === 503 && /Admin console is not configured/.test(body), `got ${status}`);
    }

    const login = await context.request.fetch(`${BASE}/api/admin-login`, { method: "POST", data: { password: "anything" } });
    check("session-unconfigured", "no password can buy a session when none is configured",
      login.status() === 503, `got ${login.status()}`);
    check("session-unconfigured", "and none was issued",
      !(await context.cookies()).some((c) => c.name === "basecamp_admin_session"));

    // The whole point of failing closed HERE rather than everywhere.
    for (const surface of ROOM_SURFACES) {
      await page.goto(`${BASE}${surface}`, { waitUntil: "networkidle", timeout: 60000 });
      check("session-unconfigured", `${surface} still runs with no admin configured at all`,
        new URL(page.url()).pathname !== "/admin-login", page.url());
    }
    for (const call of OPEN_CALLS) {
      const { status, body } = await apiCall(context.request, BASE, call);
      check("session-unconfigured", `${call.method} ${call.path.split("?")[0]} still serves the room`,
        !REFUSED_BY_THE_GATE.test(body), `got ${status} ${body.slice(0, 60)}`);
    }
  } finally {
    await page.close();
    await context.close();
  }
}

// ── The verdict block (the U1 ruling, carried onto the sheet) ─
const VERDICT = `
  <div class="verdict">
    <h2>Recorded direction for U3 — candidate A, the stacked queue</h2>
    <p><strong>The rail buys card size by deleting a column, and the room pays for it in ideas.</strong>
      Measured at 1280×720: the stacked field runs 1216px and builds three columns of 396px cards (192px
      print, 198px content well); the rail field runs 916px and builds two columns of 451px cards (219px
      print, 226px well). Six mixed ideas fit in both. The gap opens under load and at projector size — at
      1920×1080 with twelve ideas the stacked field shows nine before the fold and the rail shows six. The
      rail spends 300px, 23% of the widest dimension at laptop size, on a column that stands roughly
      two-thirds empty whenever two teams are waiting; the stacked band spends ~120px of height, which the
      field demonstrably had spare at five and six ideas.</p>
    <ul>
      <li><strong>Room readability</strong> — an honest edge to B: its cards and prints run 14–27% larger. Both sit well above the projector floor at both sizes, so the edge does not decide anything.</li>
      <li><strong>Visible idea capacity</strong> — level at five and six, decisive at twelve: 9/12 against 6/12 at 1920×1080. A also puts the overflow row on the horizontal fold, where a half-visible row reads as &ldquo;there is more&rdquo; rather than as a cropped column.</li>
      <li><strong>Identifying the next team</strong> — identical content and an always-visible handoff in both. A sits the queue directly above the control strip, so the operator’s whole vocabulary is one horizontal zone at the foot of the screen.</li>
      <li><strong>Operator controls</strong> — the control strip is unchanged and never scrolls in either. A adds no second interface; B opens a persistent vertical region beside the room’s work, which is the risk the plan names.</li>
    </ul>
    <p>Carried with it into U3: <strong>the overview holds no Kruger.</strong> The active team already owns
      the whole viewport, so a red bar on its header would mark a team, which Round 7 forbids. The single
      Kruger appears in idea focus, on the idea the room has opened. And <strong>one card anatomy</strong>
      holds the field — a printed idea splits into a content well and its full 16:9 frame; an unprinted
      idea gives the whole cell to the typographic plate, so no card is ever an empty media hole.</p>
    <p><strong>Left open for U3 to tune:</strong> the column floor is 380px and grows with the viewport
      (30vw), which keeps the frames projector-sized; a five- or six-idea field still leaves the lower
      third of a 1080p wall empty. Decide there whether the field centres its grid or lets the rows grow
      — the queue placement does not depend on it.</p>
  </div>`;

// ── Main ─────────────────────────────────────────────────────
const chromium = await loadChromium();
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE });
  console.log(`Visual QA — suite: ${SUITE} · base: ${BASE}`);

  if (SUITE === "stage" || SUITE === "all") {
    await runStageSuite(browser);
    await renderSheet(browser, VERDICT);
  }
  if (SUITE === "board" || SUITE === "all") {
    await runBoardSuite(browser);
  }
  if (SUITE === "newsroom" || SUITE === "all") {
    await runNewsroomSuite(browser);
  }
  if (SUITE === "stage-live" || SUITE === "all") {
    await runStageLiveSuite(browser);
  }
  if (SUITE === "focus" || SUITE === "all") {
    await runFocusSuite(browser);
  }
  if (SUITE === "proof" || SUITE === "all") {
    await runProofSuite(browser);
  }
  if (SUITE === "identity" || SUITE === "all") {
    await runIdentitySuite(browser);
  }
  if (SUITE === "session" || SUITE === "all") {
    await runSessionSuite(browser);
  }
  if (SUITE === "phone" || SUITE === "all") {
    await runPhoneSuite(browser);
  }
  // `resilience` runs under `all`: it drives DELIBERATE failures, but it
  // arms and disarms them inside its own contexts and never leaves a
  // fault behind, so it costs the rest of the run nothing and is the
  // only place a failed write is ever exercised.
  if (SUITE === "resilience" || SUITE === "all") {
    await runResilienceSuite(browser);
  }
  // U4 — the present gate's third state. Drives its own fixtures over
  // the showcase bus, one context per scenario, nothing left behind.
  if (SUITE === "present-gate" || SUITE === "all") {
    await runPresentGateSuite(browser);
  }
  // U6 — the Darkroom's stranded-develop recovery. One real 20–30s
  // develop is waited out (Round 14: the beat is not shortened).
  if (SUITE === "darkroom" || SUITE === "all") {
    await runDarkroomRecoverySuite(browser);
  }
  // U8 — the coach exchange's durability, with the Newsroom's exact
  // count as the ledger.
  if (SUITE === "coach" || SUITE === "all") {
    await runCoachExchangeSuite(browser);
  }
  // Deliberately NOT in `all` — it needs a server started with no
  // ADMIN_PASSWORD, and Next refuses a second dev server on the same
  // directory. See the note above runSessionUnconfiguredSuite.
  if (SUITE === "session-unconfigured") {
    await runSessionUnconfiguredSuite(browser);
  }

  if (micro.size) {
    // Reported, not gated: the system's 10–11px slug/stamp/chip register
    // sits under the contract's written 12–13px label range on every
    // surface, including ones this plan never touched. It is a
    // typography pass of its own, and it is on record here so it stays
    // visible rather than being quietly excused.
    console.log("\n── MICRO-REGISTER CENSUS (10–11px, pre-existing) ──");
    [...micro.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .forEach(([k, n]) => console.log(`  ×${String(n).padStart(3)}  ${k}`));
    console.log(`  ${micro.size} distinct micro-register strings across the audited states`);
  }

  console.log("\n── SUMMARY ───────────────────────────────────────");
  console.log(`  captures : ${results.captures.length} → ${OUT_DIR}`);
  console.log(`  passed   : ${results.passed}`);
  console.log(`  failed   : ${results.failed.length}`);
  results.failed.forEach((f) => console.log(`    ✗ ${f}`));
  if (results.failed.length) process.exitCode = 1;
} finally {
  // Cleanup runs on the failure path too — no orphaned Chromium, ever.
  if (browser) await browser.close();
}
