const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('./helpers/fixture');
const { analyze } = require('../lib/service');
const analyzer = path.resolve(__dirname, '../node_modules/.cache/mindtree-tools/rust-analyzer/rust-analyzer.exe');

test('Rust resolves receiver methods and trait implementation relationships without Cargo execution', { skip: !fs.existsSync(analyzer) }, async t => {
  process.env.MINDTREE_RUST_ANALYZER = analyzer;
  t.after(() => delete process.env.MINDTREE_RUST_ANALYZER);
  const root = await fixture(t, {
    'Cargo.toml': '[package]\nname="app"\nversion="0.1.0"\nedition="2021"\nbuild="build.rs"',
    'build.rs': 'fn main(){ std::fs::write("EXECUTED", "bad").unwrap(); }',
    'src/main.rs': 'trait Store { fn save(&self); } struct SqlStore; impl Store for SqlStore { fn save(&self) {} } fn run<T: Store>(store: &T){ store.save(); } fn main(){ run(&SqlStore); }'
  });
  const graph = await analyze({ root, modes: ['symbols'] });
  const nodes = new Map(graph.nodes.map(n => [n.id, n]));
  assert.ok(graph.edges.some(e => e.engine === 'rust-analyzer' && nodes.get(e.from)?.name === 'run' && nodes.get(e.to)?.name === 'save'), JSON.stringify(graph.diagnostics));
  await assert.rejects(require('node:fs/promises').access(path.join(root, 'EXECUTED')));
});
