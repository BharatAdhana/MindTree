const fs = require('fs');

let stateJs = fs.readFileSync('mindtree-state.js', 'utf8');
// Fix Markdown headings import: remove # from the ignore regex
stateJs = stateJs.replace(
  '/^\\s*(?:#|```|>|Comments Index|Project Mind Graph)/i',
  '/^\\s*(?:```|>|Comments Index|Project Mind Graph)/i'
);
// Insert logic to parse markdown headings
stateJs = stateJs.replace(
  'const markdown = raw.match(/^(\\s*)(?:[-*+]\\s+|\\d+[.)]\\s+)(.+)$/);',
  `const heading = raw.match(/^(\\s*)(#+)\\s+(.+)$/);
        if (heading) { depth = heading[2].length - 1; name = heading[3]; }
        else { const markdown = raw.match(/^(\\s*)(?:[-*+]\\s+|\\d+[.)]\\s+)(.+)$/);`
);
stateJs = stateJs.replace(
  'if (markdown) { depth = Math.floor(markdown[1].replace(/\\t/g, "    ").length / 2); name = markdown[2]; }\n          else { const leading = (raw.match(/^\\s*/) || [""])[0].replace(/\\t/g, "    "); depth = Math.floor(leading.length / 2); name = raw.trim(); }',
  `if (markdown) { depth = Math.floor(markdown[1].replace(/\\t/g, "    ").length / 2); name = markdown[2]; }
          else { const leading = (raw.match(/^\\s*/) || [""])[0].replace(/\\t/g, "    "); depth = Math.floor(leading.length / 2); name = raw.trim(); } }`
);
fs.writeFileSync('mindtree-state.js', stateJs, 'utf8');


let html = fs.readFileSync('index.html', 'utf8');

// 1. Move #context outside #board
const contextRegex = /<div id="context" class="context">[\s\S]*?<\/div>\s*<\/div>\s*(<div id="groupResizeTools")/m;
const match = html.match(contextRegex);
if (match) {
  const contextHtml = html.match(/<div id="context" class="context">[\s\S]*?<\/div>/m)[0];
  html = html.replace(contextHtml, '');
  // Insert contextHtml after </div><!-- end board -->
  html = html.replace('</div>\n<div id="groupResizeTools"', `</div>\n${contextHtml}\n<div id="groupResizeTools"`);
}

// 2. Add Compact button to groupResizeTools
html = html.replace(
  '<span style="margin-left:8px;">W:</span>',
  '<button id="groupCompactBtn" class="action" style="margin-left:8px;" title="Reduce layout spacing for this group">Compact</button>\n    <span style="margin-left:8px;">W:</span>'
);

// 3. Fix Shift-click selection CSS class
html = html.replace(
  'selected===id?" selected":""',
  'selected===id || selectedGroup.has(id) ? " selected" : ""'
);

// 4. Remove Marquee selection and fix panning
html = html.replace(
  `svg.onpointerdown=e=>{
  if(e.button===0&&!e.shiftKey){
    marquee={startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:true};
    return;
  }
  if(e.button===1||e.button===2||(e.button===0&&e.shiftKey)){
    e.preventDefault();
    isDragging=true;
    startX=e.clientX-panX;
    startY=e.clientY-panY;
    svg.setPointerCapture(e.pointerId);
  }
};`,
  `svg.onpointerdown=e=>{
  if(e.button===0||e.button===1||e.button===2){
    e.preventDefault();
    if (e.shiftKey && e.button===0) return; // allow shift clicking canvas? No, do nothing for now
    isDragging=true;
    startX=e.clientX-panX;
    startY=e.clientY-panY;
    svg.setPointerCapture(e.pointerId);
  }
};`
);
// Remove marquee rendering logic
html = html.replace(
  `  if(marquee&&marquee.active){
    const mx=Math.min(marquee.startX,marquee.x), my=Math.min(marquee.startY,marquee.y);
    const mw=Math.abs(marquee.x-marquee.startX), mh=Math.abs(marquee.y-marquee.startY);
    const mEl = document.createElementNS("http://www.w3.org/2000/svg","rect");
    mEl.setAttribute("x",mx); mEl.setAttribute("y",my); mEl.setAttribute("width",mw); mEl.setAttribute("height",mh);
    mEl.setAttribute("fill","rgba(99,102,241,0.1)"); mEl.setAttribute("stroke","#6366f1"); mEl.setAttribute("stroke-dasharray","4 4");
    svg.appendChild(mEl);
  }`,
  `// marquee removed`
);

// 5. Fix Toolbar Zoom position calculation
html = html.replace(
  `  const p=positions[selected];
  ctx.style.left=Math.max(8,p.x-175)+"px";
  ctx.style.top=Math.max(8,p.y-76)+"px";`,
  `  const p=positions[selected];
  const screenX = p.x * zoom + panX;
  const screenY = p.y * zoom + panY;
  ctx.style.left = Math.max(8, screenX - 175) + "px";
  ctx.style.top = Math.max(8, screenY - 76) + "px";`
);

// 6. Bind Group Compact Event
const groupCompactCode = `
document.getElementById("groupCompactBtn")?.addEventListener("click", () => {
  saveState();
  const currentPositions = layout();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selectedGroup.forEach(id => {
    if(currentPositions[id]) {
      minX = Math.min(minX, currentPositions[id].x);
      minY = Math.min(minY, currentPositions[id].y);
      maxX = Math.max(maxX, currentPositions[id].x);
      maxY = Math.max(maxY, currentPositions[id].y);
    }
  });
  if (minX === Infinity) return;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  state.manualPositions = state.manualPositions || {};
  selectedGroup.forEach(id => {
    if(currentPositions[id]) {
      const p = currentPositions[id];
      const newX = cx + (p.x - cx) * 0.8;
      const newY = cy + (p.y - cy) * 0.8;
      state.manualPositions[id] = { x: newX, y: newY };
    }
  });
  persist();
  render();
});
`;
html = html.replace('document.getElementById("groupWidthMinus").onclick', groupCompactCode + '\ndocument.getElementById("groupWidthMinus").onclick');


// 7. Make normal click an EXCLUSIVE select, as specified by the prompt:
// "Clicking a node normally selects ONLY that node. Holding SHIFT while clicking another node adds it to the current selection."
// Wait, currently `selectNode(id)` does exclusive select. 
// BUT `selectNode(id)` is wrapped in a `setTimeout` for double-click detection.
// "Do not make the user drag an empty canvas to select nodes"
// In card.onclick:
/*
card.onclick=e=>{
  e.stopPropagation();
  if(suppressNodeClickId===id){suppressNodeClickId=null;return}
  clearTimeout(nodeClickTimer);
  
  if (e.shiftKey) {
    if (selectedGroup.has(id)) selectedGroup.delete(id);
    else selectedGroup.add(id);
    selected = Array.from(selectedGroup).pop() || null;
    render();
    if(selectedGroup.size > 1) showGroupResizeTools();
    else hideGroupResizeTools();
    return;
  }
  
  nodeClickTimer=setTimeout(()=>selectNode(id),280);
};
*/
// It works perfectly because `selectNode(id)` does `selectedGroup.clear(); selectedGroup.add(id);`.

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched!");
