const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await page.waitForSelector('#canvas');
  
  console.log("=== TEST 1: Left-click Canvas Drag ===");
  const canvas = await page.$('#canvas');
  const canvasBox = await canvas.boundingBox();
  
  const initialPan = await page.evaluate(() => ({x: panX, y: panY}));
  console.log("Initial Pan:", initialPan);
  
  await page.mouse.move(canvasBox.x + 500, canvasBox.y + 500);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 500, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  
  const finalPan = await page.evaluate(() => ({x: panX, y: panY}));
  console.log("Final Pan:", finalPan);
  console.log("Drag worked?", finalPan.x !== initialPan.x ? "YES" : "NO");

  await browser.close();
})();
