const fs = require('fs');
const stateJs = fs.readFileSync('mindtree-state.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

// evaluate mindtree-state
const module = {};
eval(stateJs);
const MindTreeState = global.MindTreeState;

// setup mock index.html logic
const STATE_SCHEMA_VERSION = MindTreeState.SCHEMA_VERSION;
function freshState(){ return { schemaVersion: STATE_SCHEMA_VERSION, nodes:[{id: "__project_root__", name: "MindTree", type: "folder", path: "MindTree", parent: null, children: []}], roots: ["__project_root__"], comments: {}, colors: {}, code: {}, collapsed: {}, manualPositions: {}, branchOffsets: {}, edgeStyles: {}, view: { direction: 'LR' }, notes: [], connections: [] }; }
function cloneState(s){ return JSON.parse(JSON.stringify(s)); }
function normalizeProjectState(value,source){
  const result=MindTreeState.normalizeState(value,{fallbackState:freshState()});
  return result;
}

let createdProject = null;
function createProject(name, stateToUse) {
  const normalized = normalizeProjectState(stateToUse, "New project");
  if(normalized.fatal) throw new Error("fatal");
  createdProject = { name, state: cloneState(normalized.state) };
}

const text = `Project
├── Products
│   ├── Product Identity
│   └── Product Media
└── Seller
    ├── Seller Details
    └── Seller Status`;

const tree = MindTreeState.parseStructureText(text);
if (!tree) throw new Error("Parse failed");

let counter = 0;
const nodes = [];
const stamp = 123;
function make(item,parent,path){
  const id="import-"+stamp+"-"+(++counter);
  const n={id,name:item.name,type:item.type,path,parent,children:[]};
  nodes.push(n);
  item.children.forEach(child=>{
    const cid=make(child,id,path+"/"+child.name);
    n.children.push(cid);
  });
  return id;
}
const rootId=make(tree,null,tree.name);
const importedState={schemaVersion:STATE_SCHEMA_VERSION,nodes,roots:[rootId],comments:{},colors:{},code:{},collapsed:{},manualPositions:{},branchOffsets:{},edgeStyles:{},view:{direction:'LR'},notes:[],connections:[]};
nodes.forEach(n=>{if(n.children.length)importedState.collapsed[n.id]=true});
importedState.collapsed[rootId]=false;
const normalized=normalizeProjectState(importedState,"Imported structure");
if(normalized.fatal) throw new Error("Fatal normalized");

createProject(tree.name, normalized.state);
console.log("Success:", !!createdProject);
console.log("Roots:", createdProject.state.roots);
console.log("Nodes count:", createdProject.state.nodes.length);
