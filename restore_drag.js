const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Restore the original CSS
html = html.replace(/\.canvas\{position:absolute;cursor:grab;inset:0;overflow:auto;[^\}]+?\}/, '.canvas{position:absolute;cursor:grab;inset:0;overflow:hidden;touch-action:none;background-color:#fbfbfc;background-image:radial-gradient(var(--grid) 1px,transparent 1px);background-size:22px 22px;background-position:0 0}');
html = html.replace(/\.board\{position:relative;min-width:1700px;min-height:1000px;margin:35px 45px 120px;transform-origin:0 0;will-change:transform\}/, '.board{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}');
// Clean up the malformed lines from previous replace attempt
html = html.replace(/\.canvas\{position:absolute;inset:0;overflow:hidden;cursor:grab;touch-action:none;\}\n\.canvas\.dragging\{cursor:grabbing;\}\n\.board\{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;\}/, '');

// 2. Restore setZoom
html = html.replace(
  /function setZoom\(z\)\{zoom=Math\.max\(0\.1,Math\.min\(z,4\)\);document\.getElementById\("zoomLevel"\)\.textContent=Math\.round\(zoom\*100\)\+"%";document\.getElementById\("board"\)\.style\.zoom=zoom;\}/g,
  'function setZoom(z){zoom=Math.max(0.1,Math.min(z,4));document.getElementById("zoomLevel").textContent=Math.round(zoom*100)+"%";document.getElementById("board").style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;document.getElementById("canvas").style.backgroundPosition=`${panX}px ${panY}px`;document.getElementById("canvas").style.backgroundSize=`${22*zoom}px ${22*zoom}px`;}'
);

// 3. Restore updateBoardTransform (if not exists, we just let setZoom do it)
if(!html.includes('function updateBoardTransform()')) {
  html = html.replace('function setZoom', 'function updateBoardTransform(){document.getElementById("board").style.transform=`translate(${panX}px,${panY}px) scale(${zoom})`;document.getElementById("canvas").style.backgroundPosition=`${panX}px ${panY}px`;} function setZoom');
}

// 4. Restore dragging in pointermove
const moveRe = /if \(!dragging\) return;\s*canvasMoved = true;\s*canvasEl\.scrollLeft = scrollX - \(e\.clientX - dragX\) \/ zoom;\s*canvasEl\.scrollTop = scrollY - \(e\.clientY - dragY\) \/ zoom;/;
html = html.replace(moveRe, 'if (!dragging) return;\n  canvasMoved = true;\n  panX = scrollX + (e.clientX - dragX);\n  panY = scrollY + (e.clientY - dragY);\n  updateBoardTransform();\n  if (contextVisible) showContext();');

// 5. Restore pointerdown logic to save scrollX / scrollY as panX / panY
html = html.replace(/scrollX = canvasEl\.scrollLeft; scrollY = canvasEl\.scrollTop;/g, 'scrollX = panX; scrollY = panY;');

// 6. Restore centerOn / focusNode logic to use panX / panY
html = html.replace(
  /canvas\.scrollTo\(\{left:x,top:y,behavior:"smooth"\}\);/g,
  'panX = -x * zoom + canvas.clientWidth/2; panY = -y * zoom + canvas.clientHeight/2; updateBoardTransform();'
);

// 7. Fix positionContext bulletproof fallback to use panX/panY!
html = html.replace(
  /const cLeft = canvasEl \? \(canvasEl\.scrollLeft \|\| 0\) : 0;\s*const cTop = canvasEl \? \(canvasEl\.scrollTop \|\| 0\) : 0;\s*const bLeft = board \? \(board\.offsetLeft \|\| 0\) : 0;\s*const bTop = board \? \(board\.offsetTop \|\| 0\) : 0;\s*const screenX = \(bLeft \+ p\.x\) \* z - cLeft;\s*const screenY = \(bTop \+ p\.y\) \* z - cTop;/g,
  'const screenX = panX + p.x * z;\n    const screenY = panY + p.y * z;'
);

// 8. Fix board bounds calculation to NOT break the UI, since we don't need min-width/min-height with unbounded panX/panY!
html = html.replace(/function setBoardBounds\(w,h\)\{[^\}]+?\}/, 'function setBoardBounds(w,h){}');

fs.writeFileSync('index.html', html, 'utf8');
console.log("Restored original drag logic with panX/panY.");
