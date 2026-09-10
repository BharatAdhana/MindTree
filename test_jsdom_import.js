const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const stateJs = fs.readFileSync('mindtree-state.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
const window = dom.window;

// Patch missing toast
window.toast = (msg) => console.log("TOAST:", msg);

window.eval(stateJs);

window.onload = () => {
  try {
    const text = `Project
├── Products
│   ├── Product Identity
│   └── Product Media
└── Seller
    ├── Seller Details
    └── Seller Status`;
    
    // Set textarea value
    window.document.getElementById('importText').value = text;
    // Click confirm
    window.document.getElementById('confirmImport').click();
    
    console.log("Current Project:", window.currentProjectId);
    console.log("State nodes length:", window.state.nodes.length);
    console.log("Roots:", window.state.roots);
    console.log("Selected:", window.selected);
  } catch(e) {
    console.error(e);
  }
};
