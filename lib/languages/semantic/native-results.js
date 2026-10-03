'use strict';
const path = require('node:path');
const key = file => process.platform === 'win32' ? path.resolve(file).toLowerCase() : path.resolve(file);
function applyResults(records, analyses, graph, language, engine) {
  const sources = new Map(analyses.filter(a => a.file.language === language).map(a => [key(a.file.absolute), a]));
  const edges = new Map(), resolvedReferences = new Set();
  const declarationAt = (analysis, offset) => analysis.declarations.filter(d => offset >= d.start && offset < d.end).sort((a, b) => a.end - a.start - (b.end - b.start))[0];
  for (const record of records) {
    const source = record.file ? sources.get(key(record.file)) : null;
    if (record.diagnostic) { graph.diagnostics.push({ code: 'semantic-diagnostic', path: source?.file.path || record.file || '.', line: record.line, message: `${engine}: ${record.message}` }); continue; }
    const destination = sources.get(key(record.targetFile));
    if (!source || !destination) continue;
    const from = declarationAt(source, record.from)?.id || source.file.id;
    const to = declarationAt(destination, record.target)?.id;
    if (!to || from === to) continue;
    const line = source.source.slice(0, record.at).split('\n').length;
    resolvedReferences.add(`${from}:${line}:${record.name}:${record.evidence}`);
    const id = `${engine}:${from}:${to}:${record.evidence}:${record.at}`;
    edges.set(id, { id, kind: 'references', from, to, line, name: record.name, evidence: record.evidence, engine, status: record.status || 'resolved' });
  }
  graph.edges = graph.edges.filter(edge => edge.kind !== 'references' || !resolvedReferences.has(`${edge.from}:${edge.line}:${edge.name}:${edge.evidence}`));
  graph.edges.push(...edges.values());
}
module.exports = { applyResults };
