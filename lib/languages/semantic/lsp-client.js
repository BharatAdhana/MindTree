'use strict';
const { spawn } = require('node:child_process');
const { SEMANTIC_TIMEOUT_MS } = require('../../constants');

class LspClient {
  constructor(command, args, options = {}) {
    this.process = spawn(command, args, { ...options, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.pending = new Map(); this.nextId = 1; this.buffer = Buffer.alloc(0); this.requestHandler = () => null; this.notificationHandler = () => {};
    this.process.stdout.on('data', data => { this.buffer = Buffer.concat([this.buffer, data]); this.consume(); });
    this.process.stderr.on('data', () => {});
    const fail = error => { this.error = error; for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); } this.pending.clear(); };
    this.process.on('error', fail);
    this.process.on('exit', code => fail(new Error(`Language server exited (${code}).`)));
  }
  send(message) {
    if (this.error) throw this.error;
    const body = JSON.stringify({ jsonrpc: '2.0', ...message });
    this.process.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }
  notify(method, params) { this.send({ method, params }); }
  request(method, params) {
    if (this.error) return Promise.reject(this.error);
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Language server timed out: ${method}`)); }, SEMANTIC_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }
  consume() {
    while (true) {
      const end = this.buffer.indexOf('\r\n\r\n');
      if (end < 0) return;
      const length = Number(/Content-Length:\s*(\d+)/i.exec(this.buffer.subarray(0, end).toString())?.[1]);
      if (!Number.isFinite(length) || this.buffer.length < end + 4 + length) return;
      const message = JSON.parse(this.buffer.subarray(end + 4, end + 4 + length));
      this.buffer = this.buffer.subarray(end + 4 + length);
      if (message.method && message.id !== undefined) {
        Promise.resolve(this.requestHandler(message.method, message.params)).then(result => this.send({ id: message.id, result }), error => this.send({ id: message.id, error: { code: -32603, message: error.message } })).catch(() => {});
      } else if (message.method) {
        Promise.resolve(this.notificationHandler(message.method, message.params)).catch(() => {});
      } else if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) continue;
        clearTimeout(pending.timer); this.pending.delete(message.id);
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
    }
  }
  async close() {
    if (!this.error) { try { await this.request('shutdown', null); this.notify('exit', null); } catch (_) {} }
    if (this.process.exitCode !== null) return;
    await Promise.race([
      new Promise(resolve => this.process.once('exit', resolve)),
      new Promise(resolve => setTimeout(() => { this.process.kill(); resolve(); }, 1000))
    ]);
  }
}
module.exports = { LspClient };
