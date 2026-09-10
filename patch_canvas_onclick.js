const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(
  `    activeConnection=null;
    contextVisible=false;
    selected=focusRoot||state.roots[0];
    closeComment();
    render();`,
  `    activeConnection=null;
    contextVisible=false;
    selected=focusRoot||state.roots[0];
    selectedGroup.clear();
    if (selected) selectedGroup.add(selected);
    hideGroupResizeTools();
    closeComment();
    render();`
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Patched canvas onclick");
