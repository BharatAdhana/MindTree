const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const state = require('../mindtree-state');

test('legacy saved projects migrate without losing manual content', () => {
  const result = state.normalizeState({
    nodes: [
      { id: state.ROOT_ID, name: 'Example', type: 'folder', children: ['a', 'b'] },
      { id: 'a', name: 'a.js', type: 'file', parent: state.ROOT_ID, children: [] },
      { id: 'b', name: 'b.js', type: 'file', parent: state.ROOT_ID, children: [] }
    ],
    comments: { a: 'Keep this' }, code: { a: 'export class A {}' },
    connections: [{ id: 'manual', from: 'a', to: 'b', label: 'uses', relationType: 'references' }]
  });
  assert.equal(result.fatal, false);
  assert.equal(result.state.schemaVersion, 2);
  assert.equal(result.state.comments.a, 'Keep this');
  assert.equal(result.state.code.a, 'export class A {}');
  assert.equal(result.state.connections[0].label, 'uses');
  const restored = state.deserializeState(state.serializeState(result.state).json);
  assert.deepEqual(restored.state, result.state);
});

test('future schemas are rejected and structure text remains importable', () => {
  assert.equal(state.normalizeState({ schemaVersion: 999 }).fatal, true);
  const tree = state.parseStructureText('Project\n  src\n    app.js\n  README.md');
  assert.equal(tree.name, 'Project');
  assert.equal(tree.children[0].children[0].name, 'app.js');
  assert.equal(tree.children[1].type, 'file');
});

test('browser state asset matches the shared state module', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '../mindtree-state.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../public/mindtree-state.js'), 'utf8'));
});

test('base executable serves the built app, assets and fallback and opens the same URL', async t => {
  const bin = path.join(__dirname, '../bin/mindtree.js');
  let server;
  const messages = [];
  const opened = [];
  const fakeHttp = { createServer(handler) {
    server = http.createServer(handler);
    const listen = server.listen.bind(server);
    server.listen = (_port, callback) => listen(0, '127.0.0.1', callback);
    return server;
  } };
  vm.runInNewContext(fs.readFileSync(bin, 'utf8'), {
    require(name) {
      if (name === 'http') return fakeHttp;
      if (name === 'child_process') return { exec(command, callback) { opened.push(command); callback(null); } };
      return require(name);
    },
    __dirname: path.dirname(bin), process: { platform: 'win32', argv: ['node', bin] },
    console: { log: value => messages.push(value) }
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.listening ? resolve() : server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const root = await fetch(origin);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /Project Mind Graph/);
  const asset = await fetch(`${origin}/mindtree-state.js`);
  assert.match(await asset.text(), /SCHEMA_VERSION = 2/);
  assert.equal((await fetch(`${origin}/missing-page`)).status, 200);
  assert.deepEqual(opened, ['start "" "http://localhost:3000"']);
  assert.ok(messages.includes('MindTree is running!'));
});
