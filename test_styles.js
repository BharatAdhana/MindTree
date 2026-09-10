const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 800));
  
  const metrics = await page.evaluate(() => {
    const root = document.querySelector('.node-card');
    const board = document.getElementById('board');
    return {
      nodeTop: root.style.top,
      nodeLeft: root.style.left,
      boardMargin: board.style.margin,
      boardTop: board.style.top,
      boardLeft: board.style.left,
      boardCSS: window.getComputedStyle(board).cssText
    };
  });
  console.log("Metrics:", metrics);
  
  await browser.close();
})();
