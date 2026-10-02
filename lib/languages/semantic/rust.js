'use strict';
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { LspClient } = require('./lsp-client');
const { findTool } = require('./toolchains');
const { applyResults } = require('./native-results');

const normalize = file => { const value = path.resolve(file).replace(/\\/g, '/'); return process.platform === 'win32' ? value.toLowerCase() : value; };
function position(source, index) {
  const before = source.slice(0, index), lines = before.split('\n');
  return { line: lines.length - 1, character: lines.at(-1).length };
}
function offset(source, point) {
  const lines = source.split('\n');
  return lines.slice(0, point.line).reduce((total, line) => total + line.length + 1, 0) + point.character;
}
function projectGraph(analyses, inventory) {
  const rust = analyses.filter(a => a.file.language === 'rust');
  const byPath = new Map(rust.map(a => [normalize(a.file.absolute), a]));
  const crates = [];
  for (const config of inventory.configurations.values()) {
    const cargo = config.configs['Cargo.toml'];
    if (!cargo?.package) continue;
    const candidates = [cargo.lib?.path || 'src/lib.rs', 'src/main.rs'];
    const root = candidates.map(name => byPath.get(normalize(path.resolve(config.directory, name)))).find(Boolean);
    if (!root) continue;
    crates.push({ root_module: root.file.absolute, edition: String(cargo.package.edition || '2021'), display_name: cargo.package.name, deps: [], cfg: [], env: {}, is_workspace_member: true, source: { include_dirs: [config.directory], exclude_dirs: inventory.exclusions.map(e => path.resolve(inventory.root, e.path)) }, _directory: config.directory, _cargo: cargo });
  }
  if (!crates.length) for (const analysis of rust.filter(a => /(?:^|\/)(?:lib|main)\.rs$/.test(a.file.path))) crates.push({ root_module: analysis.file.absolute, edition: '2021', display_name: path.basename(inventory.root), deps: [], cfg: [], env: {}, is_workspace_member: true });
  const byDirectory = new Map(crates.map((crate, index) => [normalize(crate._directory || path.dirname(crate.root_module)), { crate, index }]));
  for (const crate of crates) {
    for (const [name, value] of Object.entries(crate._cargo?.dependencies || {})) {
      if (!value || typeof value !== 'object' || !value.path) continue;
      const target = byDirectory.get(normalize(path.resolve(crate._directory, value.path)));
      if (target) crate.deps.push({ crate: target.index, name: name.replace(/-/g, '_') });
    }
    delete crate._directory; delete crate._cargo;
  }
  return { sysroot: null, crates };
}
async function resolve(analyses, inventory, graph) {
  const rust = analyses.filter(a => a.file.language === 'rust');
  if (!rust.length) return false;
  const executable = findTool('rust-analyzer');
  if (!executable) { graph.diagnostics.push({ code: 'semantic-tool-unavailable', path: '.', message: 'Rust semantic analysis needs rust-analyzer. Set MINDTREE_RUST_ANALYZER.' }); return false; }
  const client = new LspClient(executable, [], { cwd: inventory.root, env: { ...process.env, RUSTUP_TOOLCHAIN: '', CARGO_HOME: '' } });
  const settings = { linkedProjects: [projectGraph(analyses, inventory)], cargo: { buildScripts: { enable: false }, sysroot: null }, procMacro: { enable: false }, checkOnSave: false, diagnostics: { enable: false }, files: { excludeDirs: inventory.exclusions.map(e => e.path) } };
  client.requestHandler = (method, params) => method === 'workspace/configuration' ? params.items.map(item => item.section === 'rust-analyzer' ? settings : {}) : null;
  let ready;
  const readiness = new Promise(resolve => { ready = resolve; });
  client.notificationHandler = (method, params) => {
    if (method === 'experimental/serverStatus' && (params?.quiescent || params?.health === 'ok')) ready();
  };
  const records = [];
  try {
    await client.request('initialize', { processId: process.pid, rootUri: pathToFileURL(inventory.root).href, capabilities: { workspace: { configuration: true }, textDocument: { definition: { linkSupport: true } } }, initializationOptions: settings });
    client.notify('initialized', {});
    client.notify('workspace/didChangeConfiguration', { settings: { 'rust-analyzer': settings } });
    for (const analysis of rust) client.notify('textDocument/didOpen', { textDocument: { uri: pathToFileURL(analysis.file.absolute).href, languageId: 'rust', version: 1, text: analysis.source } });
    await Promise.race([readiness, new Promise(resolve => setTimeout(resolve, 3000))]);
    await client.request('workspace/symbol', { query: '' });
    for (const analysis of rust) for (const reference of analysis.references || []) {
      const point = position(analysis.source, reference.index + Math.max(0, reference.name.length - 1));
      const result = await client.request('textDocument/definition', { textDocument: { uri: pathToFileURL(analysis.file.absolute).href }, position: point });
      for (const location of Array.isArray(result) ? result : result ? [result] : []) {
        const targetUri = location.targetUri || location.uri;
        if (!targetUri?.startsWith('file:')) continue;
        const destination = rust.find(item => normalize(item.file.absolute) === normalize(fileURLToPath(targetUri)));
        if (!destination) continue;
        records.push({ file: analysis.file.absolute, from: analysis.declarations.find(d => d.id === reference.owner)?.start ?? -1, at: reference.index, targetFile: destination.file.absolute, target: offset(destination.source, (location.targetSelectionRange || location.range).start), name: reference.name, evidence: reference.evidence });
      }
    }
    applyResults(records, analyses, graph, 'rust', 'rust-analyzer'); return true;
  } catch (error) { graph.diagnostics.push({ code: 'semantic-tool-error', path: '.', message: `Rust semantic analysis: ${error.message}` }); return false; }
  finally { await client.close(); }
}
module.exports = { resolve, projectGraph };
