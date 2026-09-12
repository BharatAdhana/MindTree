/* Shared, dependency-free state rules for the browser app and Node tests. */
(function (global) {
  "use strict";

  const SCHEMA_VERSION = 2;
  const ROOT_ID = "__project_root__";
  const VALID_TYPES = new Set(["folder", "file"]);
  const VALID_LINE_STYLES = new Set(["solid", "dashed", "dotted", "strong"]);

  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const asObject = value => isObject(value) ? value : {};
  const asString = value => typeof value === "string" ? value : "";
  const finite = value => typeof value === "number" && Number.isFinite(value);
  const uniqueId = (value, used, prefix) => {
    const base = asString(value).trim() || prefix;
    let candidate = base, index = 2;
    while (used.has(candidate)) candidate = `${base}-${index++}`;
    used.add(candidate);
    return candidate;
  };
  const clone = value => JSON.parse(JSON.stringify(value));

  function normalizeMap(source, ids, convert) {
    const result = {};
    Object.entries(asObject(source)).forEach(([id, value]) => {
      if (!ids.has(id)) return;
      const next = convert(value);
      if (next !== undefined) result[id] = next;
    });
    return result;
  }

  function normalizePosition(value) {
    if (!isObject(value) || !finite(value.x) || !finite(value.y)) return undefined;
    return { x: value.x, y: value.y };
  }

  function normalizeLineStyle(value) {
    if (!isObject(value)) return undefined;
    const style = VALID_LINE_STYLES.has(value.style) ? value.style : undefined;
    const color = typeof value.color === "string" ? value.color : undefined;
    const label = typeof value.label === "string" ? value.label : undefined;
    const relationType = typeof value.relationType === "string" ? value.relationType : undefined;
    if (!style && !color && label === undefined && !relationType) return undefined;
    return { 
      ...(label === undefined ? {} : { label }), 
      ...(style ? { style } : {}), 
      ...(color ? { color } : {}),
      ...(relationType ? { relationType } : {})
    };
  }

  function rebuildPaths(nodes, rootId) {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const queue = [{ id: rootId, path: byId.get(rootId)?.name || "Project" }];
    const seen = new Set();
    while (queue.length) {
      const { id, path } = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const item = byId.get(id);
      if (!item) continue;
      item.path = path;
      item.children.forEach(childId => {
        const child = byId.get(childId);
        if (child && !seen.has(childId)) queue.push({ id: childId, path: `${path}/${child.name}` });
      });
    }
  }

  function normalizeState(raw, options = {}) {
    const rootId = options.rootId || ROOT_ID;
    const fallback = isObject(options.fallbackState) ? options.fallbackState : {
      nodes: [{ id: rootId, name: "Project", type: "folder", parent: null, children: [] }],
      roots: [rootId]
    };
    const input = isObject(raw) ? raw : {};
    const suppliedVersion = Number.isInteger(input.schemaVersion) ? input.schemaVersion : 1;
    if (suppliedVersion > SCHEMA_VERSION) {
      return { state: null, changed: false, issues: ["unsupported-schema"], fatal: true };
    }

    const issues = [];
    const inputNodes = Array.isArray(input.nodes) ? input.nodes : Array.isArray(fallback.nodes) ? fallback.nodes : [];
    if (!Array.isArray(input.nodes) && raw !== undefined) issues.push("missing-nodes");
    const seenIds = new Set();
    const nodes = [];
    inputNodes.forEach((entry, index) => {
      if (!isObject(entry)) { issues.push("invalid-node"); return; }
      const id = asString(entry.id).trim();
      if (!id || seenIds.has(id)) { issues.push("duplicate-or-invalid-node-id"); return; }
      seenIds.add(id);
      nodes.push({
        ...entry,
        id,
        name: asString(entry.name).trim() || "Untitled node",
        type: VALID_TYPES.has(entry.type) ? entry.type : "folder",
        parent: typeof entry.parent === "string" ? entry.parent : null,
        children: Array.isArray(entry.children) ? entry.children.filter(child => typeof child === "string") : [],
        _index: index
      });
    });

    if (!nodes.length) {
      issues.push("empty-node-set");
      const fallbackNodes = Array.isArray(fallback.nodes) ? fallback.nodes : [];
      fallbackNodes.forEach((entry, index) => {
        if (!isObject(entry) || !asString(entry.id).trim() || seenIds.has(entry.id)) return;
        seenIds.add(entry.id);
        nodes.push({ ...entry, id: entry.id, name: asString(entry.name).trim() || "Untitled node", type: VALID_TYPES.has(entry.type) ? entry.type : "folder", parent: typeof entry.parent === "string" ? entry.parent : null, children: Array.isArray(entry.children) ? entry.children.filter(child => typeof child === "string") : [], _index: index });
      });
    }

    let root = nodes.find(item => item.id === rootId);
    if (!root) {
      root = { id: rootId, name: "Project", type: "folder", path: "Project", parent: null, children: [], _index: -1 };
      nodes.unshift(root);
      seenIds.add(rootId);
      issues.push("created-project-root");
    }
    root.parent = null;
    root.type = "folder";
    root.children = Array.isArray(root.children) ? root.children : [];

    const byId = new Map(nodes.map(item => [item.id, item]));
    const parentOf = {};
    nodes.forEach(item => {
      if (item.id === rootId) return;
      const parent = item.parent;
      if (parent && parent !== item.id && byId.has(parent)) parentOf[item.id] = parent;
      else if (parent) issues.push("invalid-parent");
    });

    nodes.forEach(parent => {
      const childIds = [...new Set(parent.children)];
      if (childIds.length !== parent.children.length) issues.push("duplicate-child-id");
      childIds.forEach(childId => {
        if (childId === parent.id || !byId.has(childId) || childId === rootId) {
          issues.push("invalid-child");
          return;
        }
        if (!parentOf[childId]) parentOf[childId] = parent.id;
        else if (parentOf[childId] !== parent.id) issues.push("multiple-parent-reference");
      });
    });

    nodes.forEach(item => {
      if (item.id !== rootId && !parentOf[item.id]) {
        parentOf[item.id] = rootId;
        issues.push("orphan-attached-to-root");
      }
    });

    nodes.forEach(start => {
      if (start.id === rootId) return;
      const order = [];
      const at = new Map();
      let current = start.id;
      while (current && current !== rootId && byId.has(current)) {
        if (at.has(current)) {
          const cycle = order.slice(at.get(current));
          parentOf[cycle[0]] = rootId;
          issues.push("cycle-broken");
          break;
        }
        at.set(current, order.length);
        order.push(current);
        current = parentOf[current];
      }
    });

    nodes.forEach(item => { item.children = []; });
    nodes.forEach(item => {
      if (item.id === rootId) return;
      let parentId = parentOf[item.id];
      if (!parentId || parentId === item.id || !byId.has(parentId)) parentId = rootId;
      item.parent = parentId;
      byId.get(parentId).children.push(item.id);
    });
    root.parent = null;
    rebuildPaths(nodes, rootId);
    nodes.forEach(item => delete item._index);

    const validIds = new Set(nodes.map(item => item.id));
    const edgeStyles = {};
    Object.entries(asObject(input.edgeStyles)).forEach(([key, value]) => {
      const match = /^tree:(.+)->(.+)$/.exec(key);
      if (!match || !validIds.has(match[1]) || !validIds.has(match[2])) {
        issues.push("invalid-edge-style");
        return;
      }
      const style = normalizeLineStyle(value);
      if (style) edgeStyles[key] = style;
    });

    const connectionIds = new Set();
    const connectionPairs = new Set();
    const connections = [];
    (Array.isArray(input.connections) ? input.connections : []).forEach((entry, index) => {
      if (!isObject(entry) || !validIds.has(entry.from) || !validIds.has(entry.to) || entry.from === entry.to) {
        issues.push("invalid-connection");
        return;
      }
      const pair = `${entry.from}->${entry.to}`;
      if (connectionPairs.has(pair)) { issues.push("duplicate-connection"); return; }
      connectionPairs.add(pair);
      const id = uniqueId(entry.id, connectionIds, `recovered-connection-${index + 1}`);
      const style = normalizeLineStyle(entry);
      connections.push({ id, from: entry.from, to: entry.to, ...(style || {}) });
    });

    const noteIds = new Set();
    const notes = [];
    (Array.isArray(input.notes) ? input.notes : []).forEach((entry, index) => {
      if (!isObject(entry)) { issues.push("invalid-note"); return; }
      const id = uniqueId(entry.id, noteIds, `recovered-note-${index + 1}`);
      const attachedId = typeof entry.nodeId === "string" && validIds.has(entry.nodeId) ? entry.nodeId : null;
      if (entry.nodeId && !attachedId) issues.push("detached-invalid-note-anchor");
      notes.push({
        id,
        nodeId: attachedId,
        text: typeof entry.text === "string" ? entry.text : "",
        offsetX: finite(entry.offsetX) ? entry.offsetX : 105,
        offsetY: finite(entry.offsetY) ? entry.offsetY : -85,
        x: finite(entry.x) ? entry.x : 120,
        y: finite(entry.y) ? entry.y : 120,
        positioned: entry.positioned === true
      });
    });

    const state = {
      ...input,
      schemaVersion: SCHEMA_VERSION,
      nodes,
      roots: Array.from(new Set([rootId, ...(suppliedVersion >= 2 && Array.isArray(input.roots) ? input.roots : []).filter(id => {
        if (!validIds.has(id)) return false;
        const n = nodes.find(node => node.id === id);
        return n && (n.parent === rootId || n.parent === null);
      })])),
      comments: normalizeMap(input.comments, validIds, value => typeof value === "string" ? value : undefined),
      colors: normalizeMap(input.colors, validIds, value => typeof value === "string" ? value : undefined),
    textColors: normalizeMap(input.textColors, validIds, value => typeof value === "string" ? value : undefined),
    nodeDimensions: normalizeMap(input.nodeDimensions, validIds, value => typeof value === "object" && typeof value.width === "number" && typeof value.height === "number" ? value : undefined),
      code: normalizeMap(input.code, validIds, value => typeof value === "string" ? value : undefined),
      collapsed: normalizeMap(input.collapsed, validIds, value => typeof value === "boolean" ? value : undefined),
      manualPositions: normalizeMap(input.manualPositions, validIds, normalizePosition),
      branchOffsets: normalizeMap(input.branchOffsets, validIds, normalizePosition),
      edgeStyles,
      connections,
      notes,
      view: { ...asObject(input.view), direction: input.view?.direction === "tb" ? "tb" : "lr" }
    };
    state.collapsed[rootId] = false;
    const changed = suppliedVersion !== SCHEMA_VERSION || issues.length > 0 || JSON.stringify(input) !== JSON.stringify(state);
    return { state, changed, issues, fatal: false };
  }

  function removeSubtree(rawState, id, options = {}) {
    const normalized = normalizeState(rawState, options);
    if (normalized.fatal || !normalized.state || id === (options.rootId || ROOT_ID)) return { ...normalized, removed: [] };
    const state = normalized.state;
    const byId = new Map(state.nodes.map(node => [node.id, node]));
    if (!byId.has(id)) return { ...normalized, removed: [] };
    const removed = new Set();
    const stack = [id];
    while (stack.length) {
      const currentId = stack.pop();
      if (removed.has(currentId)) continue;
      removed.add(currentId);
      const item = byId.get(currentId);
      if (item) item.children.forEach(childId => { if (byId.has(childId)) stack.push(childId); });
    }
    const next = clone(state);
    next.nodes = next.nodes.filter(node => !removed.has(node.id)).map(node => ({ ...node, parent: removed.has(node.parent) ? null : node.parent, children: node.children.filter(childId => !removed.has(childId)) }));
    ["comments", "colors", "textColors", "code", "collapsed", "manualPositions", "branchOffsets", "nodeDimensions"].forEach(key => {
      if (next[key]) {
        Object.keys(next[key]).forEach(keyId => { if (removed.has(keyId)) delete next[key][keyId]; });
      }
    });
    next.notes = (next.notes || []).filter(note => !removed.has(note.nodeId));
    next.connections = (next.connections || []).filter(connection => !removed.has(connection.from) && !removed.has(connection.to));
    Object.keys(next.edgeStyles || {}).forEach(key => {
      if ([...removed].some(nodeId => key.includes(`:${nodeId}->`) || key.endsWith(`->${nodeId}`))) delete next.edgeStyles[key];
    });
    const result = normalizeState(next, options);
    return { ...result, removed: [...removed] };
  }

  function parseStructureText(text) {
    const rawLines = String(text || "").replace(/\r/g, "").split("\n");
    const lines = rawLines.filter(line => line.trim());
    const parsed = [];
    function cleanName(name) {
      return String(name || "").replace(/\s+$/g, "").replace(/^\s+/, "").replace(/^[-*+]{1,}\s+/, "").replace(/^\d+[.)]\s+/, "").replace(/^📁\s*/u, "").replace(/^📄\s*/u, "").replace(/^\*\*(.*?)\*\*$/, "$1").replace(/\s+$/g, "").trim();
    }
    function asciiDepth(prefix) {
      return (prefix.replace(/\t/g, "    ").match(/(?:│   |\|   |    )/g) || []).length + 1;
    }
    lines.forEach(raw => {
      if (/^\s*(?:```|>|#?\s*Comments Index|#?\s*Project Mind Graph)/i.test(raw)) return;
      let name = "", depth = 0;
      const ascii = raw.match(/^(.*?)(?:├──|└──|├─|└─|\|--|`--|--\s+)(.+)$/);
      if (ascii) { depth = asciiDepth(ascii[1]); name = ascii[2]; }
      else {
        const heading = raw.match(/^(\s*)(#+)\s+(.+)$/);
        if (heading) { depth = heading[2].length - 1; name = heading[3]; }
        else {
          const markdown = raw.match(/^(\s*)(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
          if (markdown) { depth = Math.floor(markdown[1].replace(/\t/g, "    ").length / 2); name = markdown[2]; }
          else { const leading = (raw.match(/^\s*/) || [""])[0].replace(/\t/g, "    "); depth = Math.floor(leading.length / 2); name = raw.trim(); }
        }
      }
      name = cleanName(name).replace(/\/$/, "");
      if (!name || /^(comments index|project structure|file structure|tree|structure)$/i.test(name) || /^[-_=]{3,}$/.test(name) || /^[│|├└\s\-_+`\.]+$/.test(name)) return;
      const type = /\.(?:[a-z0-9]{1,16})(?:\?.*)?$/i.test(name) || /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|dockerfile|makefile)$/i.test(name) ? "file" : "folder";
      parsed.push({ name, type, depth });
    });
    if (!parsed.length) return null;
    const firstDepth = parsed[0].depth;
    parsed.forEach(item => { item.depth = Math.max(0, item.depth - firstDepth); });
    const useInputRoot = parsed.filter(item => item.depth === 0).length === 1;
    const root = useInputRoot ? { name: parsed[0].name, type: parsed[0].type, children: [] } : { name: "Project", type: "folder", children: [] };
    const source = useInputRoot ? parsed.slice(1).map(item => ({ ...item, depth: Math.max(0, item.depth - 1) })) : parsed;
    const levels = [root];
    source.forEach(item => {
      const depth = Math.max(0, Math.min(item.depth, levels.length - 1));
      while (levels.length > depth + 1) levels.pop();
      const child = { name: item.name, type: item.type, children: [] };
      (levels[levels.length - 1] || root).children.push(child);
      levels.push(child);
    });
    return root;
  }

  function revealPath(state, targetId) {
    if (!state || !Array.isArray(state.nodes)) return { revealed: [] };
    const byId = new Map(state.nodes.map(node => [node.id, node]));
    const target = byId.get(targetId);
    if (!target) return { revealed: [] };
    
    const revealed = [];
    const seen = new Set();
    
    let currentId = target.parent;
    while (currentId && byId.has(currentId)) {
      if (seen.has(currentId)) break;
      seen.add(currentId);
      
      if (state.collapsed && state.collapsed[currentId]) {
        revealed.push(currentId);
        state.collapsed[currentId] = false;
      }
      currentId = byId.get(currentId).parent;
    }
    
    return { revealed };
  }

  function serializeState(state, options = {}) {
    const result = normalizeState(state, options);
    if (result.fatal) return { ...result, json: null };
    return { ...result, json: JSON.stringify(result.state) };
  }

  function deserializeState(raw, options = {}) {
    if (typeof raw !== "string") return { state: null, changed: false, issues: ["invalid-serialized-state"], fatal: true };
    try { return normalizeState(JSON.parse(raw), options); }
    catch (_) { return { state: null, changed: false, issues: ["invalid-json"], fatal: true }; }
  }

  const api = { SCHEMA_VERSION, ROOT_ID, normalizeState, removeSubtree, parseStructureText, rebuildPaths, serializeState, deserializeState, revealPath };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.MindTreeState = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
