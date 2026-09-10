const { parseStructureText } = require('./mindtree-state.js');
const text = `# Project Mind Graph
> Interactive project structure with user-added notes and node metadata.

## Project Structure
- 📁 **Project**
  - 📁 **src**
    - 📄 **index.js**`;
console.log(JSON.stringify(parseStructureText(text), null, 2));
