const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');

test('Python receiver and inherited methods resolve without executing project startup hooks', async t => {
  const root = await fixture(t, {
    'repository.py': 'class Base:\n    def save(self):\n        pass\nclass Repository(Base):\n    pass\n',
    'main.py': 'from repository import Repository\ndef run():\n    service = Repository()\n    service.save()\n',
    'sitecustomize.py': 'open("EXECUTED", "w").write("bad")\nraise RuntimeError("do not run project")'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.engine === 'pyright' && nodes.get(e.from)?.name === 'run' && nodes.get(e.to)?.name === 'save'), JSON.stringify(graph.diagnostics));
  await assert.rejects(fs.access(path.join(root, 'EXECUTED')));
});

test('Python annotated interface/Protocol dependencies point to project declarations', async t => {
  const root = await fixture(t, {
    'main.py': 'from typing import Protocol\nclass Store(Protocol):\n    def save(self) -> None: ...\nclass Consumer:\n    def __init__(self, store: Store):\n        self.store = store\n    def run(self):\n        self.store.save()\n'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.engine === 'pyright' && nodes.get(e.from)?.name === 'run' && nodes.get(e.to)?.name === 'save'));
  assert.ok(!graph.nodes.some(n => n.name === 'typing'));
});
