const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Rewrite positionContext to be absolutely bulletproof with try/catch and fallback positioning
const oldPositionContext = html.substring(html.indexOf('function positionContext'), html.indexOf('function showContext'));
const newPositionContext = `function positionContext(positions){
  try {
    const ctx=document.getElementById("context");
    if(activeConnection||!contextVisible||!selected||!positions[selected]){ctx.classList.remove("show");return;}
    const p=positions[selected];
    const board = document.getElementById("board");
    const z = typeof zoom === 'number' ? zoom : 1;
    const cLeft = canvasEl ? (canvasEl.scrollLeft || 0) : 0;
    const cTop = canvasEl ? (canvasEl.scrollTop || 0) : 0;
    const bLeft = board ? (board.offsetLeft || 0) : 0;
    const bTop = board ? (board.offsetTop || 0) : 0;
    
    const screenX = (bLeft + p.x) * z - cLeft; 
    const screenY = (bTop + p.y) * z - cTop;
    
    ctx.style.left = Math.max(8, screenX - 175) + "px";
    ctx.style.top = Math.max(8, screenY - 76) + "px";
    
    const colorDot = document.getElementById("ctxColorDot");
    if(colorDot) colorDot.style.background = state.colors?.[selected] || defaultColor(node(selected) || {id: 'fallback'});
    
    const lineLen = document.getElementById("ctxLineLength");
    if(lineLen) lineLen.value = node(selected)?.childLineLength || (40 + 100 * (state.view?.density || 1.0));
    
    ctx.classList.add("show");
  } catch (e) {
    console.error("Crash in positionContext:", e);
    const ctx=document.getElementById("context");
    if(ctx) { ctx.style.left = "50%"; ctx.style.top = "50%"; ctx.classList.add("show"); }
  }
}
`;
html = html.replace(oldPositionContext, newPositionContext);

// 2. Fix the layout function references to use node(id) instead of state.nodes[id] (since state.nodes is an array)
html = html.replace(/state\.nodes\[id\]\?\.childLineLength/g, 'node(id)?.childLineLength');

fs.writeFileSync('index.html', html, 'utf8');
console.log("Applied bulletproof positionContext and layout patch.");
