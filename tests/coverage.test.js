const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');

test('analysis reports per-language file and relationship coverage without graphing installed dependencies', async t => {
  const root = await fixture(t, {
    'package.json': '{"dependencies":{"react":"1.0.0"}}',
    'main.ts': 'import React from "react"; import {missing} from "./missing"; class A { run(){ unknown(); } }',
    'notes.txt': 'not a supported source file'
  });
  const graph = await analyze({ root, modes: ['imports', 'symbols'] });
  assert.deepEqual(graph.coverage.files.byLanguage.typescript, { discovered: 1, analyzed: 1, partial: 0, failed: 0 });
  assert.equal(graph.coverage.files.unsupported, 2);
  assert.ok(graph.coverage.relationships.unresolved >= 2);
  assert.equal(graph.coverage.relationships.skipped, 1);
  assert.ok(!graph.nodes.some(node => node.name === 'react'));
  assert.ok(!graph.edges.some(edge => edge.specifier === 'react'));
});
