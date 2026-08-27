
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
  await p.goto("http://localhost:3104/group-1", {waitUntil:"networkidle", timeout:45000});
  await p.waitForTimeout(3500);
  await p.hover('[data-qa="board-making"] button:first-child').catch(()=>{});
  await p.waitForTimeout(600);
  await p.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-showcase/output/board-doveui.png"});
  console.log("ok");
  await b.close();
})();
