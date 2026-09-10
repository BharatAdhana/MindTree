const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:4173/');
  
  // Wait for the app to initialize
  await new Promise(r => setTimeout(r, 1000));
  
  // Select the root node by finding the text "apps" and clicking its parent group
  await page.evaluate(() => {
    // expose selectNode for testing
    // wait, we can't expose it easily. let's just click the node visually
    const textNodes = Array.from(document.querySelectorAll('text'));
    const rootText = textNodes.find(t => t.textContent === 'apps');
    if (rootText) {
      const hitElement = rootText.parentElement.querySelector('.hit-area');
      if (hitElement) {
        hitElement.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      }
    }
  });
  
  await new Promise(r => setTimeout(r, 100));
  
  // Click the create relationship button
  await page.evaluate(() => {
    document.getElementById('createRelationshipBtn').click();
  });
  
  await new Promise(r => setTimeout(r, 100));
  
  // Check if dialog has class "show"
  const isVisible = await page.evaluate(() => {
    return document.getElementById('relationshipDialog').classList.contains('show');
  });
  
  console.log('relationshipDialog is visible:', isVisible);
  
  await browser.close();
})();
