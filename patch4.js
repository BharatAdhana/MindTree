const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix canvas background movement when dragging
html = html.replace(
  'document.getElementById("board").style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;',
  'document.getElementById("board").style.transform=`translate(${panX}px, ${panY}px) scale(${zoom})`;\n  document.getElementById("canvas").style.backgroundPosition=`${panX}px ${panY}px`;'
);

// 2. Hierarchical Radial Compaction Logic
const injection = `
let groupOriginalPositions = null;
let radialLayout = null;
let depths = {};
let maxDepth = 0;

function showGroupResizeTools() {
  const tool = document.getElementById("groupResizeTools");
  if (!tool) return;
  tool.style.display = "flex";
  document.getElementById("groupSelectedCount").textContent = selectedGroup.size + " selected";
  
  // Capture current layout as standard layout
  // Temporarily disable manualPositions for selected nodes to get their natural layout?
  // No, just use the current layout!
  groupOriginalPositions = layout();
  
  radialLayout = {};
  const weight = {};
  const m = {};
  state.nodes.forEach(n => m[n.id] = n);
  
  function calcWeight(id) {
    const n = m[id];
    if (!n || !n.children || n.children.length === 0) return weight[id] = 1;
    let w = 0;
    n.children.forEach(c => w += calcWeight(c));
    return weight[id] = Math.max(1, w);
  }
  state.roots.forEach(calcWeight);
  
  function placeRadial(id, px, py, startAngle, endAngle, depth) {
    radialLayout[id] = { x: px, y: py };
    const n = m[id];
    if (!n || !n.children || n.children.length === 0) return;
    
    const totalW = weight[id];
    let currentAngle = startAngle;
    const childRadius = 140 + depth * 30; // Radius expands with depth
    
    n.children.forEach(c => {
      const w = weight[c];
      const slice = (w / totalW) * (endAngle - startAngle);
      const midAngle = currentAngle + slice / 2;
      
      const cx = px + childRadius * Math.cos(midAngle);
      const cy = py + childRadius * Math.sin(midAngle);
      
      placeRadial(c, cx, cy, currentAngle, currentAngle + slice, depth + 1);
      currentAngle += slice;
    });
  }
  
  const totalRootsWeight = state.roots.reduce((sum, id) => sum + weight[id], 0);
  let currentAngle = 0;
  state.roots.forEach(id => {
    const w = weight[id];
    const slice = (w / totalRootsWeight) * Math.PI * 2;
    const rootRadius = state.roots.length > 1 ? 250 : 0;
    const midAngle = currentAngle + slice / 2;
    const cx = rootRadius * Math.cos(midAngle);
    const cy = rootRadius * Math.sin(midAngle);
    
    placeRadial(id, cx, cy, currentAngle, currentAngle + slice, 1);
    currentAngle += slice;
  });
  
  // Calculate depth
  depths = {};
  maxDepth = 0;
  function calcDepth(id, d) {
    depths[id] = d;
    if (d > maxDepth) maxDepth = d;
    const n = m[id];
    if (n && n.children) {
      n.children.forEach(c => calcDepth(c, d + 1));
    }
  }
  state.roots.forEach(id => calcDepth(id, 0));
  
  const slider = document.getElementById("groupCompactSlider");
  if(slider) slider.value = 1;
}

// Add the slider listener once below
`;

html = html.replace(
  /function showGroupResizeTools\(\) \{[\s\S]*?groupSelectedCount"\)\.textContent = selectedGroup\.size \+ " selected";\n\}/,
  injection
);

const sliderListener = `
document.getElementById("groupCompactSlider")?.addEventListener("input", e => {
  if (!groupOriginalPositions || !radialLayout) return;
  const val = parseFloat(e.target.value);
  state.manualPositions = state.manualPositions || {};
  
  const m = {};
  state.nodes.forEach(n => m[n.id] = n);
  
  const memo = {};
  function getInterpolatedPosition(id) {
    if (memo[id]) return memo[id];
    const d = depths[id] || 0;
    let node_t = 1.0;
    
    // Only apply shrinking/expanding interpolation if node is selected
    // If not selected, it acts like node_t = 1.0 and scale = 1.0
    let isSelected = selectedGroup.has(id);
    if (isSelected) {
      if (val <= 1) {
        if (maxDepth > 0) {
          if (val <= (d - 1) / maxDepth) node_t = 0.0;
          else if (val >= d / maxDepth) node_t = 1.0;
          else node_t = (val - (d - 1) / maxDepth) * maxDepth;
        } else {
          node_t = val;
        }
      }
    }
    
    const n = m[id];
    const parentId = n ? n.parent : null;
    let px = 0, py = 0;
    if (parentId) {
      const pPos = getInterpolatedPosition(parentId);
      px = pPos.x;
      py = pPos.y;
    }
    
    const opX = parentId && groupOriginalPositions[parentId] ? groupOriginalPositions[parentId].x : 0;
    const opY = parentId && groupOriginalPositions[parentId] ? groupOriginalPositions[parentId].y : 0;
    const origPos = groupOriginalPositions[id] || {x:0, y:0};
    const origRelX = origPos.x - opX;
    const origRelY = origPos.y - opY;
    
    const rpX = parentId && radialLayout[parentId] ? radialLayout[parentId].x : 0;
    const rpY = parentId && radialLayout[parentId] ? radialLayout[parentId].y : 0;
    const radPos = radialLayout[id] || {x:0, y:0};
    const radRelX = radPos.x - rpX;
    const radRelY = radPos.y - rpY;
    
    let relX = radRelX + (origRelX - radRelX) * node_t;
    let relY = radRelY + (origRelY - radRelY) * node_t;
    
    if (val > 1 && isSelected) {
       relX *= val;
       relY *= val;
    }
    
    const res = { x: px + relX, y: py + relY };
    memo[id] = res;
    return res;
  }
  
  state.nodes.forEach(n => {
    state.manualPositions[n.id] = getInterpolatedPosition(n.id);
  });
  
  persist({ skipHistory: true });
  render();
});
`;

// Insert the listener before the closing script tag
html = html.replace('</script>\n</body>', sliderListener + '\n</script>\n</body>');

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html with phase 3.2 fixes.");
