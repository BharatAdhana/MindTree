const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const wheelListener = `
canvasEl.addEventListener("wheel", e => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    changeZoom(e.deltaY > 0 ? -0.1 : 0.1);
    return;
  }
  // Pan the canvas using the scroll wheel or trackpad
  panX -= e.deltaX / zoom;
  panY -= e.deltaY / zoom;
  setZoom(zoom);
}, { passive: false });
`;

html = html.replace(
  'canvasEl.addEventListener("pointerdown"',
  wheelListener + '\ncanvasEl.addEventListener("pointerdown"'
);

// Allow middle-click (e.button === 1) to pan the canvas
html = html.replace(
  'if (e.button !== 0 || e.target.closest',
  'if ((e.button !== 0 && e.button !== 1) || e.target.closest'
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html wheel dragging logic.");
