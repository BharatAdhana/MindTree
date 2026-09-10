const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(
  'if(contextVisible){contextVisible=false;activeConnection=null;render();return}',
  `if(contextVisible || selectedGroup.size > 1){
      contextVisible=false;
      activeConnection=null;
      selectedGroup.clear();
      if(selected) selectedGroup.add(selected);
      hideGroupResizeTools();
      render();
      return;
    }`
);

fs.writeFileSync('index.html', html, 'utf8');
console.log("Escape key patched!");
