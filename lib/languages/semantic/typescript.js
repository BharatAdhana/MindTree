'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { nearestConfig } = require('../../configuration');
const { connectProviders } = require('./typescript-di');

const LANGUAGES = new Set(['javascript', 'typescript', 'tsx']);
const normalize = file => path.resolve(file).replace(/\\/g, '/');
const isDeclaration = node => ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isInterfaceDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isConstructorDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
const walk = (node, visit) => { if (visit(node) !== false) ts.forEachChild(node, child => walk(child, visit)); };

function constantString(expression, checker, seen = new Set()) {
  if (!expression || seen.has(expression)) return undefined;
  seen.add(expression);
  if (ts.isStringLiteralLike(expression)) return expression.text;
  if (ts.isParenthesizedExpression(expression)) return constantString(expression.expression, checker, seen);
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = constantString(expression.left, checker, new Set(seen)), right = constantString(expression.right, checker, new Set(seen));
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (ts.isTemplateExpression(expression)) {
    let text = expression.head.text;
    for (const span of expression.templateSpans) { const value = constantString(span.expression, checker, new Set(seen)); if (value === undefined) return undefined; text += value + span.literal.text; }
    return text;
  }
  if (ts.isIdentifier(expression)) {
    let symbol = checker.getSymbolAtLocation(expression);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declarations = symbol?.declarations || [];
    if (declarations.length !== 1) return undefined;
    const declaration = declarations[0];
    if (ts.isVariableDeclaration(declaration) && declaration.parent.flags & ts.NodeFlags.Const) return constantString(declaration.initializer, checker, seen);
  }
  return undefined;
}

function prepare(analyses, inventory, graph) {
  const sources = new Map(analyses.filter(a => LANGUAGES.has(a.file.language)).map(a => [normalize(a.file.absolute), a]));
  const inventoryFiles = new Set(inventory.files.map(f => normalize(f.absolute)));
  const directories = new Set();
  for (const file of inventory.files) for (let dir = path.dirname(file.absolute); !directories.has(normalize(dir)); dir = path.dirname(dir)) { directories.add(normalize(dir)); if (dir === path.dirname(dir)) break; }
  const defaultLibraryDirectory = normalize(path.dirname(ts.getDefaultLibFilePath({})));
  const canRead = file => inventoryFiles.has(normalize(file)) || normalize(file).startsWith(`${defaultLibraryDirectory}/`) || (/\/node_modules\//.test(normalize(file)) && /(?:\.d\.[cm]?ts|\/package\.json|\/tsconfig[^/]*\.json)$/.test(normalize(file)));
  const groups = new Map();
  for (const analysis of sources.values()) {
    const config = nearestConfig(inventory, analysis.file.absolute, 'tsconfig.json') || nearestConfig(inventory, analysis.file.absolute, 'jsconfig.json');
    const key = config?.directory || inventory.root;
    if (!groups.has(key)) groups.set(key, { config, files: [] });
    groups.get(key).files.push(analysis.file.absolute);
  }
  const projects = [];
  for (const [directory, group] of groups) {
    const options = {
      target: ts.ScriptTarget.Latest, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      ...ts.convertCompilerOptionsFromJson(group.config?.value.compilerOptions || {}, directory).options,
      allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true, types: [], allowImportingTsExtensions: true, ignoreDeprecations: '6.0'
    };
    if (group.config?.value.compilerOptions?.paths) options.baseUrl = group.config.value.pathBase;
    else if (group.config?.value.compilerOptions?.baseUrl) options.baseUrl = group.config.value.baseUrl;
    const host = ts.createCompilerHost(options);
    host.getCurrentDirectory = () => inventory.root;
    host.fileExists = file => canRead(file) && fs.existsSync(file);
    host.readFile = file => {
      if (!canRead(file)) return undefined;
      const source = sources.get(normalize(file));
      if (source) return source.source;
      try { return fs.readFileSync(file, 'utf8'); } catch (_) { return undefined; }
    };
    host.getSourceFile = (file, version) => { const text = host.readFile(file); return text === undefined ? undefined : ts.createSourceFile(file, text, version, true); };
    host.directoryExists = directory => directories.has(normalize(directory)) || (normalize(directory).includes('/node_modules') && ts.sys.directoryExists(directory));
    host.getDirectories = directory => normalize(directory).includes('/node_modules') ? ts.sys.getDirectories(directory) : [...directories].filter(p => normalize(path.dirname(p)) === normalize(directory));
    host.writeFile = () => { throw new Error('Source analysis must not emit files.'); };
    const program = ts.createProgram(group.files, options, host);
    const checker = program.getTypeChecker();
    projects.push({ program, checker, files: group.files });
    for (const file of group.files) {
      const sourceFile = program.getSourceFile(file), analysis = sources.get(normalize(file));
      if (!sourceFile) continue;
      walk(sourceFile, node => {
        if (!ts.isCallExpression(node) || !(node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(sourceFile) === 'require')) return;
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const imported = analysis.imports.find(i => i.line === position.line + 1 && i.column === position.character + 1 && i.dynamic);
        if (imported) {
          const value = constantString(node.arguments[0], checker);
          if (value !== undefined) { imported.specifier = value; imported.dynamic = false; imported.evidence = 'constant-expression'; }
        }
      });
    }
  }
  return { sources, projects };
}

function connect(prepared, graph) {
  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const edges = new Set();
  for (const { program, checker, files } of prepared.projects) {
    const byDeclaration = new Map();
    function mapped(declaration) {
      if (!declaration) return null;
      if (byDeclaration.has(declaration)) return byDeclaration.get(declaration);
      const sourceFile = declaration.getSourceFile(), analysis = prepared.sources.get(normalize(sourceFile.fileName));
      if (!analysis) return null;
      const name = declaration.name?.getText(sourceFile) || (ts.isConstructorDeclaration(declaration) ? 'constructor' : 'default');
      const start = declaration.getStart(sourceFile);
      let match = analysis.declarations.filter(d => d.name === name && d.start < declaration.end && d.end > start)
        .sort((a, b) => Math.abs(a.start - start) + Math.abs(a.end - declaration.end) - Math.abs(b.start - start) - Math.abs(b.end - declaration.end))[0];
      if (!match && isDeclaration(declaration)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(start);
        const kind = ts.isInterfaceDeclaration(declaration) ? 'interface' : ts.isClassLike(declaration) ? 'class' : ts.isTypeAliasDeclaration(declaration) ? 'type' : ts.isEnumDeclaration(declaration) ? 'enum' : ts.isMethodDeclaration(declaration) || ts.isMethodSignature(declaration) || ts.isConstructorDeclaration(declaration) ? 'method' : 'function';
        const parent = mapped(declaration.parent);
        match = { id: `semantic:${analysis.file.path}:${name}:${pos.line + 1}:${pos.character + 1}`, name, kind, fileId: analysis.file.id, parent: parent?.id || analysis.file.id, path: analysis.file.path, language: analysis.file.language, line: pos.line + 1, column: pos.character + 1 };
        graph.nodes.push(match); nodeMap.set(match.id, match);
        graph.edges.push({ id: `contains:${match.parent}:${match.id}`, from: match.parent, to: match.id, kind: 'contains' });
      }
      byDeclaration.set(declaration, match || null);
      return match;
    }
    function owner(node, analysis) {
      for (let current = node.parent; current && !ts.isSourceFile(current); current = current.parent) if (isDeclaration(current)) { const declaration = mapped(current); if (declaration) return declaration.id; }
      return analysis.file.id;
    }
    function symbolTargets(symbol) {
      if (!symbol) return [];
      if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
      return (symbol?.declarations || []).map(mapped).filter(Boolean);
    }
    function relate(node, expression, evidence, analysis, sourceFile) {
      const isCall = ts.isCallExpression(node) || ts.isNewExpression(node);
      let targets = [];
      let external = false;
      const expressionType = checker.getTypeAtLocation(expression);
      if (isCall) {
        const signature = checker.getResolvedSignature(node);
        if (signature?.declaration) {
          const target = mapped(signature.declaration);
          if (target) targets.push(target);
          external = !prepared.sources.has(normalize(signature.declaration.getSourceFile().fileName));
        }
      }
      if (!targets.length) {
        const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expression) ? expression.name : expression);
        targets = symbolTargets(symbol);
        if (!targets.length && ts.isNewExpression(node)) targets = symbolTargets(expressionType.symbol);
      }
      // A union's possible methods are candidates, not proof of one runtime implementation.
      let status = 'resolved';
      if (ts.isPropertyAccessExpression(expression)) {
        const receiver = checker.getTypeAtLocation(expression.expression);
        if (receiver.isUnion()) {
          const possibilities = receiver.types.flatMap(type => symbolTargets(checker.getPropertyOfType(type, expression.name.text)));
          if (possibilities.length) { targets = possibilities; status = 'possible'; }
        }
      }
      targets = [...new Map(targets.map(target => [target.id, target])).values()];
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      if (!targets.length) {
        if (isCall && !external && expression.kind !== ts.SyntaxKind.ImportKeyword && !['require', 'super'].includes(expression.getText(sourceFile))) graph.diagnostics.push({ code: 'reference-unresolved', path: analysis.file.path, line: position.line + 1, message: `No project declaration resolved for ${expression.getText(sourceFile)}.` });
        return;
      }
      const from = owner(node, analysis);
      for (const target of targets) {
        if (target.id === from) continue;
        const key = `${from}:${target.id}:${evidence}:${position.line}:${position.character}`;
        if (edges.has(key)) continue;
        edges.add(key);
        graph.edges.push({ id: `semantic:${key}`, kind: 'references', from, to: target.id, line: position.line + 1, column: position.character + 1, name: expression.getText(sourceFile), evidence, status, engine: 'typescript' });
      }
    }
    for (const file of files) {
      const analysis = prepared.sources.get(normalize(file)), sourceFile = program.getSourceFile(file);
      if (!sourceFile) continue;
      walk(sourceFile, node => {
        if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return false;
        if (ts.isCallExpression(node)) relate(node, node.expression, 'call', analysis, sourceFile);
        else if (ts.isNewExpression(node)) relate(node, node.expression, 'construct', analysis, sourceFile);
        else if (ts.isTypeReferenceNode(node)) relate(node, node.typeName, 'type', analysis, sourceFile);
        else if (ts.isExpressionWithTypeArguments(node)) relate(node, node.expression, node.parent.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends', analysis, sourceFile);
        else if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) relate(node, node.tagName, 'jsx', analysis, sourceFile);
        else if (ts.isIdentifier(node) && node.parent.name !== node && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) && !ts.isTypeReferenceNode(node.parent)) {
          // Class/function values passed as DI providers are source references too.
          if (ts.isCallExpression(node.parent) && node.parent.expression === node || ts.isNewExpression(node.parent) && node.parent.expression === node) return;
          relate(node, node, 'value', analysis, sourceFile);
        }
      });
      connectProviders({ ts, sourceFile, analysis, checker, graph, mapped, owner, symbolTargets, sources: prepared.sources });
    }
  }
}
module.exports = { prepare, connect, LANGUAGES };
