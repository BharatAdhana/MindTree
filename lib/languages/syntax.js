'use strict';
const Parser = require('web-tree-sitter');
let initialization;
const languages = new Map();

async function parse(language, source) {
  initialization ||= Parser.init();
  await initialization;
  if (!languages.has(language)) languages.set(language, Parser.Language.load(require.resolve(`tree-sitter-wasms/out/tree-sitter-${language}.wasm`)));
  const parser = new Parser();
  parser.setLanguage(await languages.get(language));
  const tree = parser.parse(source);
  return { tree, dispose() { tree.delete(); parser.delete(); } };
}
function walk(root, visit) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (visit(node) === false) continue;
    const children = node.namedChildren;
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}
const field = (node, name) => node.childForFieldName(name);
const location = node => ({ line: node.startPosition.row + 1, column: node.startPosition.column + 1 });
const unquote = node => node ? node.text.replace(/^["'`]|["'`]$/g, '') : '';
const binding = (local, imported = local, namespace = false) => ({ local, imported, namespace });
const record = (node, specifier, bindings = [], extra = {}) => ({ specifier, bindings, ...location(node), ...extra });
module.exports = { parse, walk, field, location, unquote, binding, record };
