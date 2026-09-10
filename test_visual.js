const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Log all browser console messages and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));
  
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  console.log('Navigating to', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  // Wait for the canvas to be ready
  await page.waitForSelector('#canvas');
  
  console.log("=== TEST 1: Left-click Canvas Drag ===");
  // Test native dragging
  const canvas = await page.$('#canvas');
  const canvasBox = await canvas.boundingBox();
  
  const initialScrollLeft = await page.evaluate(() => document.getElementById('canvas').scrollLeft);
  console.log("Initial scrollLeft:", initialScrollLeft);
  
  await page.mouse.move(canvasBox.x + 500, canvasBox.y + 500);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 500, { steps: 10 });
  await page.mouse.up({ button: 'left' });
  
  const finalScrollLeft = await page.evaluate(() => document.getElementById('canvas').scrollLeft);
  console.log("Final scrollLeft after left-click drag:", finalScrollLeft);
  console.log("Drag worked?", finalScrollLeft !== initialScrollLeft ? "YES" : "NO");

  console.log("=== TEST 2: Single Click Node Tools ===");
  const node = await page.$('.node-card');
  if (node) {
    const nodeBox = await node.boundingBox();
    console.log("Clicking node at", nodeBox.x, nodeBox.y);
    await page.mouse.click(nodeBox.x + 10, nodeBox.y + 10);
    
    // Wait for the 280ms timeout in card.onclick
    await new Promise(r => setTimeout(r, 400));
    
    const contextClasses = await page.evaluate(() => document.getElementById('context').className);
    console.log("Context classes:", contextClasses);
    console.log("Toolbar shown?", contextClasses.includes('show') ? "YES" : "NO");
    
    const isVisible = await page.evaluate(() => {
      const el = document.getElementById('context');
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    console.log("Toolbar visible in CSS?", isVisible ? "YES" : "NO");
    
    const contextPos = await page.evaluate(() => {
      const el = document.getElementById('context');
      return { left: el.style.left, top: el.style.top, zIndex: el.style.zIndex };
    });
    console.log("Toolbar positioned at:", contextPos);
    
    // Take a screenshot of the context menu
    await page.screenshot({ path: 'test_node_click.png' });
    console.log("Saved screenshot to test_node_click.png");
  } else {
    console.log("No node found!");
  }
  
  await browser.close();
})();
