'use strict';
const path = require('node:path');
const { nearestConfig } = require('../../configuration');
const { parseGoConfig } = require('./go-config');

function resolve(context, file, imported) {
  const spec = imported.specifier;
  const module = nearestConfig(context.inventory, file.absolute, 'go.mod');
  const workspace = nearestConfig(context.inventory, file.absolute, 'go.work');
  const moduleConfig = parseGoConfig(module?.value);
  const workConfig = parseGoConfig(workspace?.value);
  const prefix = name => spec === name || spec.startsWith(`${name}/`);
  const candidates = [
    ...workConfig.replace.map(r => ({ ...r, directory: workspace.directory })),
    ...moduleConfig.replace.map(r => ({ ...r, directory: module.directory }))
  ];
  for (const replacement of candidates) {
    if (!prefix(replacement.from) || replacement.version && moduleConfig.require.get(replacement.from) !== replacement.version) continue;
    if (!replacement.to.startsWith('.') && !path.isAbsolute(replacement.to)) return context.result([], 'external', 'Replacement uses an external module version.');
    const directory = path.resolve(replacement.directory, replacement.to, spec.slice(replacement.from.length).replace(/^\//, ''));
    return context.result(context.inventory.files.filter(f => f.language === 'go' && path.dirname(f.absolute) === directory && !f.absolute.endsWith('_test.go')), 'unresolved', 'Local replacement target is outside the scanned inventory or has no Go sources.');
  }
  const roots = new Set([module?.directory, ...workConfig.use.map(p => path.resolve(workspace.directory, p))]);
  for (const config of context.inventory.configurations.values()) {
    if (module && !roots.has(config.directory)) continue;
    const moduleName = parseGoConfig(config.configs['go.mod']).module;
    if (!moduleName || (spec !== moduleName && !spec.startsWith(`${moduleName}/`))) continue;
    const directory = path.resolve(config.directory, spec.slice(moduleName.length).replace(/^\//, ''));
    return context.result(context.inventory.files.filter(f => f.language === 'go' && path.dirname(f.absolute) === directory && !f.absolute.endsWith('_test.go')));
  }
  return context.result([], 'external');
}
module.exports = { resolve };
