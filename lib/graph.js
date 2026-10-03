'use strict';
const path = require('node:path');
const { GRAPH_SCHEMA_VERSION } = require('./constants');

function createGraph(inventory, modes) {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    project: { name: path.basename(inventory.root), root: inventory.root },
    modes: [...modes], nodes: [...inventory.nodes],
    edges: inventory.nodes.filter(n => n.parent).map(n => ({ id: `contains:${n.parent}:${n.id}`, from: n.parent, to: n.id, kind: 'contains' })),
    diagnostics: [...inventory.diagnostics], stats: { ...inventory.stats }
  };
}
module.exports = { createGraph };
