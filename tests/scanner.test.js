const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { scan } = require('../lib/scanner');
const { parseOptions } = require('../lib/cli/options');

const { fixture } = require('./helpers/fixture');

test('scanner includes hidden/source files and excludes dependency/build conventions across languages', async t => {
  const root = await fixture(t, {
    '.hidden/a.py': '', '.cargo/config.toml': '[build]\ntarget-dir="rust-output"',
    '.mindtree.json': '{"exclude":["dist","build","target"]}',
    'src/a.ts': '', 'node_modules/pkg/a.js': '', '.venv/a.py': '', 'custom-env/pyvenv.cfg': '',
    'custom-env/lib/a.py': '', 'target/A.class': '', '.gradle/a.java': '', 'vendor/a.go': '',
    '.cargo/registry/a.rs': '', 'rust-output/a.rs': '', 'dist/a.js': '', 'build/a.py': '',
    'generated/a.ts': '', 'tsconfig.json': '{"compilerOptions":{"outDir":"generated"}}',
    'java/pom.xml': '<project><build><directory>compiled</directory></build></project>', 'java/compiled/A.java': ''
  });
  const result = await scan(root);
  const paths = result.nodes.map(n => n.path);
  assert.ok(paths.includes('.hidden/a.py'));
  assert.ok(paths.includes('src/a.ts'));
  assert.ok(paths.includes('.cargo/config.toml'));
  for (const name of ['node_modules', '.venv', 'custom-env', 'target', '.gradle', 'vendor', '.cargo/registry', 'rust-output', 'dist', 'build', 'generated', 'java/compiled']) assert.ok(!paths.includes(name), name);
});

test('scanner follows directory links, stops cycles, and excludes aliased dependencies', async t => {
  const root = await fixture(t, { 'src/a.rs': '', 'node_modules/pkg/a.ts': '' });
  await fs.symlink(path.join(root, 'src'), path.join(root, 'linked-src'), 'junction');
  await fs.symlink(root, path.join(root, 'src', 'cycle'), 'junction');
  await fs.symlink(path.join(root, 'node_modules'), path.join(root, 'aliased-deps'), 'junction');
  const result = await scan(root);
  assert.ok(result.nodes.some(n => n.symlink));
  assert.ok(result.diagnostics.some(d => d.code === 'symlink-alias'));
  assert.ok(!result.nodes.some(n => n.path.startsWith('aliased-deps')));
  assert.ok(result.nodes.length < 15);
});

test('CLI options compose independently and reject ambiguous invocations', () => {
  assert.deepEqual(parseOptions(['--structure', '--symbols', '--imports', '.']).modes, ['structure', 'symbols', 'imports']);
  assert.equal(parseOptions(['--symbols', '--json']).json, true);
  assert.throws(() => parseOptions(['--port', 'oops']), /integer/);
  assert.throws(() => parseOptions(['a', 'b']), /one project/);
  assert.throws(() => parseOptions(['--unknown']), /Unknown/);
});

test('unsupported languages retain their structure and source scanning does not modify files', async t => {
  const root = await fixture(t, { 'src/example.custom': 'keep this exact content', '.hidden/settings': 'hidden' });
  const before = await fs.readFile(path.join(root, 'src/example.custom'));
  const result = await scan(root);
  assert.ok(result.nodes.some(n => n.path === 'src/example.custom' && n.kind === 'file'));
  assert.deepEqual(await fs.readFile(path.join(root, 'src/example.custom')), before);
});
