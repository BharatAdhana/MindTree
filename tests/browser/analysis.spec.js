const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { analyze } = require('../../lib/service');
const { startServer } = require('../../lib/server');
let server, root, origin, manualServer, manualOrigin;

test.beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'mindtree-browser-'));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'foo.ts'), 'export class Foo {}');
  await fs.writeFile(path.join(root, 'src', 'main.ts'), 'import {Foo} from "./foo"; export class App { run(){return new Foo()} }');
  const graph = await analyze({ root, modes: ['structure', 'imports', 'symbols'] });
  server = await startServer(graph, { port: 0, open: false });
  origin = `http://127.0.0.1:${server.address().port}`;
  manualServer = http.createServer(async (request, response) => {
    const asset = request.url === '/mindtree-state.js' ? 'mindtree-state.js' : 'index.html';
    response.setHeader('Content-Type', asset.endsWith('.js') ? 'text/javascript' : 'text/html');
    response.end(await fs.readFile(path.join(__dirname, '../../dist', asset)));
  });
  await new Promise(resolve => manualServer.listen(0, '127.0.0.1', resolve));
  manualOrigin = `http://127.0.0.1:${manualServer.address().port}`;
});
test.afterAll(async () => {
  await Promise.all([server, manualServer].filter(Boolean).map(s => new Promise(resolve => s.close(resolve))));
  if (root) await fs.rm(root, { recursive: true, force: true });
});

test('combined and standalone views filter, search and drill down without touching manual storage', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('mindtree-projects-v1', 'manual-sentinel'));
  await page.goto(origin);
  await expect(page.locator('#projectName')).not.toHaveText('Loading project…');
  await expect(page.locator('#presentation')).toHaveValue('combined');
  await expect(page.locator('#coverage')).toContainText('supported source files analyzed');
  await page.locator('#search').fill('main.ts');
  await page.locator('#tree .tree-select').filter({ hasText: 'main.ts' }).click();
  await expect(page.locator('#selectedName')).toHaveText('main.ts');
  await expect(page.locator('#graph')).toContainText('foo.ts');
  await page.locator('#relation').selectOption('references');
  await page.locator('#status').selectOption('resolved');
  await expect(page.locator('#graph')).toContainText('Foo');
  await page.locator('#presentation').selectOption('standalone');
  await expect(page.locator('#graph .contains')).toHaveCount(0);
  await page.locator('#presentation').selectOption('combined');
  await expect(page.locator('#graph .contains')).not.toHaveCount(0);
  await page.locator('#graph .graph-card').filter({ hasText: /^Foo/ }).first().click();
  await expect(page.locator('#selectedName')).toHaveText('Foo');
  await page.screenshot({ path: 'test-results/analysis-combined.png', fullPage: true });
  expect(await page.evaluate(() => localStorage.getItem('mindtree-projects-v1'))).toBe('manual-sentinel');
  expect(errors).toEqual([]);
});

test('manual editor still renders, imports structure and retains saved content after reload', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(manualOrigin);
  await expect(page.locator('#nodes .node')).not.toHaveCount(0);
  await page.evaluate(() => importStructureText('Example\n  src\n    main.ts'));
  await expect(page.locator('#nodes')).toContainText('Example');
  await page.reload();
  await expect(page.locator('#nodes')).toContainText('Example');
  expect(errors).toEqual([]);
});
