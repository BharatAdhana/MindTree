'use strict';
const { scan } = require('./scanner');
const { createGraph } = require('./graph');

async function analyze(options) {
  const inventory = await scan(options.root);
  const graph = createGraph(inventory, options.modes);
  if (options.modes.some(mode => mode === 'imports' || mode === 'symbols')) {
    const { analyzeSources } = require('./languages');
    await analyzeSources(inventory, graph, options.modes);
  }
  return graph;
}
module.exports = { analyze };
