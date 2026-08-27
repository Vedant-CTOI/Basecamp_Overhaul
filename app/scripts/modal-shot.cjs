
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
  await p.goto("http://localhost:3104/group-1", {waitUntil:"networkidle", timeout:45000});
  await p.waitForTimeout(3000);
  // click the Add pocket
  const btn = await p.$('button.add-pocket');
  if (btn) { await btn.click(); await p.waitForTimeout(900); }
  await p.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-showcase/output/add-modal.png"});
  console.log("ok");
  await b.close();
})();
