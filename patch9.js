const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Revert canvas overflow to auto to restore native scrollbars
html = html.replace('overflow:hidden;touch-action:none;background-color:#fbfbfc;', 'overflow:auto;touch-action:none;background-color:#fbfbfc;');

// Fix setZoom to use CSS zoom (scales layout natively so scrollbars work) instead of transform translate
html = html.replace(
  /document\.getElementById\("board"\)\.style\.transform=`translate\(\$\{panX\}px, \$\{panY\}px\) scale\(\$\{zoom\}\)`;/g,
  'document.getElementById("board").style.transform=""; document.getElementById("board").style.zoom=zoom;'
);
html = html.replace(
  /document\.getElementById\("canvas"\)\.style\.backgroundPosition=`\$\{panX\}px \$\{panY\}px`;/g,
  '// background position handled by native scrolling'
);

// Update dragging logic to use native scrollLeft/scrollTop instead of panX/panY
html = html.replace(/scrollX = panX;\s*scrollY = panY;/g, 'scrollX = canvasEl.scrollLeft; scrollY = canvasEl.scrollTop;');

html = html.replace(
  /panX = scrollX \+ \(e\.clientX - dragX\) \/ zoom;\s*panY = scrollY \+ \(e\.clientY - dragY\) \/ zoom;\s*setZoom\(zoom\);/g,
  'canvasEl.scrollLeft = scrollX - (e.clientX - dragX); canvasEl.scrollTop = scrollY - (e.clientY - dragY);'
);

// Update wheel event for native scrolling (mostly not needed if overflow: auto, but good for trackpad panning without shift)
html = html.replace(
  /panX -= e\.deltaX \/ zoom;\s*panY -= e\.deltaY \/ zoom;\s*setZoom\(zoom\);/g,
  'canvasEl.scrollLeft += e.deltaX; canvasEl.scrollTop += e.deltaY;'
);

// Update ctx toolbar positioning to use native scroll offset
html = html.replace(
  /const screenX = board\.offsetLeft \+ panX \+ p\.x \* zoom;\s*const screenY = board\.offsetTop \+ panY \+ p\.y \* zoom;/g,
  'const screenX = (board.offsetLeft + p.x) * zoom - canvasEl.scrollLeft; const screenY = (board.offsetTop + p.y) * zoom - canvasEl.scrollTop;'
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html for native scrollbars.");
