'use strict';
const { parseOptions } = require('./options');

const HELP = `MindTree — optional source analysis

  mindtree                                  Open the existing manual editor
  mindtree --structure [path]                Folder/file hierarchy
  mindtree --imports [path]                  File/module imports
  mindtree --symbols [path]                  Declarations and symbol references
  mindtree --structure --imports --symbols [path]

Options can be combined; path defaults to the current directory.
  --json           Write graph JSON; do not start a server or browser
  --no-open        Serve analysis without opening a browser
  --port N         Analysis server port (default 3000)
  --help, -h       Show this help
  --version, -v    Show package version

Analysis reads source without building or executing the project.
Dependency directories and configured build output are excluded; hidden paths and
symbolic-link targets are included with cycle detection.
`;

async function run(args) {
  const options = parseOptions(args);
  if (options.help) return process.stdout.write(HELP);
  if (options.version) return process.stdout.write(`${require('../../package.json').version}\n`);
  const graph = await require('../service').analyze(options);
  if (options.json) return process.stdout.write(`${JSON.stringify(graph)}\n`);
  const { startServer } = require('../server');
  await startServer(graph, options);
}
module.exports = { run, HELP };
