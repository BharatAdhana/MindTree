'use strict';
const { walk, field, binding, record } = require('./syntax');
function imports(root) {
  const result = [];
  const item = node => ({ name: (field(node, 'name') || node).text, alias: field(node, 'alias')?.text });
  walk(root, node => {
    if (node.type === 'import_statement') {
      for (const child of node.namedChildren) {
        const { name, alias } = item(child);
        result.push(record(node, name, [binding(alias || name.split('.')[0], '*', true)], { qualified: alias ? null : name }));
      }
      return false;
    }
    if (node.type === 'import_from_statement') {
      const module = field(node, 'module_name');
      const bindings = node.namedChildren.filter(n => n.id !== module?.id).map(n => {
        const { name, alias } = item(n); return binding(alias || name, name);
      });
      result.push(record(node, module?.text || '', bindings));
      return false;
    }
  });
  return result;
}
module.exports = { resolve: require('./resolution/python').resolve, imports };
