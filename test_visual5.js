const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set a standard viewport size for testing
  await page.setViewport({ width: 1200, height: 800 });
  
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await page.waitForSelector('#canvas');
  
  // Wait for the initial centerRoot to finish
  await new Promise(r => setTimeout(r, 800));
  
  console.log("=== TEST 1: Initial Centering ===");
  const initialScroll = await page.evaluate(() => {
    const el = document.getElementById('canvas');
    return { left: el.scrollLeft, top: el.scrollTop };
  });
  console.log("Initial Scroll:", initialScroll);
  
  const nodeBox = await page.evaluate(() => {
    const node = document.querySelector('.node-card');
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  console.log("Node Bounding Box:", nodeBox);
  
  // Is the node centered in the 1200x800 viewport?
  const centerX = nodeBox.x + nodeBox.width / 2;
  const centerY = nodeBox.y + nodeBox.height / 2;
  console.log("Node Center on Screen:", { x: centerX, y: centerY });
  console.log("Expected Center:", { x: 1200 / 2, y: 800 / 2 });
  
  // Take screenshot
  await page.screenshot({ path: 'test_center.png' });
  
  console.log("=== TEST 2: Node Tools ===");
  // Click the node directly using mouse to see if it works natively
  await page.mouse.click(centerX, centerY);
  await new Promise(r => setTimeout(r, 400));
  
  const contextClasses = await page.evaluate(() => document.getElementById('context').className);
  console.log("Context classes:", contextClasses);
  
  const ctxBox = await page.evaluate(() => {
    const ctx = document.getElementById('context');
    const rect = ctx.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  console.log("Context Bounding Box:", ctxBox);
  
  await page.screenshot({ path: 'test_tools.png' });
  
  await browser.close();
})();
