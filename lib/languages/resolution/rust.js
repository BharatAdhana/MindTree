'use strict';
const path = require('node:path');
const { nearestConfig } = require('../../configuration');

function resolve(context, file, imported) {
  const spec = imported.specifier;
  const dir = path.dirname(file.absolute);
  const cargo = nearestConfig(context.inventory, file.absolute, 'Cargo.toml');
  let rootFile = cargo ? context.file(path.resolve(cargo.directory, cargo.value.lib?.path || 'src/lib.rs')) || context.file(path.join(cargo.directory, 'src/main.rs')) : context.file(path.join(context.inventory.root, 'lib.rs')) || context.file(path.join(context.inventory.root, 'main.rs'));
  let crateRoot = rootFile ? path.dirname(rootFile.absolute) : cargo ? path.join(cargo.directory, 'src') : context.inventory.root;
  let segments = spec.split('::');
  let base;
  if (segments[0] === 'crate') { base = crateRoot; segments.shift(); }
  else if (segments[0] === 'self') { base = /^(?:mod|lib|main)\.rs$/.test(path.basename(file.absolute)) ? dir : file.absolute.slice(0, -3); segments.shift(); }
  else if (segments[0] === 'super') {
    base = /^(?:mod|lib|main)\.rs$/.test(path.basename(file.absolute)) ? dir : file.absolute.slice(0, -3);
    while (segments[0] === 'super') { base = path.dirname(base); segments.shift(); }
  } else if (imported.moduleDeclaration) base = /^(?:mod|lib|main)\.rs$/.test(path.basename(file.absolute)) ? dir : file.absolute.slice(0, -3);
  else {
    if (['std', 'core', 'alloc'].includes(segments[0])) return context.result([], 'external');
    let dependency = cargo?.value.dependencies?.[segments[0]] || cargo?.value['dev-dependencies']?.[segments[0]];
    let dependencyDirectory = cargo?.directory;
    if (dependency?.workspace) {
      const ancestors = [...context.inventory.configurations.values()].filter(c => cargo.directory.startsWith(c.directory + path.sep) || cargo.directory === c.directory).sort((a, b) => b.directory.length - a.directory.length);
      const owner = ancestors.find(c => c.configs['Cargo.toml']?.workspace?.dependencies?.[segments[0]]);
      if (owner) { dependency = owner.configs['Cargo.toml'].workspace.dependencies[segments[0]]; dependencyDirectory = owner.directory; }
    }
    if (dependency) {
      if (!dependency.path) return context.result([], 'external');
      const targetDirectory = path.resolve(dependencyDirectory, dependency.path);
      const target = context.inventory.configurations.get(targetDirectory)?.configs['Cargo.toml'];
      rootFile = context.file(path.resolve(targetDirectory, target?.lib?.path || 'src/lib.rs'));
      if (!rootFile) return context.result([], 'unresolved', 'Local Cargo dependency source is outside the scanned inventory.');
      crateRoot = path.dirname(rootFile.absolute); segments.shift();
    }
    base = crateRoot;
  }
  // The last component may be a symbol, so resolve the longest module prefix.
  for (let length = segments.length; length > 0; length--) {
    const candidate = path.join(base, ...segments.slice(0, length));
    const found = context.file(candidate, ['.rs']) || context.file(path.join(candidate, 'mod.rs'));
    if (found) return context.result([found]);
  }
  if (base === crateRoot && rootFile && context.analyses.find(a => a.file.id === rootFile.id)?.topLevelNames.includes(segments[0])) return context.result([rootFile]);
  return context.result([]);
}
module.exports = { resolve };
