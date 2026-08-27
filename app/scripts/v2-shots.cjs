
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  const p = await b.newPage({viewport:{width:1440,height:900}});
  await p.addInitScript(() => { window.sessionStorage.setItem("workshop-room-code", "DOVE26"); });
  await p.goto("http://localhost:3105/group-1", {waitUntil:"networkidle", timeout:45000}).catch(e=>console.log("nav err"));
  await p.waitForTimeout(3500);
  await p.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-overhaul/output/board-v2.png"});
  await p.goto("http://localhost:3105/", {waitUntil:"networkidle", timeout:45000}).catch(()=>{});
  await p.waitForTimeout(2500);
  await p.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-overhaul/output/entry-v2.png"});
  console.log("shots ok");
  await b.close();
})();
