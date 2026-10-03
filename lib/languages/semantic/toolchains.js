'use strict';
const fs = require('node:fs');
const path = require('node:path');

const TOOL_ENV = Object.freeze({ java: 'MINDTREE_JAVA', go: 'MINDTREE_GO', 'rust-analyzer': 'MINDTREE_RUST_ANALYZER' });
const JAVA_INSTALLATIONS = Object.freeze([['Android', 'Android Studio', 'jbr']]);
function findTool(name) {
  const executable = process.platform === 'win32' ? `${name}.exe` : name;
  const candidates = [process.env[TOOL_ENV[name]], ...(process.env.PATH || '').split(path.delimiter).map(p => path.join(p, executable))];
  if (name === 'java') {
    for (const home of [process.env.JAVA_HOME, process.env.JDK_HOME]) if (home) candidates.unshift(path.join(home, 'bin', executable));
    if (process.platform === 'win32' && process.env.ProgramFiles) for (const parts of JAVA_INSTALLATIONS) candidates.push(path.join(process.env.ProgramFiles, ...parts, 'bin', executable));
  }
  return candidates.find(file => file && fs.existsSync(file)) || null;
}
module.exports = { findTool };
