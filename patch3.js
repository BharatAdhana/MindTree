const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix panX and panY definition and pointer handling for canvas dragging
if (!html.includes('let panX = 0, panY = 0;')) {
  html = html.replace(
    'let dragging=false, canvasMoved=false, dragX=0, dragY=0, scrollX=0, scrollY=0,',
    'let panX = 0, panY = 0, dragging=false, canvasMoved=false, dragX=0, dragY=0, scrollX=0, scrollY=0,'
  );
}

// 2. Change canvas overflow to hidden
html = html.replace(
  '.canvas{position:absolute;cursor:grab;inset:0;overflow:auto;',
  '.canvas{position:absolute;cursor:grab;inset:0;overflow:hidden;touch-action:none;'
);

// 3. Update setZoom to apply panX and panY
html = html.replace(
  'document.getElementById("board").style.transform=`scale(${zoom})`;',
  'document.getElementById("board").style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;'
);

// 4. Update positionContext to include panX and panY
html = html.replace(
  `  const screenX = board.offsetLeft + p.x * zoom;
  const screenY = board.offsetTop + p.y * zoom;`,
  `  const screenX = board.offsetLeft + panX + p.x * zoom;
  const screenY = board.offsetTop + panY + p.y * zoom;`
);
// In case my previous fix used `panX` already (it didn't apply), let's ensure it handles standard:
if (!html.includes('const screenX = board.offsetLeft + panX')) {
  html = html.replace(
    /const screenX = board\.offsetLeft \+ p\.x \* zoom;/g,
    'const screenX = board.offsetLeft + panX + p.x * zoom;'
  );
  html = html.replace(
    /const screenY = board\.offsetTop \+ p\.y \* zoom;/g,
    'const screenY = board.offsetTop + panY + p.y * zoom;'
  );
}

// 5. Update canvasEl pointerdown
html = html.replace(
  'dragging=true; canvasMoved=false; dragX=e.clientX; dragY=e.clientY; scrollX=canvasEl.scrollLeft; scrollY=canvasEl.scrollTop; canvasEl.setPointerCapture(e.pointerId); canvasEl.classList.add("dragging");',
  'dragging=true; canvasMoved=false; dragX=e.clientX; dragY=e.clientY; scrollX=panX; scrollY=panY; canvasEl.setPointerCapture(e.pointerId); canvasEl.classList.add("dragging");'
);

// 6. Update canvasEl pointermove
html = html.replace(
  `  canvasEl.scrollLeft=scrollX-(e.clientX-dragX);
  canvasEl.scrollTop=scrollY-(e.clientY-dragY);`,
  `  panX=scrollX+(e.clientX-dragX);
  panY=scrollY+(e.clientY-dragY);
  setZoom(zoom);`
);

// 7. Update createProject to open the project rail on import
html = html.replace(
  'function importStructureText(text){\n  const tree=parseStructureText(text);\n  if(!tree)return toast("Could not detect a project structure in that text");\n  replaceWithImportedTree(tree);\n}',
  'function importStructureText(text){\n  const tree=parseStructureText(text);\n  if(!tree)return toast("Could not detect a project structure in that text");\n  replaceWithImportedTree(tree);\n  document.getElementById("projectRail").classList.add("open");\n}'
);

// 8. Add Ctrl+A handling to document.addEventListener("keydown"
const ctrlA = `
  if (e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey) && !inTextField) {
    e.preventDefault();
    selectedGroup.clear();
    state.nodes.forEach(n => selectedGroup.add(n.id));
    selected = state.nodes[0]?.id || null;
    render();
    if(selectedGroup.size > 1) showGroupResizeTools();
    else hideGroupResizeTools();
    return;
  }
`;
html = html.replace(
  'document.addEventListener("keydown",e=>{\n  const isInput',
  `document.addEventListener("keydown",e=>{\n  const isInput` + ctrlA
);

// 9. Update group-resize-tools CSS for right-side vertical layout
html = html.replace(
  '.group-resize-tools{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:12px;padding:8px 16px;background:rgba(255,255,255,0.95);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);backdrop-filter:blur(10px);font-size:12px;color:var(--text);}',
  '.group-resize-tools{position:fixed;bottom:auto;top:50%;right:20px;left:auto;transform:translateY(-50%);z-index:100;display:flex;flex-direction:column;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.95);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);backdrop-filter:blur(10px);font-size:12px;color:var(--text);}'
);

// 10. Replace Compact button with Slider in HTML
html = html.replace(
  '<button id="groupCompactBtn" class="action" style="margin-left:8px;" title="Reduce layout spacing for this group">Compact</button>',
  '<label for="groupCompactSlider" style="font-size:10px;text-transform:uppercase;font-weight:bold;color:#888;">Spacing</label>\n<input type="range" id="groupCompactSlider" min="0" max="2" step="0.05" value="1" title="Compact/Expand selection" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width:8px; height:100px;">'
);

// 11. Add showGroupResizeTools global tracking and slider event
const sliderLogic = `
let groupOriginalPositions = null;
let groupCentroid = null;
const origShowGroup = showGroupResizeTools;
showGroupResizeTools = function() {
  origShowGroup();
  const currentPositions = layout();
  groupOriginalPositions = {};
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selectedGroup.forEach(id => {
    if(currentPositions[id]) {
      groupOriginalPositions[id] = { ...currentPositions[id] };
      minX = Math.min(minX, currentPositions[id].x);
      minY = Math.min(minY, currentPositions[id].y);
      maxX = Math.max(maxX, currentPositions[id].x);
      maxY = Math.max(maxY, currentPositions[id].y);
    }
  });
  if (minX !== Infinity) groupCentroid = { x: (minX + maxX)/2, y: (minY + maxY)/2 };
  const slider = document.getElementById("groupCompactSlider");
  if(slider) slider.value = 1;
};

document.getElementById("groupCompactSlider")?.addEventListener("input", e => {
  if (!groupOriginalPositions || !groupCentroid) return;
  const scale = parseFloat(e.target.value);
  state.manualPositions = state.manualPositions || {};
  selectedGroup.forEach(id => {
    if (groupOriginalPositions[id]) {
      const p = groupOriginalPositions[id];
      const newX = groupCentroid.x + (p.x - groupCentroid.x) * scale;
      const newY = groupCentroid.y + (p.y - groupCentroid.y) * scale;
      state.manualPositions[id] = { x: newX, y: newY };
    }
  });
  persist();
  render();
});
`;

html = html.replace(
  /document\.getElementById\("groupCompactBtn"\)\?.addEventListener\("click", \(\) => \{[\s\S]*?render\(\);\n\}\);/,
  sliderLogic
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html with phase 3.1 fixes.");
