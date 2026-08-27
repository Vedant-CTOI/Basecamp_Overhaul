
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true, executablePath: process.env.CHROME_HEADLESS_SHELL});
  const p = await b.newPage({viewport:{width:500,height:200}});
  await p.goto("file:///C:/Users/VedantSaxena/projects/basecamp-showcase/output/logo-test.html");
  await p.waitForTimeout(600);
  await p.screenshot({path:"C:/Users/VedantSaxena/projects/basecamp-showcase/output/logo-test.png"});
  await b.close();
  console.log("shot ok");
})();
