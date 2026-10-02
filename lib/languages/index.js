'use strict';
const fs = require('node:fs/promises');
const { parse } = require('./syntax');
const { adapters } = require('./registry');
const { ImportResolver } = require('./resolver');

async function analyzeSources(inventory, graph, modes) {
  const analyses = [];
  const parseErrors = new Set();
  for (const file of inventory.files) {
    const adapter = adapters[file.language];
    if (!adapter) continue;
    let parsed;
    try {
      const source = await fs.readFile(file.absolute, 'utf8');
      parsed = await parse(file.language, source);
      const root = parsed.tree.rootNode;
      if (root.hasError()) { parseErrors.add(file.id); graph.diagnostics.push({ code: 'parse-error', path: file.path, message: 'Syntax could not be fully parsed; relationships may be incomplete.' }); }
      const analysis = { file, source, imports: adapter.imports(root), packageName: adapter.packageName?.(root) || '', topLevelNames: root.namedChildren.map(n => n.childForFieldName('name')?.text).filter(Boolean) };
      if (modes.includes('symbols')) Object.assign(analysis, require('./symbols').extract(root, file));
      analyses.push(analysis);
    } catch (error) { graph.diagnostics.push({ code: 'source-read', path: file.path, message: error.message }); }
    finally { parsed?.dispose(); }
  }
  const semantic = require('./semantic/typescript');
  const prepared = semantic.prepare(analyses, inventory, graph);
  const resolver = new ImportResolver(inventory, analyses);
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  for (const analysis of analyses) {
    for (const [index, imported] of analysis.imports.entries()) {
      imported.resolution = resolver.resolve(analysis.file, imported);
      const resolution = imported.resolution;
      if (analysis.file.language === 'go' && imported.defaultAlias && resolution.files.length) {
        const packageNames = new Set(resolution.files.map(file => analyses.find(a => a.file.id === file.id)?.packageName).filter(Boolean));
        if (packageNames.size === 1) imported.bindings[0].local = [...packageNames][0];
      }
      if (resolution.status !== 'resolved') {
        const id = `module:${analysis.file.language}:${resolution.status}:${imported.specifier || '<dynamic>'}`;
        if (resolution.status !== 'external' && !nodeIds.has(id)) {
          nodeIds.add(id);
          graph.nodes.push({ id, kind: 'module', name: imported.specifier || 'Dynamic import', path: imported.specifier || '', parent: null, status: resolution.status, language: analysis.file.language });
        }
        resolution.nodeId = id;
        graph.diagnostics.push({ code: `import-${resolution.status}`, path: analysis.file.path, line: imported.line, message: `${imported.specifier || 'Dynamic import'}: ${resolution.reason || (resolution.status === 'external' ? 'Dependency source is not scanned.' : 'No scanned module could be resolved.')}` });
      }
      if (modes.includes('imports')) {
        const targets = resolution.files.length ? resolution.files.map(f => f.id) : resolution.status === 'external' ? [] : [resolution.nodeId];
        targets.forEach(to => graph.edges.push({ id: `imports:${analysis.file.id}:${index}:${to}`, kind: 'imports', from: analysis.file.id, to, specifier: imported.specifier, line: imported.line, status: resolution.status }));
      }
    }
  }
  if (modes.includes('symbols')) {
    const engines = {};
    require('./symbols').connect(analyses, graph, { skipLanguages: semantic.LANGUAGES });
    semantic.connect(prepared, graph);
    if (analyses.some(a => semantic.LANGUAGES.has(a.file.language))) engines.typescript = 'active';
    for (const [language, adapter] of [['python', './semantic/python'], ['java', './semantic/java'], ['go', './semantic/go'], ['rust', './semantic/rust']]) {
      if (analyses.some(a => a.file.language === language)) engines[language] = await require(adapter).resolve(analyses, inventory, graph) ? 'active' : 'unavailable-or-failed';
    }
    graph.engines = engines;
  }
  graph.stats.analyzedFiles = analyses.length;
  graph.stats.imports = graph.edges.filter(e => e.kind === 'imports').length;
  graph.stats.references = graph.edges.filter(e => e.kind === 'references').length;
  const supported = inventory.files.filter(file => file.language);
  const byLanguage = {};
  for (const file of supported) (byLanguage[file.language] ||= { discovered: 0, analyzed: 0, partial: 0, failed: 0 }).discovered++;
  for (const analysis of analyses) {
    byLanguage[analysis.file.language].analyzed++;
    if (parseErrors.has(analysis.file.id)) byLanguage[analysis.file.language].partial++;
  }
  for (const entry of Object.values(byLanguage)) entry.failed = entry.discovered - entry.analyzed;
  const relationshipEdges = graph.edges.filter(edge => edge.kind !== 'contains');
  const unresolvedReferences = graph.diagnostics.filter(diagnostic => ['reference-unresolved', 'semantic-unresolved', 'symbol-unresolved', 'symbol-ambiguous'].includes(diagnostic.code)).length;
  graph.coverage = {
    files: { discovered: inventory.files.length, supported: supported.length, analyzed: analyses.length, partial: parseErrors.size, failed: supported.length - analyses.length, unsupported: inventory.files.length - supported.length, byLanguage },
    relationships: {
      resolved: relationshipEdges.filter(edge => !edge.status || edge.status === 'resolved').length,
      possible: relationshipEdges.filter(edge => edge.status === 'possible').length,
      unresolved: relationshipEdges.filter(edge => edge.status === 'unresolved').length + unresolvedReferences,
      skipped: graph.diagnostics.filter(diagnostic => diagnostic.code === 'import-external').length
    },
    engines: graph.engines || {}
  };
}
module.exports = { analyzeSources };
