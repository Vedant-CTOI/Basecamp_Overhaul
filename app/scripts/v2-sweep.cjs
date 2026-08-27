
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  const routes = [
    ["entry", "/", 1440, 900],
    ["stage", "/center-court", 1920, 1080],
    ["feed", "/big-board", 1440, 900],
    ["board", "/group-1", 1440, 900],
    ["vote", "/vote", 390, 844],
  ];
  for (const [name, path, w, h] of routes) {
    const p = await b.newPage({viewport:{width:w,height:h}});
    await p.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
    try {
      await p.goto("http://localhost:3105" + path, {waitUntil:"networkidle", timeout:45000});
      await p.waitForTimeout(3200);
      try { await p.waitForSelector('[data-qa="board-grid"]', {timeout:6000}); } catch {}
      await p.screenshot({path:`C:/Users/VedantSaxena/projects/basecamp-overhaul/output/v2-${name}.png`});
      console.log("ok", name);
    } catch(e) { console.log("FAIL", name, String(e).slice(0,100)); }
    await p.close();
  }
  await b.close();
})();
