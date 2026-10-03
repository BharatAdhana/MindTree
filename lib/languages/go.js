'use strict';
const { walk, field, unquote, binding, record } = require('./syntax');
function imports(root) {
  const result = [];
  walk(root, node => {
    if (node.type !== 'import_spec') return;
    const specifier = unquote(field(node, 'path'));
    const alias = field(node, 'name')?.text;
    result.push(record(node, specifier, [binding(alias || specifier.split('/').at(-1), '*', true)], { defaultAlias: !alias }));
  });
  return result;
}
function packageName(root) { return root.namedChildren.find(n => n.type === 'package_clause')?.namedChildren[0]?.text || ''; }
module.exports = { resolve: require('./resolution/go').resolve, imports, packageName };
