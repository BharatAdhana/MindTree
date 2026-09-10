const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. CSS
html = html.replace(/\.canvas\{[^\}]+\}/, '.canvas{position:absolute;inset:0;overflow:auto;overscroll-behavior:none;cursor:grab;touch-action:none;background-color:#fbfbfc;background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:22px 22px;background-position:0 0}');
html = html.replace(/\.board\{[^\}]+\}/, '.board{position:absolute;left:0;top:0;width:50000px;height:50000px;transform-origin:0 0;will-change:transform}');

// 2. Remove panX, panY variables
html = html.replace(/let panX = 0, panY = 0, /, 'let ');

// 3. Update layout() starts
html = html.replace(/const horizontalStart=Math\.max\(300,document\.getElementById\("canvas"\)\.clientWidth\/\(2\*zoom\)\);/, 'const horizontalStart=25000;');
html = html.replace(/visibleRoots\.forEach\(id=>subtree\(id, direction==="lr" \? horizontalStart : 300\)\);/, 'visibleRoots.forEach(id=>subtree(id, direction==="lr" ? horizontalStart : 25000));');
// Fix verticalOffset in layout()
html = html.replace(/let nextXPx=300; let nextYPx=300;/, 'let nextXPx=25000; let nextYPx=25000;');
html = html.replace(/let verticalOffset=direction==="lr"\?nextYPx:300;/, 'let verticalOffset=25000;');

// 4. Update setZoom
html = html.replace(/function setZoom\(z\)\{[^\}]+updateBoardTransform\(\);?\s*\}/, 
`function setZoom(z){
  const canvas = document.getElementById("canvas");
  const oldZoom = zoom;
  zoom = Math.max(0.1, Math.min(z, 4));
  document.getElementById("zoomLevel").textContent = Math.round(zoom*100)+"%";
  
  const cx = canvas.scrollLeft + canvas.clientWidth/2;
  const cy = canvas.scrollTop + canvas.clientHeight/2;
  const ratio = zoom / (oldZoom || 1);
  
  document.getElementById("board").style.zoom = zoom; // use CSS zoom to correctly scale scrollbars!
  canvas.scrollLeft = cx * ratio - canvas.clientWidth/2;
  canvas.scrollTop = cy * ratio - canvas.clientHeight/2;
}`);

// 5. Remove updateBoardTransform references
html = html.replace(/updateBoardTransform\(\);/g, '');

// 6. Fix focusNode
html = html.replace(/function focusNode\(id\)\{[^\}]+?\}/,
`function focusNode(id){
  const positions=layout();
  const p=positions[id];
  if(!p)return;
  const canvas=document.getElementById("canvas");
  canvas.scrollTo({ left: p.x * zoom - canvas.clientWidth/2, top: p.y * zoom - canvas.clientHeight/2, behavior: "smooth" });
  if (contextVisible) showContext();
}`);

// 7. Fix positionContext (showContext inner logic)
html = html.replace(/const screenX = panX \+ p\.x \* z;\s*const screenY = panY \+ p\.y \* z;/,
`const canvasEl = document.getElementById("canvas");
    const screenX = p.x * z - canvasEl.scrollLeft;
    const screenY = p.y * z - canvasEl.scrollTop;`);

// 8. Fix pointerdown scrollX / scrollY
html = html.replace(/scrollX = panX; scrollY = panY;/g, 'scrollX = canvasEl.scrollLeft; scrollY = canvasEl.scrollTop;');

// 9. Fix pointermove dragging
const moveBody = `if (!dragging) return;
  if (Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY) > 4) canvasMoved = true;
  canvasEl.scrollLeft = scrollX - (e.clientX - dragX);
  canvasEl.scrollTop = scrollY - (e.clientY - dragY);
  if (contextVisible) showContext();`;
html = html.replace(/if \(!dragging\) return;\s+if \(Math\.abs[^\}]+showContext\(\);\s*\}/, moveBody + "\n}");

// 10. Fix wheel pan (we don't need manual pan anymore because overflow: auto handles it, BUT we need to prevent default zoom? Actually, wheel for trackpad works natively!)
// Let's just remove the deltaX/Y manual panning from the wheel event so we don't double-pan!
html = html.replace(/panX -= e\.deltaX;\s*panY -= e\.deltaY;/g, '');

fs.writeFileSync('index.html', html, 'utf8');
console.log("Restored native scrollbars successfully.");
