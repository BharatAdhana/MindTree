const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 500));
  
  await page.evaluate(() => {
    console.log("focusNode test starting");
    const p = layout()[selected];
    console.log("p.x:", p?.x, "p.y:", p?.y);
    focusNode(selected);
    const canvas = document.getElementById("canvas");
    console.log("After focusNode scrollLeft:", canvas.scrollLeft);
  });
  
  await browser.close();
})();
