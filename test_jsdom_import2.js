const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const stateJs = fs.readFileSync('mindtree-state.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8').replace(
  '<script src="mindtree-state.js"></script>',
  '<script>' + stateJs + '</script>'
);

const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
const window = dom.window;
window.toast = (msg) => console.log("TOAST:", msg);

window.onload = () => {
  try {
    const text = `Project
├── Products
│   ├── Product Identity
│   └── Product Media
└── Seller
    ├── Seller Details
    └── Seller Status`;
    
    window.document.getElementById('importText').value = text;
    window.document.getElementById('confirmImport').click();
    
    console.log("Current Project:", window.currentProjectId);
    console.log("State nodes length:", window.state.nodes.length);
    console.log("Roots:", window.state.roots);
    console.log("Selected:", window.selected);
    console.log("Positions count:", Object.keys(window.positions || {}).length);
  } catch(e) {
    console.error(e);
  }
};
