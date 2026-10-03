'use strict';
const path = require('node:path');
const { applyResults } = require('./native-results');

function declaredTypes(source, limit) {
  const prefix = source.slice(0, limit);
  const result = new Map();
  const patterns = [
    /\b(?:var\s+)?([A-Za-z_]\w*)\s+\*?([A-Za-z_]\w*)\s*(?:[=,;){}]|$)/gm,
    /\b([A-Za-z_]\w*)\s*:=\s*&?([A-Za-z_]\w*)\s*\{/gm,
    /\b([A-Za-z_]\w*)\s*=\s*&?([A-Za-z_]\w*)\s*\{/gm
  ];
  for (const pattern of patterns) for (const match of prefix.matchAll(pattern)) result.set(match[1], match[2]);
  return result;
}

function packageAnalyses(analysis, analyses) {
  return analyses.filter(candidate => candidate.file.language === 'go' && candidate.packageName === analysis.packageName && path.dirname(candidate.file.absolute) === path.dirname(analysis.file.absolute));
}

function importedAnalyses(analysis, analyses, alias) {
  const imported = analysis.imports.find(entry => entry.bindings.some(binding => binding.local === alias));
  if (!imported) return [];
  const ids = new Set(imported.resolution?.files.map(file => file.id) || []);
  return analyses.filter(candidate => ids.has(candidate.file.id));
}

async function resolve(analyses, inventory, graph) {
  const go = analyses.filter(analysis => analysis.file.language === 'go');
  if (!go.length) return false;
  const records = [];
  for (const analysis of go) for (const reference of analysis.references || []) {
    const parts = reference.name.split('.');
    if (parts.length !== 2) continue;
    const [receiver, member] = parts;
    let candidates = [];
    const receiverType = declaredTypes(analysis.source, reference.index).get(receiver);
    if (receiverType) {
      const local = packageAnalyses(analysis, go);
      const types = local.flatMap(item => item.declarations.filter(declaration => declaration.name === receiverType && ['struct', 'interface', 'type'].includes(declaration.kind)));
      candidates = local.flatMap(item => item.declarations.filter(declaration => declaration.name === member && declaration.kind === 'method' && types.some(type => declaration.parent === type.id)));
    } else {
      candidates = importedAnalyses(analysis, go, receiver).flatMap(item => item.declarations.filter(declaration => declaration.name === member && declaration.parent === item.file.id));
    }
    candidates = [...new Map(candidates.map(candidate => [candidate.id, candidate])).values()];
    if (!candidates.length) {
      graph.diagnostics.push({ code: 'semantic-unresolved', path: analysis.file.path, line: reference.line, message: `Go source binding could not determine ${reference.name}.` });
      continue;
    }
    for (const target of candidates) records.push({ file: analysis.file.absolute, from: analysis.declarations.find(declaration => declaration.id === reference.owner)?.start ?? -1, at: reference.index, targetFile: analyses.find(item => item.file.id === target.fileId).file.absolute, target: target.start, name: reference.name, evidence: reference.evidence, status: candidates.length > 1 ? 'possible' : 'resolved' });
  }
  applyResults(records, analyses, graph, 'go', 'go-source');
  return true;
}

module.exports = { resolve, declaredTypes };
