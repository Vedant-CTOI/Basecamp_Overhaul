
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  const routes = [
    ["entry", "/", 1440, 900],
    ["teamselect", "/", 1440, 900, true],
    ["stage", "/center-court", 1920, 1080],
    ["feed", "/big-board", 1440, 900],
    ["board", "/group-1", 1440, 900],
    ["vote", "/vote", 390, 844],
  ];
  for (const [name, path, w, h, noSession] of routes) {
    const p = await b.newPage({viewport:{width:w,height:h}});
    if (!noSession) await p.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
    try {
      await p.goto("https://basecamp-overhaul.onrender.com" + path, {waitUntil:"networkidle", timeout:60000});
      await p.waitForTimeout(3200);
      await p.screenshot({path:`C:/Users/VedantSaxena/projects/basecamp-overhaul/output/prod-${name}.png`});
      console.log("ok", name);
    } catch(e) { console.log("FAIL", name, String(e).slice(0,100)); }
    await p.close();
  }
  await b.close();
})();
