const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const oldListeners = `canvasEl.addEventListener("pointerdown",e=>{
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
  dragging=true; canvasMoved=false; dragX=e.clientX; dragY=e.clientY; scrollX=panX; scrollY=panY; canvasEl.setPointerCapture(e.pointerId); canvasEl.classList.add("dragging");
});
canvasEl.addEventListener("pointermove",e=>{
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
  panX=scrollX+(e.clientX-dragX);
  panY=scrollY+(e.clientY-dragY);
  setZoom(zoom);
});

canvasEl.addEventListener("pointerup",e=>{
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
});

canvasEl.addEventListener("pointercancel",()=>{dragging=false;canvasEl.classList.remove("dragging"); if(marquee) {marquee.remove(); marquee=null;}});`;

const newListeners = `canvasEl.addEventListener("pointerdown", e => {
  if (e.button !== 0 || e.target.closest(".node-card,.sticky-note,.context,.side,.node-dialog,.canvas-tools,.tree-edge,.line-hit,.relation-path,.relation-hit")) return;
  if (e.shiftKey) {
    marqueeStartX = e.clientX;
    marqueeStartY = e.clientY;
    marquee = document.createElement("div");
    marquee.className = "selection-marquee";
    marquee.style.left = marqueeStartX + "px";
    marquee.style.top = marqueeStartY + "px";
    marquee.style.width = "0px";
    marquee.style.height = "0px";
    document.body.appendChild(marquee);
    try { e.target.setPointerCapture(e.pointerId); } catch(err){}
    return;
  }
  dragging = true; 
  canvasMoved = false; 
  dragX = e.clientX; 
  dragY = e.clientY; 
  scrollX = panX; 
  scrollY = panY;
  try { e.target.setPointerCapture(e.pointerId); } catch(err){}
  canvasEl.classList.add("dragging");
});

window.addEventListener("pointermove", e => {
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
  if (!dragging) return;
  if (Math.abs(e.clientX - dragX) + Math.abs(e.clientY - dragY) > 4) canvasMoved = true;
  
  // Calculate relative to zoom to maintain 1:1 mouse tracking
  panX = scrollX + (e.clientX - dragX) / zoom;
  panY = scrollY + (e.clientY - dragY) / zoom;
  setZoom(zoom);
});

window.addEventListener("pointerup", e => {
  if (dragging) {
    dragging = false; 
    canvasEl.classList.remove("dragging");
    try { e.target.releasePointerCapture(e.pointerId); } catch(err){}
  }
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
    if (selectedGroup.size > 1) {
      showGroupResizeTools();
    } else {
      hideGroupResizeTools();
    }
  }
});

window.addEventListener("pointercancel", () => {
  dragging = false; 
  canvasEl.classList.remove("dragging"); 
  if (marquee) { marquee.remove(); marquee = null; }
});`;

// Wait, I realized that if the board is scaled by zoom, then dragging the mouse by 100 pixels moves the board by 100 / zoom pixels to keep it physically pinned to the cursor!
// Example: zoom = 2 (200%). The board is twice as big.
// To move the board 100 pixels on screen, you only need to translate it by 50 pixels! Because 50 * 2 = 100.
// Yes! `panX = scrollX + (e.clientX - dragX) / zoom` is mathematically correct for 1:1 tracking when zoomed!

html = html.replace(oldListeners, newListeners);
fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched index.html dragging logic.");
