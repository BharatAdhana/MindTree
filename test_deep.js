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
    const canvas = document.getElementById('canvas');
    const nodeWrap = root.closest('.node');
    const pos = layout()[selected];
    
    const toRect = (r) => ({ x: r.x, y: r.y, width: r.width, height: r.height, left: r.left, top: r.top });
    return {
      canvasRect: toRect(canvas.getBoundingClientRect()),
      branchOffsets: state.branchOffsets,
      stateRoots: state.roots,
      boardRect: toRect(board.getBoundingClientRect()),
      nodeWrapRect: toRect(nodeWrap.getBoundingClientRect()),
      nodeCardRect: toRect(root.getBoundingClientRect()),
      scroll: { left: canvas.scrollLeft, top: canvas.scrollTop },
      layoutPos: pos,
      zoomVal: zoom,
      boardZoomStyle: board.style.zoom,
      boardTransform: board.style.transform
    };
  });
  console.log("Deep Metrics:", JSON.stringify(metrics, null, 2));
  
  await browser.close();
})();
