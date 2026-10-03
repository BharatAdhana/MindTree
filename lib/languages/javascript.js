'use strict';
const { walk, field, unquote, binding, record } = require('./syntax');

function imports(root) {
  const result = [];
  walk(root, node => {
    if (['import_statement', 'export_statement'].includes(node.type) && field(node, 'source')) {
      const bindings = [];
      const clause = node.namedChildren.find(n => n.type === 'import_clause');
      if (clause) walk(clause, part => {
        if (part.type === 'import_specifier') { bindings.push(binding((field(part, 'alias') || field(part, 'name')).text, field(part, 'name').text)); return false; }
        if (part.type === 'namespace_import') { bindings.push(binding(part.namedChildren[0].text, '*', true)); return false; }
        if (part.type === 'identifier' && part.parent.type === 'import_clause') bindings.push(binding(part.text, 'default'));
      });
      const reexports = [];
      if (node.type === 'export_statement') walk(node, part => {
        if (part.type === 'export_specifier') reexports.push({ imported: field(part, 'name').text, exported: (field(part, 'alias') || field(part, 'name')).text });
      });
      result.push(record(node, unquote(field(node, 'source')), bindings, { reexport: node.type === 'export_statement', reexports }));
    }
    if (node.type === 'call_expression') {
      const callee = field(node, 'function');
      if (!callee || !['require', 'import'].includes(callee.text)) return;
      const arg = field(node, 'arguments')?.namedChildren[0];
      if (!arg || arg.type !== 'string') { result.push(record(node, null, [], { dynamic: true })); return; }
      const bindings = [];
      const variable = node.parent.type === 'variable_declarator' ? node.parent : null;
      const name = variable && field(variable, 'name');
      if (name?.type === 'identifier') bindings.push(binding(name.text, '*', true));
      if (name?.type === 'object_pattern') name.namedChildren.forEach(part => {
        if (part.type === 'pair_pattern') bindings.push(binding(field(part, 'value').text, field(part, 'key').text));
        else if (part.type === 'shorthand_property_identifier_pattern') bindings.push(binding(part.text));
      });
      result.push(record(node, unquote(arg), bindings, { commonjs: callee.text === 'require' }));
    }
  });
  return result;
}
module.exports = { resolve: require('./resolution/javascript').resolve, imports };
