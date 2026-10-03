'use strict';
const path = require('node:path');
const { walk, field, location } = require('./syntax');
const rules = require('./symbol-rules');

const importTypes = new Set(['import_statement', 'import_from_statement', 'import_declaration', 'use_declaration']);
const functionTypes = new Set(['function_declaration', 'function_definition', 'method_declaration', 'method_definition', 'function_item', 'arrow_function', 'function_expression', 'lambda']);
const declarationScopeTypes = new Set(['program', 'module', 'source_file', 'block', 'statement_block', ...functionTypes]);
const identifierTypes = new Set(['identifier', 'type_identifier', 'shorthand_property_identifier_pattern']);
const contains = (outer, index) => index >= outer.start && index < outer.end;

function extract(root, file) {
  const declarations = [], references = [], shadows = [], exports = [];
  const names = new Set();
  const declarationNodes = new Map();
  function owner(node) {
    for (let p = node.parent; p; p = p.parent) if (declarationNodes.has(p.id)) return declarationNodes.get(p.id);
    return null;
  }
  function enclosingScope(node) {
    for (let p = node.parent; p; p = p.parent) if (declarationScopeTypes.has(p.type)) return { start: p.startIndex, end: p.endIndex };
    return { start: root.startIndex, end: root.endIndex };
  }
  walk(root, node => {
    let kind = rules[file.language]?.[node.type];
    let name = field(node, 'name');
    if (node.type === 'variable_declarator' && ['arrow_function', 'function_expression', 'generator_function'].includes(field(node, 'value')?.type) && name?.type === 'identifier') kind = 'function';
    if (!kind || !name) return;
    if (file.language === 'go' && node.type === 'type_spec') kind = { struct_type: 'struct', interface_type: 'interface' }[field(node, 'type')?.type] || 'type';
    const parent = owner(node);
    if (file.language === 'python' && kind === 'function' && parent?.kind === 'class') kind = 'method';
    if (file.language === 'rust' && kind === 'function' && node.parent?.parent?.type === 'impl_item') kind = 'method';
    const loc = location(node);
    const declaration = {
      id: `symbol:${file.path}:${name.text}:${loc.line}:${loc.column}`, kind, name: name.text, path: file.path,
      parent: parent?.id || file.id, fileId: file.id, language: file.language, ...loc,
      start: node.startIndex, end: node.endIndex, scope: enclosingScope(node), qualifiedName: parent ? `${parent.qualifiedName}.${name.text}` : name.text
    };
    if (file.language === 'go' && kind === 'method') {
      const receiver = field(node, 'receiver');
      if (receiver) walk(receiver, part => { if (part.type === 'type_identifier') declaration.receiver = part.text; });
    }
    if (file.language === 'rust' && node.parent?.parent?.type === 'impl_item') declaration.receiver = field(node.parent.parent, 'type')?.text;
    names.add(name.id);
    declarationNodes.set(node.id, declaration);
    declarations.push(declaration);
    if (node.parent.type === 'export_statement') exports.push({ exported: /\bdefault\b/.test(node.parent.text.slice(0, node.startIndex - node.parent.startIndex)) ? 'default' : name.text, local: name.text });
    if (node.type === 'variable_declarator' && node.parent?.parent?.type === 'export_statement') exports.push({ exported: name.text, local: name.text });
  });

  for (const declaration of declarations.filter(d => d.receiver)) {
    const owners = declarations.filter(d => ['class', 'struct', 'type', 'enum'].includes(d.kind) && d.name === declaration.receiver);
    if (owners.length === 1) { declaration.parent = owners[0].id; declaration.qualifiedName = `${owners[0].name}.${declaration.name}`; }
    delete declaration.receiver;
  }

  function shadowPattern(pattern, scope) {
    if (!pattern) return;
    walk(pattern, part => {
      if (['type_annotation', 'type_identifier', 'default_value'].includes(part.type)) return false;
      if (identifierTypes.has(part.type)) shadows.push({ name: part.text, ...scope });
    });
  }
  walk(root, node => {
    if (importTypes.has(node.type)) return false;
    if (node.type === 'export_specifier' && !field(node.parent.parent, 'source')) exports.push({ exported: (field(node, 'alias') || field(node, 'name')).text, local: field(node, 'name').text });
    if (node.type === 'assignment_expression') {
      const left = field(node, 'left')?.text, right = field(node, 'right');
      if (right?.type === 'identifier' && /^(?:module\.exports|exports\.[\w$]+|module\.exports\.[\w$]+)$/.test(left || '')) exports.push({ exported: left === 'module.exports' ? 'default' : left.split('.').at(-1), local: right.text });
      if (left === 'module.exports' && right?.type === 'object') for (const entry of right.namedChildren) {
        if (entry.type === 'shorthand_property_identifier') exports.push({ exported: entry.text, local: entry.text });
        else if (entry.type === 'pair' && field(entry, 'value')?.type === 'identifier') exports.push({ exported: field(entry, 'key').text, local: field(entry, 'value').text });
      }
    }
    if (node.type === 'variable_declarator' && !declarationNodes.has(node.id)) {
      const value = field(node, 'value');
      const imported = value?.type === 'call_expression' && ['require', 'import'].includes(field(value, 'function')?.text);
      if (!imported) shadowPattern(field(node, 'name'), enclosingScope(node));
    }
    if (['assignment', 'short_var_declaration'].includes(node.type)) shadowPattern(field(node, 'left'), enclosingScope(node));
    if (['formal_parameters', 'parameters', 'parameter_list'].includes(node.type)) {
      const scope = enclosingScope(node);
      for (const param of node.namedChildren) {
        if (param.type === 'identifier') shadowPattern(param, scope);
        else shadowPattern(field(param, 'name') || field(param, 'pattern') || (param.type === 'typed_parameter' ? param.namedChildren[0] : null), scope);
      }
    }
    let target = null, evidence;
    if (['call_expression', 'call'].includes(node.type)) { target = field(node, 'function'); evidence = 'call'; }
    if (node.type === 'method_invocation') {
      const object = field(node, 'object'), name = field(node, 'name');
      target = object ? { text: `${object.text}.${name?.text}`, startIndex: node.startIndex, startPosition: node.startPosition } : name;
      evidence = 'call';
    }
    if (node.type === 'new_expression') { target = field(node, 'constructor'); evidence = 'construct'; }
    if (node.type === 'object_creation_expression') { target = field(node, 'type'); evidence = 'construct'; }
    if (['jsx_self_closing_element', 'jsx_opening_element'].includes(node.type)) { target = field(node, 'name'); evidence = 'jsx'; }
    if (node.type === 'type_identifier' && !names.has(node.id)) { target = node; evidence = 'type'; }
    if (node.type === 'identifier' && node.parent?.type === 'class_heritage') { target = node; evidence = 'extends'; }
    if (node.type === 'class_definition') {
      for (const base of field(node, 'superclasses')?.namedChildren || []) if (['identifier', 'attribute'].includes(base.type)) references.push({ name: base.text, owner: declarationNodes.get(node.id)?.id || file.id, index: base.startIndex, ...location(base), evidence: 'extends' });
    }
    if (target && /^[\p{L}_$][\p{L}\p{N}_$]*(?:(?:\.|::)[\p{L}_$][\p{L}\p{N}_$]*)*$/u.test(target.text)) {
      references.push({ name: target.text, owner: owner(node)?.id || file.id, index: target.startIndex, ...location(target), evidence });
    }
  });
  return { declarations, references, shadows, exports };
}

function connect(analyses, graph, options = {}) {
  const byFile = new Map(analyses.map(a => [a.file.id, a]));
  for (const analysis of analyses) for (const declaration of analysis.declarations) {
    const { start, end, scope, ...node } = declaration;
    graph.nodes.push(node);
    graph.edges.push({ id: `contains:${node.parent}:${node.id}`, kind: 'contains', from: node.parent, to: node.id });
  }
  const edgeKeys = new Set();
  function exported(target, imported, seen = new Set()) {
    if (!target || seen.has(target.file.id)) return [];
    seen.add(target.file.id);
    const aliases = target.exports.filter(e => e.exported === imported).map(e => e.local);
    const requiresExport = ['javascript', 'typescript', 'tsx'].includes(target.file.language);
    let matches = target.declarations.filter(d => d.parent === target.file.id && (aliases.includes(d.name) || (!requiresExport && imported !== 'default' && d.name === imported)));
    if (!matches.length) for (const reexport of target.imports.filter(i => i.reexport)) {
      const alias = reexport.reexports?.find(e => e.exported === imported);
      if (reexport.reexports?.length && !alias) continue;
      for (const file of reexport.resolution.files) matches.push(...exported(byFile.get(file.id), alias?.imported || imported, new Set(seen)));
    }
    return matches;
  }
  for (const analysis of analyses) {
    if (options.skipLanguages?.has(analysis.file.language)) continue;
    for (const reference of analysis.references) {
      const parts = reference.name.split(/\.|::/);
      const first = parts[0];
      // Binding shadowing makes an imported name unsafe to resolve by spelling alone.
      if (analysis.shadows.some(s => s.name === first && contains(s, reference.index))) continue;
      let candidates = [];
      if (parts.length === 1) {
        const locals = analysis.declarations.filter(d => d.kind !== 'method' && d.name === first && contains(d.scope, reference.index));
        if (locals.length) {
          const smallest = Math.min(...locals.map(d => d.scope.end - d.scope.start));
          candidates = locals.filter(d => d.scope.end - d.scope.start === smallest);
        }
      }
      if (!candidates.length) for (const imported of analysis.imports) {
        for (const bind of imported.bindings) {
          if (bind.local !== first && bind.local !== '*') continue;
          if (bind.namespace && imported.qualified && !reference.name.startsWith(`${imported.qualified}.`)) continue;
          let sought = bind.namespace ? (imported.qualified ? reference.name.slice(imported.qualified.length + 1).split('.')[0] : parts[1]) : bind.imported === '*' ? first : bind.imported;
          if (bind.local === '*') sought = first;
          if (!sought && bind.namespace && imported.commonjs) sought = 'default';
          if (!sought) continue;
          for (const file of imported.resolution.files) {
            const target = byFile.get(file.id);
            candidates.push(...exported(target, sought));
            if (imported.static && target) candidates.push(...target.declarations.filter(d => d.name === sought && d.kind === 'method'));
          }
        }
      }
      if (!candidates.length && ['go', 'java'].includes(analysis.file.language) && parts.length === 1) {
        for (const target of analyses) {
          if (target.file.language !== analysis.file.language || target.packageName !== analysis.packageName) continue;
          if (analysis.file.language === 'go' && path.dirname(target.file.absolute) !== path.dirname(analysis.file.absolute)) continue;
          candidates.push(...target.declarations.filter(d => d.parent === target.file.id && d.name === first));
        }
      }
      candidates = [...new Map(candidates.map(c => [c.id, c])).values()];
      if (candidates.length > 1) {
        graph.diagnostics.push({ code: 'symbol-ambiguous', path: analysis.file.path, line: reference.line, message: `Multiple declarations match ${reference.name}; no relationship inferred.` });
        continue;
      }
      if (!candidates.length) {
        if (analysis.imports.some(i => i.bindings.some(b => b.local === first))) graph.diagnostics.push({ code: 'symbol-unresolved', path: analysis.file.path, line: reference.line, message: `Could not resolve symbol ${reference.name} from scanned declarations.` });
        continue;
      }
      const target = candidates[0];
      if (reference.owner === target.id) continue;
      const key = `${reference.owner}:${target.id}:${reference.evidence}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      graph.edges.push({ id: `references:${key}`, kind: 'references', from: reference.owner, to: target.id, line: reference.line, evidence: reference.evidence, name: reference.name });
    }
  }
}
module.exports = { extract, connect };
