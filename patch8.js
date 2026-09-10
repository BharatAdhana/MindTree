const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Add overscroll-behavior: none to body to prevent native touchpad back/forward gestures robustly
if (!html.includes('overscroll-behavior:none')) {
  html = html.replace('body{', 'body{overscroll-behavior:none;');
}

// 2. Add e.preventDefault() to canvas pointerdown to prevent browser from hijacking the pointer stream and firing pointercancel
html = html.replace(
  'canvasEl.addEventListener("pointerdown", e => {',
  `canvasEl.addEventListener("pointerdown", e => {
  // Prevent browser gestures from hijacking the pointer stream
  if (e.target === canvasEl || e.target.closest("svg")) e.preventDefault();`
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html missing preventDefault and overscroll behavior.");
