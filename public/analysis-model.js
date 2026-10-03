(function (global) {
  'use strict';
  const LIMITS = Object.freeze({ neighborhood: 12, children: 16, search: 100, tree: 250, details: 80 });
  function indexGraph(graph) {
    if (graph.schemaVersion !== 1 || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('Unsupported analysis graph format.');
    const nodes = new Map(), children = new Map(), adjacent = new Map();
    for (const node of graph.nodes) {
      if (!node.id || nodes.has(node.id)) throw new Error('Invalid or duplicate graph node.');
      nodes.set(node.id, node);
    }
    for (const node of graph.nodes) {
      if (node.parent && nodes.has(node.parent)) {
        if (!children.has(node.parent)) children.set(node.parent, []);
        children.get(node.parent).push(node);
      }
    }
    for (const edge of graph.edges) {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error('Graph relationship has a missing endpoint.');
      if (edge.kind === 'contains') continue;
      for (const id of new Set([edge.from, edge.to])) {
        if (!adjacent.has(id)) adjacent.set(id, []);
        adjacent.get(id).push(edge);
      }
    }
    return { graph, nodes, children, adjacent };
  }
  function descendants(index, id) {
    const result = new Set(), stack = [id];
    while (stack.length) {
      const current = stack.pop();
      if (result.has(current)) continue;
      result.add(current);
      for (const node of index.children.get(current) || []) stack.push(node.id);
    }
    return result;
  }
  function relations(index, id, kind = 'all', external = true, status = 'all') {
    const scope = descendants(index, id), found = new Map();
    for (const member of scope) for (const edge of index.adjacent.get(member) || []) {
      if (kind !== 'all' && edge.kind !== kind) continue;
      if (status !== 'all' && (edge.status || 'resolved') !== status) continue;
      if (!external && (index.nodes.get(edge.from).status || index.nodes.get(edge.to).status)) continue;
      found.set(edge.id, edge);
    }
    return { scope, edges: [...found.values()] };
  }
  function neighborhood(index, id, options = {}) {
    const { scope, edges } = relations(index, id, options.kind, options.external, options.status);
    const incoming = new Map(), outgoing = new Map();
    let internal = 0;
    for (const edge of edges) {
      if (scope.has(edge.from) && scope.has(edge.to)) { internal++; continue; }
      const map = scope.has(edge.from) ? outgoing : incoming;
      const other = scope.has(edge.from) ? edge.to : edge.from;
      const entry = map.get(other) || { node: index.nodes.get(other), count: 0, kinds: new Set() };
      entry.count++; entry.kinds.add(edge.kind); map.set(other, entry);
    }
    const sorted = map => [...map.values()].sort((a, b) => b.count - a.count || a.node.name.localeCompare(b.node.name));
    return { incoming: sorted(incoming).slice(0, LIMITS.neighborhood), outgoing: sorted(outgoing).slice(0, LIMITS.neighborhood), hidden: Math.max(0, incoming.size - LIMITS.neighborhood) + Math.max(0, outgoing.size - LIMITS.neighborhood), internal, edges };
  }
  function search(index, query) {
    const term = query.trim().toLowerCase();
    return [...index.nodes.values()].filter(node => `${node.name} ${node.path} ${node.kind}`.toLowerCase().includes(term)).slice(0, LIMITS.search);
  }
  const api = { LIMITS, indexGraph, descendants, relations, neighborhood, search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.MindTreeAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
