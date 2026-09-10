const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');

// Mock a lightweight dom environment to test the exact crash
const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;

// Define a minimal MindTreeState mock so the script doesn't crash on load
window.MindTreeState = {
  load: () => ({ nodes: [{id: 'n1', name: 'Root', type: 'folder'}], view: {} }),
  save: () => {}
};

setTimeout(() => {
  try {
    window.selectNode('n1');
    console.log("Context classes:", window.document.getElementById('context').className);
    console.log("Error if any: None");
  } catch (e) {
    console.error("Error during selectNode:", e);
  }
}, 500);
