const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const contextDiv = `
<div id="context" class="context">
<button class="ctx" id="ctxChild" title="Add child" aria-label="Add child"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
<button class="ctx" id="ctxSibling" title="Add sibling" aria-label="Add sibling"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14M5 7v10M19 7v10"/></svg></button>
<button class="ctx" id="ctxToggle" title="Expand or collapse branch" aria-label="Expand or collapse branch"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></button>
<button class="ctx" id="ctxNote" title="Add sticky note" aria-label="Add sticky note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v16H6zM9 8h6M9 12h6"/></svg></button>
<button class="ctx" id="ctxLink" title="Connect nodes" aria-label="Connect nodes"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 14 4-4m-6.5 7.5 2-2M14.5 8.5l2-2M7.5 16.5a3 3 0 0 1 0-4.2l2-2a3 3 0 0 1 4.2 0M16.5 7.5a3 3 0 0 1 0 4.2l-2 2a3 3 0 0 1-4.2 0"/></svg></button>
<button class="ctx ctx-action" id="ctxEdit" title="Rename or edit node" aria-label="Rename or edit node"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 9.5-9.5a2.2 2.2 0 0 0-3.1-3.1L5.1 15.9 4 20Z"/><path d="m13.5 7.5 3 3"/></svg><span class="ctx-label">Edit</span></button>
<button class="ctx" id="ctxColor" title="Color"><span class="color-dot" id="ctxColorDot"></span></button>
<button class="ctx ctx-action ctx-danger" id="ctxDelete" title="Delete node" aria-label="Delete node"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v5m4-5v5M9 7l1-2h4l1 2m-9 0 1 13h10l1-13"/></svg><span class="ctx-label">Delete</span></button>
</div>
`;

if (!html.includes('id="context"')) {
  html = html.replace('<div id="groupResizeTools"', contextDiv + '\n  <div id="groupResizeTools"');
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('Restored #context');
} else {
  console.log('Already restored');
}
