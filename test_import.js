const { parseStructureText, normalizeState } = require('./mindtree-state.js');
const text = `Project
├── Products
│   ├── Product Identity
│   └── Product Media`;
const tree = parseStructureText(text);
const nodes = [];
let counter = 0;
function make(item,parent,path){
  const id='import-123-'+(++counter);
  const n={id,name:item.name,type:item.type,path,parent,children:[]};
  nodes.push(n);
  item.children.forEach(child=>{
    n.children.push(make(child,id,path+'/'+child.name));
  });
  return id;
}
const rootId = make(tree,null,tree.name);
const importedState={schemaVersion: 2,nodes,roots:[rootId],comments:{},colors:{},code:{},collapsed:{},manualPositions:{},branchOffsets:{},edgeStyles:{},view:{direction:'TB'},notes:[],connections:[]};
nodes.forEach(n=>{if(n.children.length)importedState.collapsed[n.id]=true});
importedState.collapsed[rootId]=false;
const normalized = normalizeState(importedState, {});
console.log("Fatal:", normalized.fatal);
if(normalized.fatal) {
  console.log("Issues:", normalized.issues);
}
console.log("Nodes:", normalized.state.nodes.map(n => n.name));
