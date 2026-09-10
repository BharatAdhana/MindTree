const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 500));
  
  const ctxInfo = await page.evaluate(() => {
    const ctx = document.getElementById('context');
    return {
      parentId: ctx.parentElement.id,
      parentClass: ctx.parentElement.className
    };
  });
  console.log("Context Parent:\n", ctxInfo);
  
  await browser.close();
})();
