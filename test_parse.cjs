const fs = require('fs');
const stateJs = fs.readFileSync('mindtree-state.js', 'utf8');
eval(stateJs);
const text = `Project
├── Products
│   ├── Product Identity
│   └── Product Media
└── Seller
    ├── Seller Details
    └── Seller Status`;
const tree = global.MindTreeState.parseStructureText(text);
console.log(JSON.stringify(tree, null, 2));
