const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 800));
  
  const metrics = await page.evaluate(() => {
    const wrap = document.querySelector('.node');
    const comp = window.getComputedStyle(wrap);
    return {
      styleTop: wrap.style.top,
      styleLeft: wrap.style.left,
      compTop: comp.top,
      compLeft: comp.left,
      compTransform: comp.transform
    };
  });
  console.log("Wrap Metrics:", metrics);
  
  await browser.close();
})();
