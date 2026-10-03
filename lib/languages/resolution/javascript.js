'use strict';
const path = require('node:path');
const { nearestConfig } = require('../../configuration');
const { builtinModules } = require('node:module');
function resolveJs(context, candidate, visited = new Set()) {
  if (visited.has(candidate)) return null;
  visited.add(candidate);
  const direct = context.file(candidate, ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json']);
  if (direct) return direct;
  if (/\.[cm]?js$/.test(candidate)) {
    const replaced = context.file(candidate.replace(/\.[cm]?js$/, ''), ['.ts', '.tsx', '.mts', '.cts']);
    if (replaced) return replaced;
  }
  const pkg = context.inventory.configurations.get(candidate)?.configs['package.json'];
  for (const main of [pkg?.types, pkg?.module, pkg?.main]) if (typeof main === 'string') { const file = resolveJs(context, path.resolve(candidate, main), visited); if (file) return file; }
  return context.file(path.join(candidate, 'index'), ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
}

function resolve(context, file, imported) {
  const spec = imported.specifier;
  const dir = path.dirname(file.absolute);
  if (builtinModules.includes(spec) || spec.startsWith('node:')) return context.result([], 'external');
  if (spec.startsWith('.') || path.isAbsolute(spec)) return context.result([resolveJs(context, path.resolve(dir, spec))]);
  const config = nearestConfig(context.inventory, file.absolute, 'tsconfig.json') || nearestConfig(context.inventory, file.absolute, 'jsconfig.json');
  if (config) {
    for (const [pattern, targets] of Object.entries(config.value.compilerOptions?.paths || {})) {
      const [start, end] = pattern.split('*');
      if (end === undefined ? spec !== start : !spec.startsWith(start) || !spec.endsWith(end)) continue;
      const middle = end === undefined ? '' : spec.slice(start.length, end ? -end.length : undefined);
      for (const target of targets) {
        const found = resolveJs(context, path.resolve(config.value.pathBase, target.replace('*', middle)));
        if (found) return context.result([found]);
      }
    }
    if (config.value.compilerOptions?.baseUrl) { const found = resolveJs(context, path.resolve(config.value.baseUrl, spec)); if (found) return context.result([found]); }
  }
  for (const pkg of context.packages) {
    const value = pkg.configs['package.json'];
    if (spec !== value.name && !spec.startsWith(`${value.name}/`)) continue;
    const sub = spec.slice(value.name.length).replace(/^\//, '');
    const exports = value.exports;
    let entry = typeof exports === 'string' && !sub ? exports : exports?.[sub ? `./${sub}` : '.'];
    if (entry && typeof entry === 'object') entry = entry.types || entry.import || entry.require || entry.default;
    return context.result([resolveJs(context, path.resolve(pkg.directory, typeof entry === 'string' ? entry : sub || value.source || value.main || 'index'))]);
  }
  const pkg = nearestConfig(context.inventory, file.absolute, 'package.json')?.value || {};
  const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  return context.result([], [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies, pkg.optionalDependencies].some(d => d?.[name]) ? 'external' : 'unresolved');
}
module.exports = { resolve };
