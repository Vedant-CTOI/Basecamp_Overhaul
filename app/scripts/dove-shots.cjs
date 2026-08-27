/* Dove Real Intelligence — key-route screenshots at two viewports */
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://localhost:3102";
const CHROME = process.env.CHROME_HEADLESS_SHELL;
const OUT = process.argv[3] || "output/shots";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(CHROME ? { executablePath: CHROME } : {}),
  });
  const shots = [
    ["entry", "/", 1440, 900],
    ["entry-mobile", "/", 390, 844],
    ["stage", "/center-court", 1920, 1080],
    ["feed", "/big-board", 1440, 900],
    ["board-empty", "/group-1", 1440, 900],
    ["vote-idle", "/vote", 390, 844],
  ];
  for (const [name, path, w, h] of shots) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (err) => console.log("  PAGEERROR", name, String(err).slice(0, 200)));
    page.on("console", (msg) => { if (msg.type() === "error") console.log("  CONSOLE-ERR", name, msg.text().slice(0, 200)); });
    try {
      // Pre-seed the room-code session so gated surfaces render their real UI
      await page.addInitScript(() => {
        window.sessionStorage.setItem("workshop-room-code", "DOVE26");
      });
      await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(4000);
      // Board surfaces: wait for the wall to actually mount
      try { await page.waitForSelector('[data-qa="board-grid"]', { timeout: 8000 }); } catch {}
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log("ok", name);
    } catch (e) {
      console.log("FAIL", name, String(e).slice(0, 120));
    }
    await page.close();
  }
  await browser.close();
})();
