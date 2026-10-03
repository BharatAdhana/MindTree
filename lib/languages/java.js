'use strict';
const { walk, binding, record } = require('./syntax');
function imports(root) {
  const result = [];
  walk(root, node => {
    if (node.type !== 'import_declaration') return;
    const name = node.namedChildren.find(n => ['scoped_identifier', 'identifier'].includes(n.type));
    if (!name) return;
    const wildcard = node.text.includes('*');
    result.push(record(node, name.text, [binding(wildcard ? '*' : name.text.split('.').at(-1))], { wildcard, static: /^import\s+static\b/.test(node.text) }));
  });
  return result;
}
function packageName(root) { return root.namedChildren.find(n => n.type === 'package_declaration')?.namedChildren[0]?.text || ''; }
module.exports = { resolve: require('./resolution/java').resolve, imports, packageName };
