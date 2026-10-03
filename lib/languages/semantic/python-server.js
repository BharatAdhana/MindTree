'use strict';
// This boundary prevents interpreter discovery from loading project startup hooks.
// The language server itself only receives definition requests, never executeCommand.
const childProcess = require('node:child_process');
const execute = childProcess.execFileSync;
childProcess.execFileSync = function (_command, args, options) {
  const index = args?.indexOf('-c');
  const code = index >= 0 ? args[index + 1] : '';
  if (!code || !/sys\.(?:path|version_info)/.test(code)) throw new Error('Only isolated interpreter metadata queries are allowed.');
  return execute(process.env.MINDTREE_PYTHON_EXECUTABLE || 'python', ['-I', '-S', '-c', code], { ...options, shell: false, cwd: require('node:os').tmpdir() });
};
childProcess.spawn = childProcess.exec = childProcess.execFile = childProcess.spawnSync = () => { throw new Error('Running project code is disabled in source analysis.'); };
require('pyright/langserver.index.js');
