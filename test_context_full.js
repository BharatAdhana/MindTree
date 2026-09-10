const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('index.html', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;

// Mock enough of the environment for the script to load and initialize properly
window.localStorage = { getItem: () => null, setItem: () => {} };
window.PROJECTS_KEY = 'mindtree-projects';
window.crypto = { randomUUID: () => 'uuid' };
window.MindTreeState = {
  load: () => ({ nodes: [{id: 'n1', name: 'Root', type: 'folder'}], view: {} }),
  save: () => {}
};

setTimeout(() => {
  try {
    // Attempt to select the node
    window.selected = 'n1';
    window.render();
    window.selectNode('n1');
    console.log("Context classes:", window.document.getElementById('context').className);
    console.log("Context left:", window.document.getElementById('context').style.left);
  } catch (e) {
    console.error("Error during selectNode:", e);
  }
}, 1000);
