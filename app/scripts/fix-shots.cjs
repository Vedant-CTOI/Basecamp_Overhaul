
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  // Board with team menu OPEN
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
  await p.goto("https://basecamp-overhaul.onrender.com/group-1", {waitUntil:"networkidle", timeout:60000});
  await p.waitForTimeout(3200);
  const trigger = await p.$('.soft-btn');
  if (trigger) { await trigger.click(); await p.waitForTimeout(700); }
  await p.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-overhaul/output/fix-menu.png"});
  await p.close();
  // Add modal
  const p2 = await b.newPage({viewport:{width:1440,height:900}});
  await p2.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
  await p2.goto("https://basecamp-overhaul.onrender.com/group-1", {waitUntil:"networkidle", timeout:60000});
  await p2.waitForTimeout(3200);
  const add = await p2.$('button.add-pocket');
  if (add) { await add.click(); await p2.waitForTimeout(900); }
  await p2.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-overhaul/output/fix-modal.png"});
  await p2.close();
  await b.close();
  console.log("ok");
})();
