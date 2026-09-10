const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix the #context toolbar crash by using node(selected) instead of state.nodes[selected] (which is an array, not a map)
html = html.replace(
  /document\.getElementById\("ctxLineLength"\)\.value = state\.nodes\[selected\]\?\.childLineLength/g,
  'document.getElementById("ctxLineLength").value = node(selected)?.childLineLength'
);
html = html.replace(
  /if\(selected && state\.nodes\[selected\]\)\{\s*state\.nodes\[selected\]\.childLineLength = parseInt\(e\.target\.value\);/g,
  'const n = node(selected); if(n){ n.childLineLength = parseInt(e.target.value);'
);

// 2. Allow right-click (e.button === 2) to drag the canvas
html = html.replace(
  'if ((e.button !== 0 && e.button !== 1) || e.target.closest',
  'if ((e.button !== 0 && e.button !== 1 && e.button !== 2) || e.target.closest'
);

// 3. Prevent the native context menu from opening when right-clicking the canvas background so dragging works uninterrupted
const contextMenuPrevent = `
canvasEl.addEventListener("contextmenu", e => {
  if (e.target === canvasEl || e.target.closest("svg")) e.preventDefault();
});
`;
if (!html.includes('canvasEl.addEventListener("contextmenu"')) {
  html = html.replace('canvasEl.addEventListener("pointerdown"', contextMenuPrevent + '\ncanvasEl.addEventListener("pointerdown"');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html for contextual toolbar and right-click dragging.");
