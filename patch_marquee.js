const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Fix positionContext (remove panX/panY undefined variables)
html = html.replace(
  `  const screenX = p.x * zoom + panX;
  const screenY = p.y * zoom + panY;`,
  `  const board = document.getElementById("board");
  const screenX = board.offsetLeft + p.x * zoom;
  const screenY = board.offsetTop + p.y * zoom;`
);

// 2. Add data-id to node cards so marquee selection can find their IDs
html = html.replace(
  `const card=document.createElement("div");`,
  `const card=document.createElement("div");
    card.dataset.id = id;`
);

// 3. Implement Marquee Selection on Shift+Drag
const oldPointerDown = `canvasEl.addEventListener("pointerdown",e=>{
  if(e.button!==0 || e.target.closest(".node-card,.sticky-note,.context,.side,.node-dialog,.canvas-tools,.tree-edge,.line-hit,.relation-path,.relation-hit")) return;
  dragging=true; canvasMoved=false; dragX=e.clientX; dragY=e.clientY; scrollX=canvasEl.scrollLeft; scrollY=canvasEl.scrollTop; canvasEl.setPointerCapture(e.pointerId); canvasEl.classList.add("dragging");
});`;

const newPointerDown = `let marqueeStartX = 0, marqueeStartY = 0;
canvasEl.addEventListener("pointerdown",e=>{
  if(e.button!==0 || e.target.closest(".node-card,.sticky-note,.context,.side,.node-dialog,.canvas-tools,.tree-edge,.line-hit,.relation-path,.relation-hit")) return;
  if(e.shiftKey) {
    marqueeStartX = e.clientX;
    marqueeStartY = e.clientY;
    marquee = document.createElement("div");
    marquee.className = "selection-marquee";
    marquee.style.left = marqueeStartX + "px";
    marquee.style.top = marqueeStartY + "px";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
    document.body.appendChild(marquee);
    canvasEl.setPointerCapture(e.pointerId);
    return;
  }
  dragging=true; canvasMoved=false; dragX=e.clientX; dragY=e.clientY; scrollX=canvasEl.scrollLeft; scrollY=canvasEl.scrollTop; canvasEl.setPointerCapture(e.pointerId); canvasEl.classList.add("dragging");
});`;

html = html.replace(oldPointerDown, newPointerDown);

const oldPointerMove = `canvasEl.addEventListener("pointermove",e=>{
  if(!dragging) return;
  if(Math.abs(e.clientX-dragX)+Math.abs(e.clientY-dragY)>4)canvasMoved=true;
  canvasEl.scrollLeft=scrollX-(e.clientX-dragX);
  canvasEl.scrollTop=scrollY-(e.clientY-dragY);
});`;

const newPointerMove = `canvasEl.addEventListener("pointermove",e=>{
  if (marquee) {
    const minX = Math.min(e.clientX, marqueeStartX);
    const minY = Math.min(e.clientY, marqueeStartY);
    const w = Math.abs(e.clientX - marqueeStartX);
    const h = Math.abs(e.clientY - marqueeStartY);
    marquee.style.left = minX + "px";
    marquee.style.top = minY + "px";
    marquee.style.width = w + "px";
    marquee.style.height = h + "px";
    return;
  }
  if(!dragging) return;
  if(Math.abs(e.clientX-dragX)+Math.abs(e.clientY-dragY)>4)canvasMoved=true;
  canvasEl.scrollLeft=scrollX-(e.clientX-dragX);
  canvasEl.scrollTop=scrollY-(e.clientY-dragY);
});`;

html = html.replace(oldPointerMove, newPointerMove);

const oldPointerUp = `canvasEl.addEventListener("pointerup",e=>{
  dragging=false; canvasEl.classList.remove("dragging");
  if (marquee) {
    marquee.remove();
    marquee = null;
    if(selectedGroup.size > 1) {
      showGroupResizeTools();
    } else {
      hideGroupResizeTools();
    }
  }
  try{canvasEl.releasePointerCapture(e.pointerId)}catch(_){}
});`;

const newPointerUp = `canvasEl.addEventListener("pointerup",e=>{
  dragging=false; canvasEl.classList.remove("dragging");
  if (marquee) {
    const rect = marquee.getBoundingClientRect();
    marquee.remove();
    marquee = null;
    const cards = document.querySelectorAll(".node-card");
    cards.forEach(card => {
      const cr = card.getBoundingClientRect();
      if (cr.left < rect.right && cr.right > rect.left && cr.top < rect.bottom && cr.bottom > rect.top) {
        if(card.dataset.id) selectedGroup.add(card.dataset.id);
      }
    });
    if(selectedGroup.size > 0) {
      selected = Array.from(selectedGroup).pop();
      contextVisible = true;
    }
    render();
    if(selectedGroup.size > 1) {
      showGroupResizeTools();
    } else {
      hideGroupResizeTools();
    }
  }
  try{canvasEl.releasePointerCapture(e.pointerId)}catch(_){}
});`;

html = html.replace(oldPointerUp, newPointerUp);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched positionContext and Marquee!");
