const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("log", (message, ...args) => { console.log("[JSDOM Log]", message, ...args); });
virtualConsole.on("error", (message, ...args) => { console.error("[JSDOM Error]", message, ...args); });

const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole, beforeParse(window) {
  window.localStorage = { getItem: () => null, setItem: () => {} };
  window.PROJECTS_KEY = 'mindtree-projects';
  window.crypto = { randomUUID: () => 'uuid' };
  
  // Create a proper MindTreeState mock
  window.MindTreeState = {
    load: () => ({ 
      version: 2,
      nodes: [{id: 'n1', name: 'Root', type: 'folder', children: []}], 
      roots: ['n1'],
      colors: {},
      collapsed: {},
      view: { density: 1.0, compactNodes: false, theme: "light" },
      manualPositions: {},
      nodeDimensions: {}
    }),
    save: () => {}
  };
}});

setTimeout(() => {
  try {
    const window = dom.window;
    // Call init if needed, though onload should run it
    if (window.init) window.init();
    
    console.log("Selecting node n1...");
    window.selectNode('n1');
  } catch (e) {
    console.error("Error during execution:", e);
  }
}, 500);
