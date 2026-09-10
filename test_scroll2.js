const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 500));
  
  const metrics = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.scrollLeft = 24400;
    canvas.scrollTop = 24400;
    return {
      scrollWidth: canvas.scrollWidth,
      scrollHeight: canvas.scrollHeight,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
    };
  });
  console.log("Manual scroll metrics:", metrics);
  
  await browser.close();
})();
