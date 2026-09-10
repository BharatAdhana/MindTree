const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:4173/');
  
  await new Promise(r => setTimeout(r, 1000));
  
  // Try to click a child-indicator
  await page.evaluate(() => {
    const indicator = document.querySelector('.child-indicator');
    if (indicator) {
      indicator.click();
    } else {
      console.log('No child indicator found');
    }
  });
  
  await new Promise(r => setTimeout(r, 500));
  
  await browser.close();
})();
