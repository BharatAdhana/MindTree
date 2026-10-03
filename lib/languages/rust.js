'use strict';
const { walk, field, binding, record } = require('./syntax');
function imports(root) {
  const result = [];
  function use(node, prefix = '') {
    if (!node) return;
    if (node.type === 'scoped_use_list') {
      const base = [prefix, field(node, 'path')?.text].filter(Boolean).join('::');
      field(node, 'list')?.namedChildren.forEach(child => use(child, base));
    } else if (node.type === 'use_list') node.namedChildren.forEach(child => use(child, prefix));
    else {
      const name = (field(node, 'path') && node.type === 'use_as_clause' ? field(node, 'path') : node).text;
      const specifier = [prefix, name].filter(Boolean).join('::');
      const imported = name.split('::').at(-1);
      const alias = field(node, 'alias')?.text || imported;
      result.push(record(node, specifier, [binding(alias, imported)], { wildcard: imported === '*' }));
    }
  }
  walk(root, node => {
    if (node.type === 'use_declaration') { use(field(node, 'argument')); return false; }
    if (node.type === 'mod_item' && !field(node, 'body')) {
      const name = field(node, 'name')?.text;
      if (name) result.push(record(node, name, [binding(name, '*', true)], { moduleDeclaration: true }));
    }
  });
  return result;
}
module.exports = { resolve: require('./resolution/rust').resolve, imports };
