'use strict';
const path = require('node:path');
const { adapters } = require('./registry');

class ImportResolver {
  constructor(inventory, analyses) {
    this.inventory = inventory;
    this.analyses = analyses;
    this.files = new Map(inventory.files.map(f => [path.normalize(f.absolute), f]));
    this.packages = [...inventory.configurations.values()].filter(c => c.configs['package.json']?.name);
  }
  file(candidate, extensions = ['']) {
    for (const ext of extensions) { const file = this.files.get(path.normalize(candidate + ext)); if (file) return file; }
    return null;
  }
  result(files, status = 'unresolved', reason) { return { files: files.filter(Boolean), status: files.some(Boolean) ? 'resolved' : status, reason }; }
  resolve(file, imported) {
    if (imported.specifier === null) return this.result([], 'unresolved', 'Dynamic import has no literal module path.');
    const adapter = adapters[file.language];
    return adapter?.resolve ? adapter.resolve(this, file, imported) : this.result([]);
  }
}
module.exports = { ImportResolver };
