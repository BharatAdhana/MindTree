const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');

test('Java resolves interface dispatch, implementations and constructors without executing project classes', async t => {
  const root = await fixture(t, {
    'App.java': 'interface Store { void save(); } class SqlStore implements Store { public void save(){} static { try { new java.io.File("EXECUTED").createNewFile(); } catch(Exception e){} } } class Consumer { private final Store store; Consumer(Store store){this.store=store;} void run(){store.save();} } class App { public static void main(String[] x){new Consumer(new SqlStore()).run();} }'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const edges = graph.edges.filter(edge => edge.engine === 'javac');
  assert.ok(edges.some(edge => nodes.get(edge.from)?.name === 'run' && nodes.get(edge.to)?.name === 'save' && nodes.get(nodes.get(edge.to).parent)?.name === 'Store'), JSON.stringify(graph.diagnostics));
  assert.ok(edges.some(edge => edge.evidence === 'implements' && nodes.get(edge.from)?.name === 'SqlStore' && nodes.get(edge.to)?.name === 'Store'));
  assert.ok(edges.some(edge => edge.evidence === 'construct' && nodes.get(edge.to)?.name === 'Consumer'));
  await assert.rejects(fs.access(path.join(root, 'EXECUTED')));
});
