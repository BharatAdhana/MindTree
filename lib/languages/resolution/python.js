'use strict';
const path = require('node:path');
const { nearestConfig } = require('../../configuration');
function python(context, candidate) { return context.file(candidate, ['.py', '.pyi']) || context.file(path.join(candidate, '__init__'), ['.py', '.pyi']); }

function resolve(context, file, imported) {
  const spec = imported.specifier;
  const dir = path.dirname(file.absolute);
  const dots = spec.match(/^\.+/)?.[0].length || 0;
  let bases = [context.inventory.root, path.join(context.inventory.root, 'src'), dir];
  const pyproject = nearestConfig(context.inventory, file.absolute, 'pyproject.toml');
      if (pyproject) {
    bases.unshift(pyproject.directory, path.join(pyproject.directory, 'src'));
    for (const source of pyproject.value.tool?.setuptools?.packages?.find?.where || []) bases.unshift(path.resolve(pyproject.directory, source));
        for (const entry of pyproject.value.tool?.poetry?.packages || []) if (entry.from) bases.unshift(path.resolve(pyproject.directory, entry.from));
        for (const [prefix, target] of Object.entries(pyproject.value.tool?.setuptools?.['package-dir'] || {})) {
          if (prefix === '') bases.unshift(path.resolve(pyproject.directory, target));
          else if (spec === prefix || spec.startsWith(`${prefix}.`)) {
            const mapped = path.resolve(pyproject.directory, target, spec.slice(prefix.length).replace(/^\./, '').replace(/\./g, path.sep));
            const resolved = python(context, mapped);
            if (resolved) return context.result([resolved]);
          }
        }
  }
  if (dots) bases = [path.resolve(dir, ...Array(Math.max(0, dots - 1)).fill('..'))];
  const suffix = spec.slice(dots).replace(/\./g, path.sep);
  for (const base of bases) {
    const module = python(context, path.join(base, suffix));
    const submodules = imported.bindings.filter(b => !b.namespace && b.imported !== '*').map(b => python(context, path.join(base, suffix, b.imported))).filter(Boolean);
    if (module || submodules.length) return context.result([module, ...submodules]);
  }
  return context.result([], dots ? 'unresolved' : 'external', dots ? undefined : 'Module is outside the scanned source roots; dependencies are not inspected.');
}
module.exports = { resolve };
