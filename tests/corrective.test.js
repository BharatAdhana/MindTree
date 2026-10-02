const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');
const { scan } = require('../lib/scanner');

test('unconfigured source directories named build and out are retained', async t => {
  const root = await fixture(t, { 'src/build/Builder.ts': 'export class Builder {}', 'src/out/Writer.ts': 'export class Writer {}' });
  const inventory = await scan(root);
  assert.ok(inventory.files.some(f => f.path === 'src/build/Builder.ts'));
  assert.ok(inventory.files.some(f => f.path === 'src/out/Writer.ts'));
});

test('custom excluded outputs and preserved source paths come from project configuration', async t => {
  const root = await fixture(t, {
    '.mindtree.json': '{"exclude":["generated-custom"],"include":["src/build"]}',
    'generated-custom/generated.ts': '', 'src/build/Builder.ts': '', 'node_modules/a/index.ts': ''
  });
  const inventory = await scan(root);
  assert.ok(!inventory.nodes.some(n => n.path === 'generated-custom'));
  assert.ok(inventory.files.some(f => f.path === 'src/build/Builder.ts'));
  assert.ok(!inventory.nodes.some(n => n.path === 'node_modules'));
});

test('configuration larger than the former 1 MiB cap still controls exclusions', async t => {
  const root = await fixture(t, { 'tsconfig.json': JSON.stringify({ description: 'x'.repeat(1024 * 1024), compilerOptions: { outDir: 'custom-output' } }), 'custom-output/file.ts': '' });
  const inventory = await scan(root);
  assert.ok(!inventory.nodes.some(n => n.path === 'custom-output'));
  assert.ok(!inventory.diagnostics.some(d => d.message.includes('size limit')));
});

test('instance and inherited method calls resolve to their declarations', async t => {
  const root = await fixture(t, {
    'service.ts': 'export class Base { save() {} } export class UserService extends Base { static create(){ return new UserService(); } }',
    'main.ts': 'import {UserService} from "./service"; export function run(){ const service = new UserService(); service.save(); UserService.create(); }'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.kind === 'references' && nodes.get(e.from)?.name === 'run' && nodes.get(e.to)?.name === 'save' && e.status === 'resolved'));
  assert.ok(graph.edges.some(e => e.kind === 'references' && nodes.get(e.to)?.name === 'create'));
});

test('untyped method calls remain explicit unknowns rather than guessed declarations', async t => {
  const root = await fixture(t, { 'main.ts': 'class Service { save() {} } function run(value: any){ value.save(); }' });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(!graph.edges.some(e => e.kind === 'references' && nodes.get(e.to)?.name === 'save'));
  assert.ok(graph.diagnostics.some(d => d.code === 'reference-unresolved' && d.message.includes('value.save')));
});

test('project interfaces and implementations remain connected through constructor injection', async t => {
  const root = await fixture(t, {
    'repository.ts': 'export interface Repository { save(): void } export class SqlRepository implements Repository { save() {} }',
    'consumer.ts': 'import {Repository, SqlRepository} from "./repository"; export class Consumer { constructor(private repo: Repository) {} run(){ this.repo.save(); } } const app = new Consumer(new SqlRepository());'
  });
  const graph = await analyze({ root, modes: ['imports', 'symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.evidence === 'implements' && nodes.get(e.from)?.name === 'SqlRepository' && nodes.get(e.to)?.name === 'Repository'));
  assert.ok(graph.edges.some(e => e.evidence === 'type' && nodes.get(e.to)?.name === 'Repository'));
  assert.ok(graph.edges.some(e => e.evidence === 'call' && nodes.get(e.from)?.name === 'run' && nodes.get(e.to)?.name === 'save' && nodes.get(nodes.get(e.to)?.parent)?.name === 'Repository'));
});

test('union receiver targets are possible and do not masquerade as a proven implementation', async t => {
  const root = await fixture(t, { 'main.ts': 'class A { save() {} } class B { save() {} } function run(service: A | B){ service.save(); }' });
  const graph = await analyze({ root, modes: ['symbols'] });
  const calls = graph.edges.filter(e => e.evidence === 'call' && e.name === 'service.save');
  assert.equal(calls.length, 2);
  assert.ok(calls.every(e => e.status === 'possible'));
});

test('constant expression imports resolve while runtime-selected imports stay unknown', async t => {
  const root = await fixture(t, {
    'service.ts': 'export class Service {}',
    'main.ts': 'const prefix = "./"; const target = prefix + "service"; import(target); import(getPluginName());'
  });
  const graph = await analyze({ root, modes: ['imports'] });
  assert.ok(graph.edges.some(e => e.kind === 'imports' && e.to === 'path:service.ts' && e.status === 'resolved'));
  assert.ok(graph.diagnostics.some(d => d.code === 'import-unresolved'));
});

test('installed packages stay outside the graph while their declarations can inform project analysis', async t => {
  const root = await fixture(t, {
    'package.json': '{"dependencies":{"external-lib":"*"}}',
    'node_modules/external-lib/package.json': '{"name":"external-lib","types":"index.d.ts"}',
    'node_modules/external-lib/index.d.ts': 'export interface Remote { send(): void }',
    'app.ts': 'import {Remote} from "external-lib"; class App { constructor(private remote: Remote) {} run(){this.remote.send();} }'
  });
  const graph = await analyze({ root, modes: ['imports', 'symbols'] });
  assert.ok(!graph.nodes.some(n => n.path.includes('node_modules') || n.name === 'external-lib' || n.name === 'Remote'));
  assert.ok(graph.nodes.some(n => n.name === 'App'));
  assert.ok(!graph.diagnostics.some(d => d.code === 'reference-unresolved' && d.message.includes('remote.send')));
});

test('a source file larger than the former 4 MiB cutoff is analyzed', async t => {
  const root = await fixture(t, { 'large.ts': '/*' + 'x'.repeat(4 * 1024 * 1024) + '*/\nexport class Large { run() {} }' });
  const graph = await analyze({ root, modes: ['symbols'] });
  assert.ok(graph.nodes.some(n => n.name === 'Large'));
  assert.ok(!graph.diagnostics.some(d => d.code === 'source-size'));
});

test('Nest-style explicit tokens connect project consumers to provider classes without package nodes', async t => {
  const root = await fixture(t, {
    'package.json': '{"dependencies":{"@nestjs/common":"*"}}',
    'tokens.ts': 'export const STORE = Symbol("STORE");',
    'app.ts': 'import {Inject, Module} from "@nestjs/common"; import {STORE} from "./tokens"; interface Store { save(): void } class SqlStore implements Store { save() {} } class Consumer { constructor(@Inject(STORE) private store: Store) {} run(){this.store.save();} } @Module({providers:[{provide:STORE,useClass:SqlStore}, Consumer]}) class App {}'
  });
  const graph = await analyze({ root, modes: ['imports', 'symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.evidence === 'di-inject' && nodes.get(e.to)?.name === 'STORE'));
  assert.ok(graph.edges.some(e => e.evidence === 'di-provider' && nodes.get(e.from)?.name === 'STORE' && nodes.get(e.to)?.name === 'SqlStore'));
  assert.ok(!graph.nodes.some(n => n.name === '@nestjs/common'));
});

test('Vite output paths are read without executing config and source build directories survive', async t => {
  const root = await fixture(t, {
    'package.json': '{"scripts":{"build":"vite build"}}',
    'vite.config.ts': 'throw new Error("DO NOT EXECUTE"); export default {build:{outDir:"web-output"}};',
    'web-output/index.js': '', 'src/build/Builder.ts': ''
  });
  const inventory = await scan(root);
  assert.ok(!inventory.nodes.some(n => n.path === 'web-output'));
  assert.ok(inventory.nodes.some(n => n.path === 'src/build/Builder.ts'));
});
