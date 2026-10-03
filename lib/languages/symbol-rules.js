'use strict';
const JS = Object.freeze({ class_declaration: 'class', function_declaration: 'function', generator_function_declaration: 'function', method_definition: 'method', interface_declaration: 'interface', type_alias_declaration: 'type', enum_declaration: 'enum' });
module.exports = Object.freeze({
  javascript: JS, typescript: JS, tsx: JS,
  python: Object.freeze({ class_definition: 'class', function_definition: 'function' }),
  java: Object.freeze({ class_declaration: 'class', interface_declaration: 'interface', enum_declaration: 'enum', record_declaration: 'struct', method_declaration: 'method', constructor_declaration: 'method' }),
  go: Object.freeze({ function_declaration: 'function', method_declaration: 'method', method_spec: 'method', type_spec: 'type' }),
  rust: Object.freeze({ struct_item: 'struct', enum_item: 'enum', trait_item: 'trait', type_item: 'type', function_item: 'function', function_signature_item: 'method', mod_item: 'module' })
});
