const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');
const imports = graph => graph.edges.filter(e => e.kind === 'imports');

test('Go local replace uses configured source and go.work replacement takes precedence', async t => {
  const root = await fixture(t, {
    'go.work': 'go 1.22\nuse (\n ./app\n ./actual\n)\nreplace example.com/api => ./actual\n',
    'app/go.mod': 'module example.com/app\nrequire example.com/api v1.0.0\nreplace (\n example.com/api => ../old\n)\n',
    'app/main.go': 'package main\nimport "example.com/api"\nfunc main(){api.Run()}',
    'actual/go.mod': 'module example.com/api\n', 'actual/api.go': 'package api\nfunc Run(){}',
    'old/go.mod': 'module example.com/api\n', 'old/api.go': 'package api\nfunc Run(){}'
  });
  const graph = await analyze({ root, modes: ['imports'] });
  assert.ok(imports(graph).some(e => e.from === 'path:app/main.go' && e.to === 'path:actual/api.go'));
  assert.ok(!imports(graph).some(e => e.from === 'path:app/main.go' && e.to === 'path:old/api.go'));
});

test('Cargo workspace-inherited local dependencies retain project source relationships', async t => {
  const root = await fixture(t, {
    'Cargo.toml': '[workspace]\nmembers=["app","domain"]\n[workspace.dependencies]\nrenamed={path="domain",package="domain"}',
    'app/Cargo.toml': '[package]\nname="app"\nversion="0.1.0"\n[dependencies]\nrenamed={workspace=true}',
    'app/src/main.rs': 'use renamed::Service; fn main() {}',
    'domain/Cargo.toml': '[package]\nname="domain"\nversion="0.1.0"\n[lib]\npath="lib/domain.rs"',
    'domain/lib/domain.rs': 'pub struct Service {}'
  });
  const graph = await analyze({ root, modes: ['imports'] });
  assert.ok(imports(graph).some(e => e.to === 'path:domain/lib/domain.rs'));
});

test('Python package-dir roots and Java declared types resolve independently of directory guesses', async t => {
  const root = await fixture(t, {
    'py/pyproject.toml': '[project]\nname="sample"\nversion="1"\n[tool.setuptools.package-dir]\n""="custom-source"',
    'py/custom-source/domain/repository.py': 'class Repository:\n    pass',
    'py/main.py': 'from domain.repository import Repository',
    'java/domain/Types.java': 'package domain; class Repository {}',
    'java/main/Consumer.java': 'package main; import domain.Repository; class Consumer {}'
  });
  const graph = await analyze({ root, modes: ['imports'] });
  assert.ok(imports(graph).some(e => e.to === 'path:py/custom-source/domain/repository.py'));
  assert.ok(imports(graph).some(e => e.to === 'path:java/domain/Types.java'));
});
