const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Add the slider to the contextual toolbar
const sliderHtml = `
<div class="ctx" title="Adjust line length to children" style="padding: 0 4px; display: flex; align-items: center; gap: 4px; cursor: default;">
  <svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px; height:14px;"><path d="M4 12h16m-4-4 4 4-4 4"/></svg>
  <input type="range" id="ctxLineLength" min="20" max="400" value="140" style="width: 50px; cursor: pointer;">
</div>
`;
html = html.replace('<button class="ctx" id="ctxLink"', sliderHtml + '\n<button class="ctx" id="ctxLink"');

// 2. Bind the slider update logic when toolbar is shown
html = html.replace(
  'document.getElementById("ctxColorDot").style.background=state.colors[selected]||defaultColor(node(selected));',
  'document.getElementById("ctxColorDot").style.background=state.colors[selected]||defaultColor(node(selected));\n  document.getElementById("ctxLineLength").value = state.nodes[selected]?.childLineLength || (40 + 100 * (state.view?.density || 1.0));'
);

// 3. Bind the slider input event
html = html.replace(
  'document.getElementById("ctxDelete").onclick=removeSelected;',
  'document.getElementById("ctxDelete").onclick=removeSelected;\n  document.getElementById("ctxLineLength").oninput = e => { if(selected && state.nodes[selected]){ state.nodes[selected].childLineLength = parseInt(e.target.value); persist(); render(); } };\n  document.getElementById("ctxLineLength").onpointerdown = e => e.stopPropagation();'
);

// 4. Update layout function to use recursive depth-based positioning that supports custom childLineLength
const oldLayoutLR = `
    if(!kids.length){
      if (direction === "lr") {
        positions[id] = {x: horizontalStart + depth * xGap, y: 80 + nextYPx + nH/2};
        nextYPx += nH + spacing;
        return positions[id].y;
      } else {
        positions[id] = {x: 80 + nextXPx + nW/2, y: 300 + depth * xGap};
        nextXPx += nW + spacing;
        return positions[id].x;
      }
    }
    
    const ys=kids.map(k=>subtree(k,depth+1,nextAncestors));
    const y=(Math.min(...ys)+Math.max(...ys))/2;
    positions[id]=direction==="lr"
      ? {x:horizontalStart+depth*xGap,y}
      : {x:y,y:300+depth*xGap};
    return y;
  }
  visibleRoots.forEach(id=>subtree(id,0));
`;

const newLayoutLR = `
    const parentSpacing = state.nodes[id]?.childLineLength || xGap;
    
    if(!kids.length){
      if (direction === "lr") {
        positions[id] = {x: depth, y: 80 + nextYPx + nH/2};
        nextYPx += nH + spacing;
        return positions[id].y;
      } else {
        positions[id] = {x: 80 + nextXPx + nW/2, y: depth};
        nextXPx += nW + spacing;
        return positions[id].x;
      }
    }
    
    const ys=kids.map(k=>subtree(k, depth + parentSpacing, nextAncestors));
    const y=(Math.min(...ys)+Math.max(...ys))/2;
    positions[id]=direction==="lr"
      ? {x: depth, y}
      : {x: y, y: depth};
    return y;
  }
  visibleRoots.forEach(id=>subtree(id, direction==="lr" ? horizontalStart : 300));
`;
html = html.replace(oldLayoutLR, newLayoutLR);


const oldLayoutTB = `
      if(kids.length){
        const files=kids.filter(id=>m[id].type==="file");
        const folders=kids.filter(id=>m[id].type==="folder");
        const placeRow=(row,rowY)=>{
          if(!row.length)return;
          const total=row.map(child=>subtreeWidth(child,nextAncestors)).reduce((sum,item)=>sum+item,0)+siblingGap*(row.length-1);
          let childLeft=left+(width-total)/2;
          row.forEach(child=>{
            const childWidth=subtreeWidth(child,nextAncestors);
            place(child,depth+1,childLeft,rowY,nextAncestors);
            childLeft+=childWidth+siblingGap;
          });
        };
        placeRow(files, y + nH + levelGap/2);
        placeRow(folders, y + nH + levelGap);
      }
`;

const newLayoutTB = `
      if(kids.length){
        const files=kids.filter(id=>m[id].type==="file");
        const folders=kids.filter(id=>m[id].type==="folder");
        const customSpacing = state.nodes[id]?.childLineLength || (20 + 50 * d);
        const placeRow=(row,rowY)=>{
          if(!row.length)return;
          const total=row.map(child=>subtreeWidth(child,nextAncestors)).reduce((sum,item)=>sum+item,0)+siblingGap*(row.length-1);
          let childLeft=left+(width-total)/2;
          row.forEach(child=>{
            const childWidth=subtreeWidth(child,nextAncestors);
            place(child,depth+1,childLeft,rowY,nextAncestors);
            childLeft+=childWidth+siblingGap;
          });
        };
        placeRow(files, y + nH + customSpacing/2);
        placeRow(folders, y + nH + customSpacing);
      }
`;
html = html.replace(oldLayoutTB, newLayoutTB);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html for node-specific line lengths.");
