'use strict';
const path = require('node:path');
const FRAMEWORKS = new Set(['@nestjs/common', '@angular/core']);

function connectProviders({ ts, sourceFile, analysis, checker, graph, mapped, owner, symbolTargets, sources }) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !FRAMEWORKS.has(statement.moduleSpecifier.text)) continue;
    for (const binding of statement.importClause?.namedBindings?.elements || []) bindings.set(binding.name.text, binding.propertyName?.text || binding.name.text);
  }
  if (!bindings.size) return;
  const seen = new Set(graph.nodes.map(n => n.id));
  function token(expression) {
    const symbol = checker.getSymbolAtLocation(expression);
    const target = symbolTargets(symbol)[0];
    if (target) return target;
    let declaration = symbol;
    if (declaration?.flags & ts.SymbolFlags.Alias) declaration = checker.getAliasedSymbol(declaration);
    const origin = declaration?.declarations?.[0];
    const file = origin?.getSourceFile();
    const original = file && sources.get(path.resolve(file.fileName).replace(/\\/g, '/'));
    // String tokens have value identity; Symbol/InjectionToken variables have declaration identity.
    const literal = ts.isStringLiteralLike(expression);
    if (!literal && (!original || !origin)) return null;
    const position = (file || sourceFile).getLineAndCharacterOfPosition((origin || expression).getStart(file || sourceFile));
    const id = literal ? `di-token:string:${expression.text}` : `di-token:${original.file.path}:${origin.getStart(file)}`;
    const result = { id, kind: 'token', name: literal ? expression.text : origin.name?.getText(file) || expression.getText(sourceFile), parent: original?.file.id || analysis.file.id, fileId: original?.file.id || analysis.file.id, path: original?.file.path || analysis.file.path, line: position.line + 1, column: position.character + 1, language: analysis.file.language };
    if (!seen.has(id)) { graph.nodes.push(result); graph.edges.push({ id: `contains:${result.parent}:${id}`, kind: 'contains', from: result.parent, to: id }); seen.add(id); }
    return result;
  }
  function edge(node, from, to, evidence, status = 'resolved') {
    if (!from || !to || from === to) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    graph.edges.push({ id: `di:${analysis.file.path}:${node.getStart(sourceFile)}:${from}:${to}:${evidence}`, kind: 'references', from, to, evidence, status, line: position.line + 1, column: position.character + 1, engine: 'typescript-di' });
  }
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const props = new Map(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(sourceFile).replace(/["']/g, ''), p.initializer]));
      const provided = props.get('provide');
      if (provided) {
        const source = token(provided), implementation = props.get('useClass'), existing = props.get('useExisting');
        if (implementation) {
          const targets = symbolTargets(checker.getSymbolAtLocation(implementation));
          if (targets.length === 1) edge(node, source?.id, targets[0].id, 'di-provider');
          else graph.diagnostics.push({ code: 'di-unresolved', path: analysis.file.path, message: 'Computed or ambiguous useClass provider was not resolved.' });
        } else if (existing) edge(node, source?.id, token(existing)?.id, 'di-alias');
        else if (props.has('useFactory')) graph.diagnostics.push({ code: 'di-factory', path: analysis.file.path, message: 'Factory provider is visible as source references; its runtime return implementation is not assumed.' });
      }
    }
    if (ts.isCallExpression(node) && bindings.has(node.expression.getText(sourceFile))) {
      const name = bindings.get(node.expression.getText(sourceFile));
      if ((name === 'Inject' || name === 'inject') && node.arguments[0]) {
        const injected = token(node.arguments[0]);
        edge(node, owner(node, analysis), injected?.id, 'di-inject');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}
module.exports = { connectProviders };
