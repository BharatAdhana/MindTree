'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const { findTool } = require('./toolchains');
const { applyResults } = require('./native-results');
const { SEMANTIC_TIMEOUT_MS } = require('../../constants');

async function resolve(analyses, inventory, graph) {
  const sources = analyses.filter(a => a.file.language === 'java');
  if (!sources.length) return false;
  const executable = findTool('java');
  if (!executable) { graph.diagnostics.push({ code: 'semantic-tool-unavailable', path: '.', message: 'Java semantic analysis needs a JDK. Set JAVA_HOME or MINDTREE_JAVA.' }); return false; }
  try {
    const records = await new Promise((resolve, reject) => {
      const process = spawn(executable, ['--source', '17', path.join(__dirname, 'java/MindTreeBindings.java')], { cwd: os.tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      const timer = setTimeout(() => { process.kill(); reject(new Error('Java semantic analysis timed out.')); }, SEMANTIC_TIMEOUT_MS);
      let output = '', errors = '';
      process.stdout.on('data', data => output += data); process.stderr.on('data', data => errors += data);
      process.on('error', error => { clearTimeout(timer); reject(error); });
      process.on('close', code => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(errors.trim() || `Java exited ${code}`));
        try { resolve(output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))); } catch (error) { reject(error); }
      });
      process.stdin.on('error', () => {});
      process.stdin.end(sources.map(a => Buffer.from(a.file.absolute).toString('base64')).join('\n') + '\n');
    });
    applyResults(records, analyses, graph, 'java', 'javac'); return true;
  } catch (error) { graph.diagnostics.push({ code: 'semantic-tool-error', path: '.', message: error.message }); return false; }
}
module.exports = { resolve };
