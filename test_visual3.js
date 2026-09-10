const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
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
  
  // Try dragging a SECOND TIME to ensure it doesn't snap back!
  console.log("=== TEST 2: Second Drag (Checking Snap Back) ===");
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 500);
  await page.mouse.down({ button: 'left' });
  const middlePan = await page.evaluate(() => ({x: panX, y: panY}));
  console.log("Pan immediately after mouse down:", middlePan);
  console.log("Did it snap back to initial?", middlePan.x === initialPan.x ? "YES (FAIL)" : "NO (PASS)");
  
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 500, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  
  const finalPan2 = await page.evaluate(() => ({x: panX, y: panY}));
  console.log("Final Pan after second drag:", finalPan2);

  // Try center button!
  console.log("=== TEST 3: Center Button ===");
  await page.evaluate(() => document.getElementById('centerBottom').click());
  await new Promise(r => setTimeout(r, 100)); // wait for rAF
  const centerPan = await page.evaluate(() => ({x: panX, y: panY}));
  console.log("Pan after centering:", centerPan);
  console.log("Did it center?", centerPan.x !== finalPan2.x ? "YES (PASS)" : "NO (FAIL)");

  await browser.close();
})();
