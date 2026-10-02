'use strict';
const path = require('node:path');
const { DEFAULT_PORT, MODES } = require('../constants');

function parseOptions(args, cwd = process.cwd()) {
  const options = { modes: [], root: cwd, port: DEFAULT_PORT, open: true, json: false };
  let target;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (MODES.some(mode => arg === `--${mode}`)) options.modes.push(arg.slice(2));
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--no-open') options.open = false;
    else if (arg === '--json') options.json = true;
    else if (arg === '--port') {
      const value = args[++i];
      if (!/^\d+$/.test(value || '') || Number(value) < 1 || Number(value) > 65535) throw new Error('--port requires an integer from 1 to 65535.');
      options.port = Number(value);
    } else if (arg === '--') {
      if (target !== undefined || args.length !== i + 2) throw new Error('Provide exactly one project path after --.');
      target = args[++i];
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}. Use --help.`);
    else if (target !== undefined) throw new Error('Provide only one project path.');
    else target = arg;
  }
  options.modes = [...new Set(options.modes)];
  options.root = path.resolve(cwd, target || '.');
  if (!options.help && !options.version && !options.modes.length) throw new Error('Choose --structure, --imports or --symbols, or run without arguments for the manual editor.');
  return options;
}

module.exports = { parseOptions };
