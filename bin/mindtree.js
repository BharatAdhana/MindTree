#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const DIST_DIR = path.join(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((request, response) => {
  let filePath = path.join(DIST_DIR, request.url === '/' ? 'index.html' : request.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(DIST_DIR, 'index.html'), (err, fallbackContent) => {
          if (err) {
            response.writeHead(500);
            response.end('Error loading application\n');
          } else {
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end(fallbackContent, 'utf-8');
          }
        });
      } else {
        response.writeHead(500);
        response.end('Server error: ' + error.code + ' ..\n');
      }
    } else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`MindTree is running!`);
  console.log(`Open http://localhost:${PORT} in your browser to view the application.`);
  
  const startUrl = `http://localhost:${PORT}`;
  let command;
  
  switch (process.platform) {
    case 'darwin':
      command = `open ${startUrl}`;
      break;
    case 'win32':
      command = `start "" "${startUrl}"`;
      break;
    default:
      command = `xdg-open ${startUrl}`;
      break;
  }
  
  exec(command, (err) => {
    if (err) {
      console.log(`(Could not automatically open browser. Please navigate to the URL manually.)`);
    }
  });
});
