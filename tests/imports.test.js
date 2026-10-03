const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');

const sources = {
  'web/package.json': '{"name":"web", "dependencies":{"react":"*"}}',
  'web/tsconfig.json': '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}',
  'web/src/foo.ts': 'export class Foo {}',
  'web/src/main.ts': 'import {Foo as Local} from "@/foo"; export function run(){ return new Local(); }',
  'web/src/main.js': 'const {Foo} = require("./foo"); function run(){return new Foo();}',
  'web/src/view.tsx': 'import {Foo} from "./foo"; function App(){return <Foo/>}',
  'py/pyproject.toml': '[project]\nname="sample"\nversion="1.0"',
  'py/src/pkg/__init__.py': '',
  'py/src/pkg/foo.py': 'class Foo:\n    pass\n',
  'py/src/pkg/main.py': 'from .foo import Foo as Local\nclass A:\n    def run(self):\n        return Local()\n',
  'java/src/demo/Foo.java': 'package demo; public class Foo {}',
  'java/src/app/A.java': 'package app; import demo.Foo; public class A { Foo run(){ return new Foo(); } }',
  'go/go.mod': 'module example.com/app\n\ngo 1.22\n',
  'go/foo/foo.go': 'package foo\nfunc Make() {}',
  'go/main.go': 'package main\nimport f "example.com/app/foo"\nfunc main(){f.Make()}',
  'rust/Cargo.toml': '[package]\nname="sample"\nversion="0.1.0"\nedition="2021"',
  'rust/src/foo.rs': 'pub struct Foo {}\npub fn make() {}',
  'rust/src/main.rs': 'mod foo; use crate::foo::{Foo as Local, make}; fn main(){ make(); }'
};

test('all initial languages resolve local imports in a mixed codebase', async t => {
  const root = await fixture(t, sources);
  const graph = await analyze({ root, modes: ['imports'] });
  assert.equal(graph.diagnostics.length, 0, JSON.stringify(graph.diagnostics));
  for (const [from, to] of [
    ['web/src/main.ts', 'web/src/foo.ts'], ['web/src/main.js', 'web/src/foo.ts'], ['web/src/view.tsx', 'web/src/foo.ts'],
    ['py/src/pkg/main.py', 'py/src/pkg/foo.py'], ['java/src/app/A.java', 'java/src/demo/Foo.java'],
    ['go/main.go', 'go/foo/foo.go'], ['rust/src/main.rs', 'rust/src/foo.rs']
  ]) assert.ok(graph.edges.some(e => e.kind === 'imports' && e.from === `path:${from}` && e.to === `path:${to}`), `${from} -> ${to}`);
});

test('comments are not imports; dynamic, external and missing imports are explicit', async t => {
  const root = await fixture(t, {
    'package.json': '{"dependencies":{"react":"*"}}',
    'main.js': '// import Ghost from "./ghost"\nimport React from "react"; import "./missing"; import(target);',
    'node_modules/react/index.js': 'export default 42;'
  });
  const graph = await analyze({ root, modes: ['imports'] });
  assert.equal(graph.edges.filter(e => e.kind === 'imports').length, 2);
  assert.ok(!graph.nodes.some(n => n.name === './ghost'));
  assert.ok(!graph.nodes.some(n => n.name === 'react'));
  assert.ok(graph.diagnostics.some(d => d.code === 'import-external' && d.message.includes('react')));
  assert.ok(graph.nodes.some(n => n.name === './missing' && n.status === 'unresolved'));
  assert.ok(graph.diagnostics.some(d => d.message.includes('Dynamic')));
});

test('workspace package exports and inherited TypeScript aliases resolve', async t => {
  const root = await fixture(t, {
    'base.json': '{"compilerOptions":{"baseUrl":".","paths":{"@shared/*":["shared/*"]}}}',
    'app/tsconfig.json': '{"extends":"../base.json"}',
    'app/main.ts': 'import {A} from "@shared/a"; import {B} from "local-pkg";',
    'shared/a.ts': 'export class A {}',
    'pkg/package.json': '{"name":"local-pkg","exports":{".":"./src/index.ts"}}',
    'pkg/src/index.ts': 'export class B {}'
  });
  const graph = await analyze({ root, modes: ['imports'] });
  assert.equal(graph.edges.filter(e => e.kind === 'imports' && e.status === 'resolved').length, 2);
});

module.exports = { sources };
