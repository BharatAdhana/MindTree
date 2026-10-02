(async function () {
  'use strict';
  const model = window.MindTreeAnalysis;
  const $ = id => document.getElementById(id);
  const SVG = 'http://www.w3.org/2000/svg';
  let graph, index, selected, zoom = 1, treeLimit = model.LIMITS.tree;
  const expanded = new Set();
  const symbols = new Set(['class', 'function', 'method', 'struct', 'interface', 'trait', 'enum', 'type']);
  const layout = Object.freeze({ cardWidth: 230, cardHeight: 64, gap: 84, columnGap: 80, left: 30, top: 55 });
  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function svg(tag, attrs, text) {
    const el = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function select(id) { if (!index.nodes.has(id)) return; selected = id; render(); }
  function option(select, value, text) { const el = element('option', text); el.value = value; select.append(el); }
  function showTree() {
    const tree = $('tree'); tree.replaceChildren();
    const query = $('search').value.trim();
    $('treeLabel').textContent = query ? 'SEARCH RESULTS' : 'PROJECT STRUCTURE';
    let count = 0;
    function row(node, depth, searchable) {
      const wrapper = element('div', undefined, `tree-row${node.id === selected ? ' active' : ''}`);
      wrapper.style.paddingLeft = `${Math.min(depth, 12) * 12}px`;
      const children = index.children.get(node.id) || [];
      const toggle = element('button', children.length && !searchable ? (expanded.has(node.id) ? '▾' : '▸') : '', 'toggle');
      toggle.disabled = !children.length || searchable;
      toggle.setAttribute('aria-label', `${expanded.has(node.id) ? 'Collapse' : 'Expand'} ${node.name}`);
      if (children.length) toggle.setAttribute('aria-expanded', expanded.has(node.id));
      toggle.onclick = () => { expanded.has(node.id) ? expanded.delete(node.id) : expanded.add(node.id); showTree(); };
      const button = element('button', undefined, 'tree-select');
      button.append(element('span', node.kind === 'folder' ? '▱' : symbols.has(node.kind) ? '◇' : '·', 'kind-icon'), document.createTextNode(node.name));
      button.title = `${node.path}${node.line ? `:${node.line}` : ''} · ${node.kind}`;
      button.onclick = () => select(node.id);
      wrapper.append(toggle, button); tree.append(wrapper);
    }
    if (query) {
      const results = model.search(index, query);
      results.forEach(n => row(n, 0, true));
      if (!results.length) tree.append(element('p', 'No matching nodes.', 'empty'));
      if (results.length === model.LIMITS.search) tree.append(element('p', `Showing the first ${results.length} matches. Refine your search.`, 'empty'));
    } else {
      const stack = [{ id: 'project:root', depth: 0 }];
      while (stack.length && count < treeLimit) {
        const { id, depth } = stack.pop(), node = index.nodes.get(id);
        if (!node) continue;
        row(node, depth, false); count++;
        if (expanded.has(id)) {
          const children = index.children.get(id) || [];
          for (let i = children.length - 1; i >= 0; i--) stack.push({ id: children[i].id, depth: depth + 1 });
        }
      }
      if (stack.length) { const more = element('button', 'Show more entries'); more.onclick = () => { treeLimit += model.LIMITS.tree; showTree(); }; tree.append(more); }
    }
  }
  function breadcrumb() {
    const chain = [], seen = new Set(); let node = index.nodes.get(selected);
    while (node && !seen.has(node.id)) { seen.add(node.id); chain.unshift(node); node = index.nodes.get(node.parent); }
    $('breadcrumb').replaceChildren();
    chain.forEach((n, i) => { if (i) $('breadcrumb').append(document.createTextNode(' / ')); const b = element('button', n.name); b.onclick = () => select(n.id); $('breadcrumb').append(b); });
  }
  function card(node, x, y, subtitle) {
    const group = svg('g', { class: `graph-card${node.id === selected ? ' selected' : ''}`, transform: `translate(${x} ${y})`, tabindex: '0', role: 'button', 'aria-label': `${node.name}, ${node.kind}. Select to explore.` });
    group.append(svg('rect', { width: layout.cardWidth, height: layout.cardHeight, rx: 11 }));
    group.append(svg('title', {}, `${node.name}\n${node.path}${node.line ? `:${node.line}` : ''}`));
    const shorten = (text, length) => text.length > length ? `${text.slice(0, length - 1)}…` : text;
    group.append(svg('text', { x: 15, y: 27, class: 'node-title' }, shorten(node.name, 27)));
    group.append(svg('text', { x: 15, y: 47, class: 'node-subtitle' }, shorten(subtitle || `${node.kind}${node.status ? ` · ${node.status}` : ''}${node.line ? ` · line ${node.line}` : ''}`, 35)));
    group.onclick = () => select(node.id);
    group.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(node.id); } };
    return group;
  }
  function edge(x1, y1, x2, y2, kind) {
    return svg('path', { class: `graph-edge ${kind}`, d: `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`, 'marker-end': kind === 'contains' ? 'url(#contains-arrow)' : 'url(#relation-arrow)' });
  }
  function draw() {
    const node = index.nodes.get(selected), mode = $('presentation').value;
    const neighborhood = model.neighborhood(index, selected, { kind: $('relation').value, external: $('external').checked, status: $('status').value });
    const showRelations = mode !== 'structure';
    const showHierarchy = mode !== 'standalone';
    const incoming = showRelations ? neighborhood.incoming : [], outgoing = showRelations ? neighborhood.outgoing : [];
    const children = showHierarchy ? (index.children.get(selected) || []).slice(0, model.LIMITS.children) : [];
    const columns = children.length ? 3 : 1 + Number(incoming.length > 0) + Number(outgoing.length > 0);
    const centerX = layout.left + (incoming.length || children.length ? layout.cardWidth + layout.columnGap : 0);
    const rightX = centerX + layout.cardWidth + layout.columnGap;
    const childColumns = [layout.left, layout.left + layout.cardWidth + layout.columnGap, layout.left + 2 * (layout.cardWidth + layout.columnGap)];
    const rows = Math.max(incoming.length, outgoing.length, 1);
    const centerY = layout.top + Math.floor((rows - 1) / 2) * layout.gap;
    const height = Math.max(430, layout.top + rows * layout.gap + (children.length ? Math.ceil(children.length / 3) * layout.gap + 60 : 0));
    const canvas = $('graph'); canvas.replaceChildren();
    canvas.setAttribute('viewBox', `0 0 ${columns * layout.cardWidth + (columns - 1) * layout.columnGap + layout.left * 2} ${height}`);
    canvas.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    canvas.style.width = `${zoom * 100}%`;
    canvas.style.height = `${height * zoom}px`;
    const defs = svg('defs');
    for (const [id, color] of [['relation-arrow', '#aea2db'], ['contains-arrow', '#c6c9d4']]) {
      const marker = svg('marker', { id, markerWidth: 8, markerHeight: 8, refX: 7, refY: 4, orient: 'auto' }); marker.append(svg('path', { d: 'M0 0 L8 4 L0 8 Z', fill: color })); defs.append(marker);
    }
    canvas.append(defs);
    if (showRelations) {
      if (incoming.length) canvas.append(svg('text', { x: layout.left, y: 27, class: 'graph-heading' }, 'REFERENCED BY'));
      if (outgoing.length) canvas.append(svg('text', { x: rightX, y: 27, class: 'graph-heading' }, 'DEPENDS ON'));
    }
    incoming.forEach((entry, i) => canvas.append(edge(layout.left + layout.cardWidth, layout.top + i * layout.gap + layout.cardHeight / 2, centerX, centerY + layout.cardHeight / 2, 'relation')));
    outgoing.forEach((entry, i) => canvas.append(edge(centerX + layout.cardWidth, centerY + layout.cardHeight / 2, rightX, layout.top + i * layout.gap + layout.cardHeight / 2, 'relation')));
    const childTop = layout.top + rows * layout.gap + 40;
    children.forEach((child, i) => {
      const x = childColumns[i % 3], y = childTop + Math.floor(i / 3) * layout.gap;
      canvas.append(edge(centerX + layout.cardWidth / 2, centerY + layout.cardHeight, x + layout.cardWidth / 2, y, 'contains'));
    });
    canvas.append(card(node, centerX, centerY));
    incoming.forEach((entry, i) => canvas.append(card(entry.node, layout.left, layout.top + i * layout.gap, `${entry.node.kind} · ${entry.count} relationship${entry.count > 1 ? 's' : ''}`)));
    outgoing.forEach((entry, i) => canvas.append(card(entry.node, rightX, layout.top + i * layout.gap, `${entry.node.status || entry.node.kind} · ${entry.count} relationship${entry.count > 1 ? 's' : ''}`)));
    children.forEach((child, i) => canvas.append(card(child, childColumns[i % 3], childTop + Math.floor(i / 3) * layout.gap)));
    const hiddenChildren = showHierarchy ? Math.max(0, (index.children.get(selected) || []).length - children.length) : 0;
    $('notice').textContent = showRelations ? `${neighborhood.edges.length} matching relationships in this selection${neighborhood.internal ? `; ${neighborhood.internal} internal — select a child or a relationship below to explore` : ''}.${neighborhood.hidden ? ` ${neighborhood.hidden} additional neighbors are available in the relationship list.` : ''}${hiddenChildren ? ` ${hiddenChildren} more children are in the explorer.` : ''}` : `${(index.children.get(selected) || []).length} direct children. Select a child to explore deeper.${hiddenChildren ? ` Showing ${children.length}; use the explorer for the rest.` : ''}`;
    $('graphHint').textContent = showHierarchy ? 'Dashed lines: contains · arrows: dependencies · select any card to focus' : 'Incoming ← selected → outgoing · select any card to focus';
    inspect(node, neighborhood);
  }
  function inspect(node, neighborhood) {
    $('selectedName').textContent = node.name;
    $('selectedKind').textContent = `${node.kind}${node.language ? ` · ${node.language}` : ''}`;
    $('selectedPath').textContent = `${node.path}${node.line ? `:${node.line}:${node.column || 1}` : ''}`;
    $('selectionHelp').textContent = node.status ? `${node.status === 'external' ? 'External dependency' : 'Unresolved module'}: source is not part of the resolved inventory.` : node.symlink ? 'Symbolic-link entry. Repeated targets are scanned once.' : 'Relationships include this node and its descendants. Source location is shown above.';
    $('relationshipCount').textContent = `${neighborhood.edges.length} relationship${neighborhood.edges.length === 1 ? '' : 's'}`;
    $('relationships').replaceChildren();
    let shown = 0;
    function more() {
      const old = $('relationships').querySelector('.show-more'); if (old) old.remove();
      const batch = neighborhood.edges.slice(shown, shown + model.LIMITS.details);
      for (const relationship of batch) {
        const from = index.nodes.get(relationship.from), to = index.nodes.get(relationship.to);
        const button = element('button', `${from.name} → ${to.name}`, 'relationship');
        button.append(element('small', `${relationship.kind} · ${relationship.status || 'resolved'}${relationship.evidence ? ` · ${relationship.evidence}` : ''} · ${from.path}${relationship.line ? `:${relationship.line}` : ''}`));
        button.title = `${from.path} → ${to.path}`;
        button.onclick = () => select(relationship.from === selected ? relationship.to : relationship.from);
        $('relationships').append(button);
      }
      shown += batch.length;
      if (shown < neighborhood.edges.length) { const button = element('button', 'Show more relationships', 'show-more'); button.onclick = more; $('relationships').append(button); }
      if (!neighborhood.edges.length) $('relationships').append(element('p', 'No resolved relationships match this selection and filter.', 'empty'));
    }
    more();
  }
  function render() { showTree(); breadcrumb(); draw(); }
  try {
    const response = await fetch('/graph.json');
    if (!response.ok) throw new Error(`Could not load analysis (${response.status}).`);
    graph = await response.json(); index = model.indexGraph(graph);
    selected = 'project:root'; expanded.add(selected);
    $('projectName').textContent = graph.project.name;
    $('summary').textContent = `${graph.stats.files} files · ${graph.stats.folders} folders · ${graph.nodes.filter(n => symbols.has(n.kind)).length} symbols`;
    const coverage = graph.coverage;
    if (coverage) {
      const files = coverage.files, relationships = coverage.relationships;
      $('coverage').textContent = `${files.analyzed}/${files.supported} supported source files analyzed${files.partial ? ` · ${files.partial} partial parse` : ''}${files.failed ? ` · ${files.failed} failed` : ''} · relationships: ${relationships.resolved} resolved, ${relationships.possible} possible, ${relationships.unresolved} unresolved, ${relationships.skipped} skipped external`;
      $('coverage').title = Object.entries(files.byLanguage || {}).map(([language, value]) => `${language}: ${value.analyzed}/${value.discovered} analyzed${value.partial ? `, ${value.partial} partial` : ''}`).join('\n');
    } else $('coverage').hidden = true;
    const hasRelations = graph.modes.some(m => m === 'imports' || m === 'symbols');
    if (graph.modes.includes('structure')) option($('presentation'), 'structure', 'Structure');
    if (hasRelations) { option($('presentation'), 'standalone', 'Relationships only'); option($('presentation'), 'combined', 'Structure + relationships'); }
    $('presentation').value = hasRelations ? graph.modes.includes('structure') ? 'combined' : 'standalone' : 'structure';
    if (graph.modes.includes('imports') && graph.modes.includes('symbols')) option($('relation'), 'all', 'Imports + symbols');
    if (graph.modes.includes('imports')) option($('relation'), 'imports', 'Imports');
    if (graph.modes.includes('symbols')) option($('relation'), 'references', 'Symbols');
    for (const [value, label] of [['all', 'All statuses'], ['resolved', 'Resolved'], ['possible', 'Possible'], ['unresolved', 'Unresolved']]) option($('status'), value, label);
    if (!hasRelations) { option($('relation'), 'all', 'None'); $('relationControl').hidden = true; $('statusControl').hidden = true; $('externalControl').hidden = true; }
    if (!graph.modes.includes('structure') && hasRelations) selected = graph.edges.find(e => e.kind !== 'contains')?.from || graph.nodes.find(n => n.kind === 'file')?.id || selected;
    $('search').oninput = showTree;
    $('collapse').onclick = () => { expanded.clear(); expanded.add('project:root'); showTree(); };
    for (const id of ['presentation', 'relation', 'status', 'external']) $(id).onchange = draw;
    $('zoomIn').onclick = () => { zoom = Math.min(3, zoom + .2); draw(); };
    $('zoomOut').onclick = () => { zoom = Math.max(.5, zoom - .2); draw(); };
    $('fit').onclick = () => { zoom = 1; draw(); $('graphScroll').scrollTo(0, 0); };
    $('diagnosticSummary').textContent = `${graph.diagnostics.length} diagnostics · unresolved imports and analysis limits`;
    let diagnosticCount = 0;
    const showDiagnostics = () => {
      const more = $('diagnostics').querySelector('button'); if (more) more.remove();
      graph.diagnostics.slice(diagnosticCount, diagnosticCount + model.LIMITS.details).forEach(d => $('diagnostics').append(element('div', `${d.path}${d.line ? `:${d.line}` : ''} · ${d.code}: ${d.message}`, 'diagnostic')));
      diagnosticCount += model.LIMITS.details;
      if (diagnosticCount < graph.diagnostics.length) { const b = element('button', 'Show more diagnostics'); b.onclick = showDiagnostics; $('diagnostics').append(b); }
    };
    showDiagnostics();
    $('download').disabled = false;
    $('download').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })); const a = element('a'); a.href = url; a.download = `${graph.project.name}-mindtree.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 0); };
    render();
  } catch (error) { $('notice').textContent = error.message; $('notice').classList.add('error'); $('projectName').textContent = 'Analysis could not be displayed'; }
})();
