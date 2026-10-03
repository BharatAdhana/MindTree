const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');

test('Go binds receiver calls to concrete and interface method declarations without building the project', async t => {
  const root = await fixture(t, {
    'go.mod': 'module example.com/app\n',
    'store.go': 'package main\ntype Store interface { Save() }\ntype SQLStore struct{}\nfunc (s *SQLStore) Save(){}\nfunc viaInterface(store Store){ store.Save() }\nfunc concrete(){ db := &SQLStore{}; db.Save() }',
    'main.go': 'package main\nfunc main(){ concrete() }'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const calls = graph.edges.filter(edge => edge.engine === 'go-source' && edge.evidence === 'call');
  assert.ok(calls.some(edge => nodes.get(edge.from)?.name === 'viaInterface' && nodes.get(edge.to)?.name === 'Save' && nodes.get(nodes.get(edge.to).parent)?.name === 'Store'), JSON.stringify(graph.diagnostics));
  assert.ok(calls.some(edge => nodes.get(edge.from)?.name === 'concrete' && nodes.get(edge.to)?.name === 'Save' && nodes.get(nodes.get(edge.to).parent)?.name === 'SQLStore'), JSON.stringify(graph.diagnostics));
});
