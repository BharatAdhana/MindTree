'use strict';
const path = require('node:path');

function resolve(context, file, imported) {
  const spec = imported.specifier;
  const parts = spec.split('.');
  if (imported.static && !imported.wildcard) parts.pop();
  const name = parts.pop();
  const packageName = imported.wildcard && !imported.static ? spec : parts.join('.');
  const files = context.analyses.filter(a => a.file.language === 'java' && a.packageName === packageName && ((imported.wildcard && !imported.static) || a.topLevelNames.includes(name))).map(a => a.file);
  return context.result(files, /^(?:java|javax|jdk)\./.test(spec) ? 'external' : 'unresolved');
}
module.exports = { resolve };
