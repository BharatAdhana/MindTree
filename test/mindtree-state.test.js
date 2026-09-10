const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SCHEMA_VERSION,
  ROOT_ID,
  normalizeState,
  removeSubtree,
  parseStructureText,
  serializeState,
  deserializeState,
  revealPath
} = require("../mindtree-state.js");

function base(nodes, extra = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodes: [{ id: ROOT_ID, name: "Project", type: "folder", parent: null, children: [] }, ...nodes],
    roots: [ROOT_ID], comments: {}, colors: {}, code: {}, collapsed: {}, manualPositions: {}, branchOffsets: {}, edgeStyles: {}, connections: [], notes: [], view: { direction: "lr" },
    ...extra
  };
}

function item(state, id) { return state.nodes.find(node => node.id === id); }

test("normalizes fresh and legacy state into schema version 2", () => {
  const legacy = { nodes: [{ id: "a", name: "A", type: "folder", parent: null, children: [] }], roots: ["a"] };
  const result = normalizeState(legacy);
  assert.equal(result.fatal, false);
  assert.equal(result.state.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(result.state.roots, [ROOT_ID]);
  assert.equal(item(result.state, "a").parent, ROOT_ID);
  assert.equal(result.state.notes.length, 0);
});

test("removes duplicate IDs, invalid child references, and repairs parent/child mismatch deterministically", () => {
  const result = normalizeState(base([
    { id: "a", name: "A", type: "folder", parent: ROOT_ID, children: ["b", "b", "missing"] },
    { id: "b", name: "B", type: "file", parent: "a", children: [] },
    { id: "a", name: "Duplicate", type: "file", parent: ROOT_ID, children: [] }
  ]));
  assert.equal(result.state.nodes.filter(node => node.id === "a").length, 1);
  assert.deepEqual(item(result.state, "a").children, ["b"]);
  assert.equal(item(result.state, "b").parent, "a");
});

test("attaches recoverable orphans to the synthetic project root", () => {
  const result = normalizeState(base([{ id: "orphan", name: "Orphan", type: "file", parent: "missing", children: [] }]));
  assert.equal(item(result.state, "orphan").parent, ROOT_ID);
  assert.deepEqual(item(result.state, ROOT_ID).children, ["orphan"]);
});

test("breaks self-parenting and parent cycles without recursion", () => {
  const result = normalizeState(base([
    { id: "self", name: "Self", type: "folder", parent: "self", children: ["self"] },
    { id: "a", name: "A", type: "folder", parent: "b", children: ["b"] },
    { id: "b", name: "B", type: "folder", parent: "a", children: ["a"] }
  ]));
  assert.equal(item(result.state, "self").parent, ROOT_ID);
  const parents = new Map(result.state.nodes.map(node => [node.id, node.parent]));
  for (const id of ["a", "b"]) {
    const seen = new Set(); let current = id;
    while (current && current !== ROOT_ID) { assert.equal(seen.has(current), false); seen.add(current); current = parents.get(current); }
  }
});

test("filters stale connection and position metadata while preserving invalid note content as unattached", () => {
  const result = normalizeState(base([{ id: "a", name: "A", type: "file", parent: ROOT_ID, children: [] }], {
    connections: [{ id: "bad", from: "a", to: "missing" }],
    notes: [{ id: "note", nodeId: "missing", text: "Keep me", x: 50, y: 60 }],
    manualPositions: { a: { x: 1, y: 2 }, missing: { x: 3, y: 4 } },
    branchOffsets: { a: { x: 5, y: 6 }, missing: { x: 7, y: 8 } }
  }));
  assert.equal(result.state.connections.length, 0);
  assert.equal(result.state.notes[0].nodeId, null);
  assert.equal(result.state.notes[0].text, "Keep me");
  assert.deepEqual(result.state.manualPositions, { a: { x: 1, y: 2 } });
  assert.deepEqual(result.state.branchOffsets, { a: { x: 5, y: 6 } });
});

test("subtree deletion clears every node-scoped persisted reference", () => {
  const source = base([
    { id: "a", name: "A", type: "folder", parent: ROOT_ID, children: ["b"] },
    { id: "b", name: "B", type: "file", parent: "a", children: [] },
    { id: "keep", name: "Keep", type: "file", parent: ROOT_ID, children: [] }
  ], {
    comments: { a: "comment", b: "child", keep: "keep" }, colors: { a: "#fff" }, code: { b: "code" }, collapsed: { a: true },
    manualPositions: { a: { x: 1, y: 1 }, b: { x: 2, y: 2 } }, branchOffsets: { a: { x: 3, y: 3 } },
    notes: [{ id: "n", nodeId: "b", text: "note" }], connections: [{ id: "c", from: "a", to: "keep" }], edgeStyles: { "tree:a->b": { style: "dotted" } }
  });
  const result = removeSubtree(source, "a");
  assert.deepEqual(result.removed.sort(), ["a", "b"]);
  assert.deepEqual(result.state.nodes.map(node => node.id).sort(), [ROOT_ID, "keep"].sort());
  assert.deepEqual(result.state.comments, { keep: "keep" });
  assert.deepEqual(result.state.manualPositions, {});
  assert.equal(result.state.notes.length, 0);
  assert.equal(result.state.connections.length, 0);
  assert.deepEqual(result.state.edgeStyles, {});
});

test("valid normalized state remains structurally unchanged", () => {
  const source = base([{ id: "a", name: "A", type: "file", parent: ROOT_ID, children: [] }], { comments: { a: "ok" }, notes: [{ id: "note", nodeId: "a", text: "note", offsetX: 1, offsetY: 2, x: 3, y: 4, positioned: true }] });
  item(source, ROOT_ID).children = ["a"];
  const result = normalizeState(source);
  assert.equal(result.state.nodes.length, source.nodes.length);
  const expectedA = { ...item(source, "a"), path: "Project/A" };
  assert.deepEqual(item(result.state, "a"), expectedA);
  assert.deepEqual(result.state.notes, source.notes);
});

test("serialization and malformed deserialization are safe", () => {
  const source = base([{ id: "a", name: "A", type: "file", parent: ROOT_ID, children: [] }]);
  item(source, ROOT_ID).children = ["a"];
  const serialized = serializeState(source);
  assert.equal(serialized.fatal, false);
  assert.equal(deserializeState(serialized.json).state.nodes.length, 2);
  assert.equal(deserializeState("{bad json").fatal, true);
});

test("ASCII, Markdown, and indented imports retain their hierarchy", () => {
  const ascii = parseStructureText("project/\n├── src/\n│   └── app.js\n└── README.md");
  const markdown = parseStructureText("- project\n  - src\n    - app.js");
  const indented = parseStructureText("project\n  src\n    app.js");
  assert.equal(ascii.name, "project");
  assert.equal(ascii.children[0].children[0].name, "app.js");
  assert.equal(markdown.children[0].children[0].name, "app.js");
  assert.equal(indented.children[0].children[0].name, "app.js");
  assert.equal(parseStructureText("\n---\n# Project Mind Graph\n"), null);
});

test("revealPath expands only necessary ancestors safely", () => {
  const source = base([
    { id: "a", name: "A", type: "folder", parent: ROOT_ID, children: ["b"] },
    { id: "b", name: "B", type: "folder", parent: "a", children: ["c"] },
    { id: "c", name: "C", type: "file", parent: "b", children: [] },
  ], { collapsed: { [ROOT_ID]: false, a: true, b: true, c: false } });
  
  const result = revealPath(source, "c");
  assert.deepEqual(result.revealed.sort(), ["a", "b"].sort());
  assert.equal(source.collapsed["a"], false);
  assert.equal(source.collapsed["b"], false);
  
  // Missing target
  assert.deepEqual(revealPath(source, "invalid").revealed, []);
});

test("disconnected node becomes root/unconnected and retains state", () => {
  const source = base([
    { id: "a", name: "A", type: "folder", parent: ROOT_ID, children: ["b"] },
    { id: "b", name: "B", type: "folder", parent: "a", children: ["c"] },
    { id: "c", name: "C", type: "file", parent: "b", children: [] }
  ], {
    edgeStyles: { "tree:a->b": { style: "dotted" } }
  });
  
  // Simulate the UI action of disconnectSelected() for node "b":
  item(source, "a").children = [];
  item(source, "b").parent = ROOT_ID;
  source.roots.push("b");
  
  const result = normalizeState(source);
  
  // Node remains in state
  assert.ok(item(result.state, "b"));
  
  // Node is unattached (parent is ROOT_ID)
  assert.equal(item(result.state, "b").parent, ROOT_ID);
  
  // Node is in roots
  assert.ok(result.state.roots.includes("b"));
  
  // Subtree is intact
  assert.deepEqual(item(result.state, "b").children, ["c"]);
  assert.equal(item(result.state, "c").parent, "b");
  
  // Old parent no longer references node
  assert.deepEqual(item(result.state, "a").children, []);
  
  // Previous edge style is retained for future reconnection (not cleared)
  assert.deepEqual(result.state.edgeStyles["tree:a->b"], { style: "dotted" });
});

test("explicit Move Under creates parent relationship (reconnect)", () => {
  const source = base([
    { id: "a", name: "A", type: "folder", parent: ROOT_ID, children: [] },
    { id: "b", name: "B", type: "folder", parent: ROOT_ID, children: ["c"] },
    { id: "c", name: "C", type: "file", parent: "b", children: [] }
  ], {
    roots: [ROOT_ID, "b"]
  });
  
  // b is at root. We move b under a.
  item(source, "b").parent = "a";
  item(source, "a").children.push("b");
  
  const result = normalizeState(source);
  
  assert.equal(item(result.state, "b").parent, "a");
  assert.deepEqual(item(result.state, "a").children, ["b"]);
  assert.ok(!result.state.roots.includes("b")); // Should be removed from roots since it has a parent in m
});

