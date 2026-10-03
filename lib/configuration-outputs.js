'use strict';
const path = require('node:path');
const fs = require('node:fs/promises');

// Reads literal output settings; it never imports or evaluates project configuration.
async function nodeBuildOutputs(directory, pkg, diagnostics) {
  const scripts = Object.values(pkg.scripts || {}).filter(value => typeof value === 'string').join('\n');
  const outputs = [];
  if (/(?:^|[\s;&])vite\s+build\b/m.test(scripts)) {
    const configFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.mjs', 'vite.config.cts', 'vite.config.cjs'];
    let configured = false, uncertain = false;
    for (const name of configFiles) {
      let text;
      try { text = await fs.readFile(path.join(directory, name), 'utf8'); } catch (error) { if (error.code !== 'ENOENT') diagnostics.push({ code: 'config-read', path: path.join(directory, name), message: error.message }); continue; }
      const ts = require('typescript');
      const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
      const visit = node => {
        if (ts.isPropertyAssignment(node) && node.name.getText(source).replace(/["']/g, '') === 'build' && ts.isObjectLiteralExpression(node.initializer)) {
          const output = node.initializer.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(source).replace(/["']/g, '') === 'outDir');
          if (output) {
            if (ts.isStringLiteralLike(output.initializer)) { outputs.push(output.initializer.text); configured = true; }
            else uncertain = true;
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    const flag = scripts.match(/\bvite\s+build[^\n]*?--outDir(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s;&]+))/);
    if (flag) { outputs.push(flag[1] || flag[2] || flag[3]); configured = true; }
    if (uncertain) diagnostics.push({ code: 'output-unresolved', path: directory, message: 'Vite outDir is computed. Specify its resolved path in .mindtree.json exclude; configuration is not executed.' });
    if (!configured && !uncertain) outputs.push('dist');
  }
  return outputs;
}
module.exports = { nodeBuildOutputs };
