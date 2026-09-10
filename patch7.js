const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Revert window pointer listeners back to canvasEl pointer listeners to fix browser compatibility with pointer capture
html = html.replace('window.addEventListener("pointermove", e => {', 'canvasEl.addEventListener("pointermove", e => {');
html = html.replace('window.addEventListener("pointerup", e => {', 'canvasEl.addEventListener("pointerup", e => {');
html = html.replace('window.addEventListener("pointercancel", () => {', 'canvasEl.addEventListener("pointercancel", () => {');

// Fix pointer capture target to canvasEl instead of e.target to prevent SVG pointercancel bugs
html = html.replace(/try \{ e\.target\.setPointerCapture\(e\.pointerId\); \} catch\(err\)\{\}/g, 'try { canvasEl.setPointerCapture(e.pointerId); } catch(err){}');
html = html.replace(/try \{ e\.target\.releasePointerCapture\(e\.pointerId\); \} catch\(err\)\{\}/g, 'try { canvasEl.releasePointerCapture(e.pointerId); } catch(err){}');

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html back to canvasEl listeners.");
