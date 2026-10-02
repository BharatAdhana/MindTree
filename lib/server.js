'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { HOST, GRAPH_ENDPOINT } = require('./constants');

async function startServer(graph, options) {
  const snapshot = JSON.stringify(graph);
  const assets = new Map([
    ['/', ['analysis.html', 'text/html; charset=utf-8']],
    ['/analysis.js', ['analysis.js', 'text/javascript; charset=utf-8']],
    ['/analysis.css', ['analysis.css', 'text/css; charset=utf-8']],
    ['/analysis-model.js', ['analysis-model.js', 'text/javascript; charset=utf-8']]
  ]);
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method !== 'GET') { response.writeHead(405); return response.end(); }
    const url = new URL(request.url, `http://${HOST}`);
    if (url.pathname === GRAPH_ENDPOINT) { response.writeHead(200, { 'Content-Type': 'application/json' }); return response.end(snapshot); }
    const asset = assets.get(url.pathname);
    if (!asset) { response.writeHead(404); return response.end('Not found'); }
    try {
      const content = await fs.readFile(path.join(__dirname, '../dist', asset[0]));
      response.writeHead(200, { 'Content-Type': asset[1] }); response.end(content);
    } catch (_) { response.writeHead(500); response.end('Analysis viewer assets are missing. Run npm run build before launching from source.'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port, HOST, resolve); });
  const url = `http://${HOST}:${server.address().port}`;
  console.log(`MindTree analysis: ${url}`);
  console.log(`${graph.stats.files} files; ${graph.diagnostics.length} diagnostics. Source project unchanged.`);
  if (options.open) {
    const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    execFile(command, args, { windowsHide: true }, error => { if (error) console.log(`Open ${url} in your browser.`); });
  }
  return server;
}
module.exports = { startServer };
