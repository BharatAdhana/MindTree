const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');
const { startServer } = require('../lib/server');
const model = require('../public/analysis-model');

test('viewer bounds neighbors, filters relationship kinds and rejects invalid graphs', () => {
  const nodes = [{ id: 'root', kind: 'folder', name: 'Root', path: '.' }, { id: 'a', kind: 'file', name: 'A', path: 'a', parent: 'root' }];
  const edges = [];
  for (let i = 0; i < 60; i++) { nodes.push({ id: `b${i}`, kind: 'file', name: `B${i}`, path: `b${i}` }); edges.push({ id: `e${i}`, kind: i % 2 ? 'references' : 'imports', from: 'a', to: `b${i}` }); }
  const index = model.indexGraph({ schemaVersion: 1, nodes, edges });
  edges[0].status = 'possible';
  const view = model.neighborhood(index, 'root', { kind: 'imports' });
  assert.equal(view.edges.length, 30);
  assert.equal(view.outgoing.length, model.LIMITS.neighborhood);
  assert.equal(view.hidden, 30 - model.LIMITS.neighborhood);
  assert.equal(model.neighborhood(index, 'root', { kind: 'imports', status: 'possible' }).edges.length, 1);
  assert.equal(model.search(index, 'A')[0].id, 'a');
  assert.throws(() => model.indexGraph({ schemaVersion: 99, nodes, edges }), /Unsupported/);
  assert.throws(() => model.indexGraph({ schemaVersion: 1, nodes, edges: [{ from: 'a', to: 'missing' }] }), /endpoint/);
});

test('analysis server serves only the snapshot and allowlisted viewer assets', async t => {
  const root = await fixture(t, { 'a.js': 'export class A {}' });
  const graph = await analyze({ root, modes: ['structure', 'symbols'] });
  const server = await startServer(graph, { port: 0, open: false });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.match(await (await fetch(origin)).text(), /Codebase explorer/);
  assert.equal((await (await fetch(`${origin}/graph.json`)).json()).schemaVersion, 1);
  for (const asset of ['analysis.js', 'analysis.css', 'analysis-model.js']) assert.equal((await fetch(`${origin}/${asset}`)).status, 200);
  assert.equal((await fetch(`${origin}/package.json`)).status, 404);
  assert.equal((await fetch(`${origin}/graph.json`, { method: 'POST' })).status, 405);
});
