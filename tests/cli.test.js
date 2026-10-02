const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { fixture } = require('./helpers/fixture');
const bin = path.join(__dirname, '../bin/mindtree.js');
const run = args => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

test('CLI executes every standalone and combined graph mode', async t => {
  const root = await fixture(t, { 'a.ts': 'export class A {}', 'b.ts': 'import {A} from "./a"; function run(){return new A();}' });
  for (const modes of [['structure'], ['imports'], ['symbols'], ['structure', 'imports'], ['structure', 'symbols'], ['imports', 'symbols'], ['structure', 'imports', 'symbols']]) {
    const result = run([...modes.map(m => `--${m}`), root, '--json']);
    assert.equal(result.status, 0, result.stderr);
    const graph = JSON.parse(result.stdout);
    assert.deepEqual(graph.modes, modes);
    assert.equal(graph.edges.some(e => e.kind === 'imports'), modes.includes('imports'));
    assert.equal(graph.edges.some(e => e.kind === 'references'), modes.includes('symbols'));
    assert.ok(graph.nodes.some(n => n.path === 'a.ts'));
  }
});

test('help/version avoid scanning; invalid options/paths fail clearly', () => {
  assert.match(run(['--help']).stdout, /--structure/);
  assert.equal(run(['--version']).stdout.trim(), require('../package.json').version);
  assert.equal(run(['--nonesuch']).status, 1);
  assert.match(run(['--imports', path.join(__dirname, 'missing-fixture')]).stderr, /MindTree:/);
});
