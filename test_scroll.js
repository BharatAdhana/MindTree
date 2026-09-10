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
    return {
      scrollWidth: canvas.scrollWidth,
      scrollHeight: canvas.scrollHeight,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      scrollLeft: canvas.scrollLeft,
      scrollTop: canvas.scrollTop,
      overflow: window.getComputedStyle(canvas).overflow
    };
  });
  console.log("Canvas metrics:", metrics);
  
  await browser.close();
})();
