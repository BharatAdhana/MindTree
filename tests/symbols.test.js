const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');

test('symbol mode connects source usages for all initial languages without import edges', async t => {
  const root = await fixture(t, {
    'js/foo.ts': 'export class Foo {}',
    'js/main.ts': 'import {Foo as Local} from "./foo"; export class A { run(){return new Local()} }',
    'js/common.js': 'const {Foo} = require("./foo"); function run(){ return new Foo(); }',
    'py/foo.py': 'class Foo:\n    pass',
    'py/main.py': 'from .foo import Foo as Local\ndef run():\n    return Local()\n',
    'java/Foo.java': 'package demo; public class Foo {}',
    'java/A.java': 'package demo; public class A { Foo run(){return new Foo();} }',
    'go/go.mod': 'module example.com/app\n',
    'go/foo/foo.go': 'package foo\nfunc Make() {}',
    'go/main.go': 'package main\nimport f "example.com/app/foo"\nfunc main(){f.Make()}',
    'rust/Cargo.toml': '[package]\nname="app"\nversion="0.1.0"',
    'rust/src/foo.rs': 'pub struct Foo {}\npub fn make() {}',
    'rust/src/main.rs': 'mod foo; use crate::foo::{Foo as Local, make}; fn main(){make(); Local::new();}'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  assert.equal(graph.edges.filter(e => e.kind === 'imports').length, 0);
  const map = new Map(graph.nodes.map(n => [n.id, n]));
  const relations = graph.edges.filter(e => e.kind === 'references').map(e => [map.get(e.from).path, map.get(e.to).name]);
  for (const [file, name] of [['js/main.ts', 'Foo'], ['js/common.js', 'Foo'], ['py/main.py', 'Foo'], ['java/A.java', 'Foo'], ['go/main.go', 'Make'], ['rust/src/main.rs', 'make'], ['rust/src/main.rs', 'Foo']]) {
    assert.ok(relations.some(r => r[0] === file && r[1] === name), `${file} -> ${name}; ${JSON.stringify(graph.diagnostics)}`);
  }
});

test('unused imports and shadowed bindings do not become symbol connections', async t => {
  const root = await fixture(t, {
    'foo.js': 'export class Foo {}',
    'unused.js': 'import {Foo} from "./foo.js"; function run(){return 1;}',
    'shadowed.js': 'import {Foo} from "./foo.js"; function run(Foo){return new Foo();}',
    'actual.js': 'import {Foo as Local} from "./foo.js"; function run(){return new Local();}'
  });
  const graph = await analyze({ root, modes: ['imports', 'symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const edges = graph.edges.filter(e => e.kind === 'references');
  assert.ok(edges.some(e => nodes.get(e.from).path === 'actual.js'));
  assert.ok(!edges.some(e => ['unused.js', 'shadowed.js'].includes(nodes.get(e.from).path)));
  assert.equal(graph.edges.filter(e => e.kind === 'imports').length, 3);
});

test('default exports, namespace imports and function expressions are represented', async t => {
  const root = await fixture(t, {
    'foo.ts': 'export default class Foo {}\nexport const make = () => 1;',
    'main.ts': 'import Default from "./foo"; import * as ns from "./foo"; const run = () => {new Default(); ns.make();};'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const map = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.kind === 'references' && map.get(e.to).name === 'Foo'));
  assert.ok(graph.edges.some(e => e.kind === 'references' && map.get(e.to).name === 'make'));
  assert.ok(graph.nodes.some(n => n.name === 'run' && n.kind === 'function'));
});

test('declarations cover interfaces, traits, structs, enums and modules', async t => {
  const root = await fixture(t, {
    'types.ts': 'interface I {} type Alias = I; enum E { A }',
    'main.rs': 'mod nested {} trait T {} struct S {} enum E { A }',
    'main.go': 'package main\ntype S struct {}\ntype I interface { Run() }'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  for (const kind of ['interface', 'type', 'enum', 'module', 'trait', 'struct']) assert.ok(graph.nodes.some(n => n.kind === kind), kind);
});

test('reexport aliases and CommonJS exports resolve; private declarations do not', async t => {
  const root = await fixture(t, {
    'foo.js': 'export class Foo {} class Private {}',
    'barrel.js': 'export {Foo as Renamed} from "./foo.js";',
    'common.js': 'class Common {} module.exports = {Common};',
    'main.js': 'import {Renamed} from "./barrel.js"; import {Private} from "./foo.js"; const {Common} = require("./common"); function run(){new Renamed(); new Private(); new Common();}'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  const targets = graph.edges.filter(e => e.kind === 'references').map(e => nodes.get(e.to).name);
  assert.ok(targets.includes('Foo'));
  assert.ok(targets.includes('Common'));
  assert.ok(!targets.includes('Private'));
});

test('Go uses declared package names and associates receiver methods with structs', async t => {
  const root = await fixture(t, {
    'go.mod': 'module example.com/app\n',
    'v2/service.go': 'package service\ntype Client struct {}\nfunc (c Client) Run() {}\nfunc Make() {}',
    'main.go': 'package main\nimport "example.com/app/v2"\nfunc main(){service.Make()}'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const map = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.kind === 'references' && map.get(e.to).name === 'Make'));
  const method = graph.nodes.find(n => n.name === 'Run');
  assert.equal(map.get(method.parent).name, 'Client');
});
