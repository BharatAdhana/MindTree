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
  
  const initialScroll = await page.evaluate(() => {
    const el = document.getElementById('canvas');
    return { left: el.scrollLeft, top: el.scrollTop };
  });
  console.log("Initial Scroll:", initialScroll);
  
  // Drag by exactly 100 pixels in X
  await page.mouse.move(canvasBox.x + 500, canvasBox.y + 500);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 500, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  
  const afterDrag1 = await page.evaluate(() => {
    const el = document.getElementById('canvas');
    return { left: el.scrollLeft, top: el.scrollTop };
  });
  console.log("After Drag 1:", afterDrag1);
  console.log("Did it move?", afterDrag1.left !== initialScroll.left ? "YES (PASS)" : "NO (FAIL)");

  // Drag a second time to ensure it doesn't snap back!
  console.log("=== TEST 2: Second Drag (Checking Snap Back) ===");
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 500);
  await page.mouse.down({ button: 'left' });
  const duringDrag2 = await page.evaluate(() => {
    const el = document.getElementById('canvas');
    return { left: el.scrollLeft, top: el.scrollTop };
  });
  console.log("Scroll immediately after mouse down:", duringDrag2);
  console.log("Did it snap back to initial?", Math.abs(duringDrag2.left - initialScroll.left) < 5 ? "YES (FAIL)" : "NO (PASS)");
  
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 500, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  
  const afterDrag2 = await page.evaluate(() => {
    const el = document.getElementById('canvas');
    return { left: el.scrollLeft, top: el.scrollTop };
  });
  console.log("After Drag 2:", afterDrag2);

  console.log("=== TEST 3: Center Button ===");
  await page.evaluate(() => document.getElementById('centerBottom').click());
  await new Promise(r => setTimeout(r, 400)); // wait for rAF smooth scroll
  const centerScroll = await page.evaluate(() => {
    const el = document.getElementById('canvas');
    return { left: el.scrollLeft, top: el.scrollTop };
  });
  console.log("Scroll after centering:", centerScroll);
  // It should roughly equal initialScroll since initialScroll centers the root node!
  console.log("Did it center?", Math.abs(centerScroll.left - initialScroll.left) < 5 ? "YES (PASS)" : "NO (FAIL)");
  
  console.log("=== TEST 4: Node Tools ===");
  await page.evaluate(() => {
    const node = document.querySelector('.node-card');
    node.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const contextClasses = await page.evaluate(() => document.getElementById('context').className);
  console.log("Context classes:", contextClasses);

  await browser.close();
})();
