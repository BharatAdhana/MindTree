'use strict';
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { LspClient } = require('./lsp-client');

const normalize = file => { const normalized = path.resolve(file).replace(/\\/g, '/'); return process.platform === 'win32' ? normalized.toLowerCase() : normalized; };
function offset(source, position) {
  const lines = source.split('\n');
  return lines.slice(0, position.line).reduce((sum, line) => sum + line.length + 1, 0) + position.character;
}
async function resolve(analyses, inventory, graph) {
  const python = analyses.filter(a => a.file.language === 'python');
  if (!python.length) return false;
  let executable;
  try { executable = execFileSync(process.env.MINDTREE_PYTHON || 'python', ['-I', '-S', '-c', 'import sys; print(sys.executable)'], { cwd: os.tmpdir(), encoding: 'utf8', windowsHide: true }).trim(); }
  catch (_) { graph.diagnostics.push({ code: 'semantic-tool-unavailable', path: '.', message: 'Python interpreter was not found; Python semantic analysis is unavailable.' }); return false; }
  const client = new LspClient(process.execPath, [path.join(__dirname, 'python-server.js'), '--stdio'], { cwd: os.tmpdir(), env: { ...process.env, MINDTREE_PYTHON_EXECUTABLE: executable } });
  const byPath = new Map(python.map(a => [normalize(a.file.absolute), a]));
  const extraPaths = new Set([inventory.root]);
  for (const a of python) extraPaths.add(path.dirname(a.file.absolute));
  const settings = { pythonPath: executable, analysis: { autoSearchPaths: true, extraPaths: [...extraPaths], diagnosticMode: 'openFilesOnly', autoImportCompletions: false, useLibraryCodeForTypes: false, exclude: ['**/node_modules', '**/.venv', '**/venv', '**/site-packages', '**/__pycache__', ...inventory.exclusions.map(e => e.path)] } };
  client.requestHandler = (method, params) => method === 'workspace/configuration' ? params.items.map(item => item.section === 'python' ? settings : item.section === 'python.analysis' ? settings.analysis : {}) : null;
  const edges = [];
  try {
    await client.request('initialize', { processId: process.pid, rootUri: pathToFileURL(inventory.root).href, capabilities: { workspace: { configuration: true }, textDocument: { definition: { linkSupport: true } } } });
    client.notify('initialized', {});
    client.notify('workspace/didChangeConfiguration', { settings: { python: settings } });
    for (const analysis of python) client.notify('textDocument/didOpen', { textDocument: { uri: pathToFileURL(analysis.file.absolute).href, languageId: 'python', version: 1, text: analysis.source } });
    for (const analysis of python) for (const reference of analysis.references || []) {
      const uri = pathToFileURL(analysis.file.absolute).href;
      const result = await client.request('textDocument/definition', { textDocument: { uri }, position: { line: reference.line - 1, character: reference.column - 1 + reference.name.length - 1 } });
      const locations = Array.isArray(result) ? result : result ? [result] : [];
      const targets = new Map();
      for (const location of locations) {
        const targetUri = location.targetUri || location.uri;
        if (!targetUri?.startsWith('file:')) continue;
        const target = byPath.get(normalize(fileURLToPath(targetUri)));
        if (!target) continue;
        const point = offset(target.source, (location.targetSelectionRange || location.range).start);
        const declaration = target.declarations.filter(d => point >= d.start && point < d.end).sort((a, b) => a.end - a.start - (b.end - b.start))[0];
        if (declaration) targets.set(declaration.id, declaration);
      }
      if (!locations.length) graph.diagnostics.push({ code: 'reference-unresolved', path: analysis.file.path, line: reference.line, message: `Pyright did not resolve ${reference.name}.` });
      for (const target of targets.values()) if (target.id !== reference.owner) edges.push({ id: `pyright:${analysis.file.id}:${reference.index}:${target.id}`, kind: 'references', from: reference.owner, to: target.id, line: reference.line, column: reference.column, name: reference.name, evidence: reference.evidence, status: targets.size > 1 ? 'possible' : 'resolved', engine: 'pyright' });
    }
    const pythonIds = new Set(graph.nodes.filter(n => n.language === 'python').map(n => n.id));
    graph.edges = graph.edges.filter(e => e.kind !== 'references' || !pythonIds.has(e.from));
    graph.edges.push(...edges);
    return true;
  } catch (error) {
    graph.diagnostics.push({ code: 'semantic-tool-error', path: '.', message: `Python semantic analysis: ${error.message}` }); return false;
  } finally { await client.close(); }
}
module.exports = { resolve };
