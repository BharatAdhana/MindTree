const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  const fileUrl = `file://${path.resolve('index.html').replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  
  await page.waitForSelector('#canvas');
  
  console.log("=== TEST: JS Click Node ===");
  await page.evaluate(() => {
    const node = document.querySelector('.node-card');
    if(node) {
      console.log("Found node:", node.dataset.id);
      node.click(); // Natively trigger the click handler via JS
    }
  });
  
  await new Promise(r => setTimeout(r, 400));
  
  const contextClasses = await page.evaluate(() => document.getElementById('context').className);
  console.log("Context classes:", contextClasses);
  
  await browser.close();
})();
