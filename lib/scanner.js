'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { EXCLUDED_DIRECTORIES, GENERATED_EXTENSIONS, EXTENSIONS } = require('./constants');
const { directoryConfiguration, inside, slash } = require('./configuration');

const excludedNames = new Set(EXCLUDED_DIRECTORIES);
const generated = new Set(GENERATED_EXTENSIONS);
function excludedConvention(file) {
  const parts = slash(file).split('/');
  return parts.some(part => excludedNames.has(part) || /\.(?:egg-info|dist-info)$/.test(part)) ||
    /(?:^|\/)\.cargo\/(?:registry|git)(?:\/|$)/.test(slash(file)) ||
    /(?:^|\/)pkg\/mod(?:\/|$)/.test(slash(file));
}

async function scan(root) {
  root = path.resolve(root);
  if (!(await fs.stat(root)).isDirectory()) throw new Error(`Project path must be a directory: ${root}`);
  const nodes = [], files = [], diagnostics = [], configurations = new Map(), excludedPaths = new Set(), includedPaths = new Set(), explicitExcluded = new Set(), exclusions = [];
  const realDirectories = new Map();
  const stats = { excluded: 0, files: 0, folders: 0, symlinks: 0 };
  for (const value of [process.env.CARGO_TARGET_DIR, process.env.GOMODCACHE]) if (value) excludedPaths.add(path.resolve(root, value));
  const isExcluded = absolute => excludedConvention(path.relative(root, absolute)) || [...explicitExcluded].some(p => inside(p, absolute)) ||
    (![...includedPaths].some(p => inside(p, absolute) || inside(absolute, p)) && [...excludedPaths].some(p => inside(p, absolute)));
  const pending = [{ absolute: root, relative: '', parent: null }];
  while (pending.length) {
    const item = pending.pop();
    const id = item.relative ? `path:${slash(item.relative)}` : 'project:root';
    try {
      const linkStat = await fs.lstat(item.absolute);
      const symbolic = linkStat.isSymbolicLink();
      const real = symbolic ? await fs.realpath(item.absolute) : item.absolute;
      const stat = symbolic ? await fs.stat(real) : linkStat;
      if (item.parent && (isExcluded(item.absolute) || (symbolic && (excludedConvention(real) || isExcluded(real))))) { stats.excluded++; exclusions.push({ path: slash(item.relative), reason: 'dependency-or-configured-output' }); continue; }
      if (!stat.isDirectory() && (!stat.isFile() || generated.has(path.extname(item.absolute).toLowerCase()))) { stats.excluded++; exclusions.push({ path: slash(item.relative), reason: 'generated-binary-or-special-file' }); continue; }
      if (stat.isDirectory() && item.parent) {
        try { await fs.access(path.join(real, 'pyvenv.cfg')); stats.excluded++; exclusions.push({ path: slash(item.relative), reason: 'python-environment' }); continue; } catch (_) { /* Not a Python environment. */ }
      }
      const node = { id, name: item.parent ? path.basename(item.absolute) : path.basename(root), kind: stat.isDirectory() ? 'folder' : 'file', path: slash(item.relative) || '.', parent: item.parent };
      if (symbolic) { node.symlink = true; stats.symlinks++; }
      nodes.push(node);
      if (stat.isFile()) {
        stats.files++;
        node.language = EXTENSIONS[path.extname(item.absolute).toLowerCase()] || null;
        files.push({ ...node, absolute: item.absolute, real, size: stat.size });
        continue;
      }
      stats.folders++;
      const canonical = await fs.realpath(real);
      if (realDirectories.has(canonical)) {
        node.aliasOf = realDirectories.get(canonical);
        diagnostics.push({ code: 'symlink-alias', path: node.path, message: 'Directory target was already scanned; traversal is not repeated.' });
        continue;
      }
      realDirectories.set(canonical, id);
      const config = await directoryConfiguration(item.absolute, diagnostics);
      configurations.set(item.absolute, config);
      config.excluded.forEach(p => excludedPaths.add(p));
      config.included.forEach(p => includedPaths.add(p));
      config.explicitExcluded.forEach(p => explicitExcluded.add(p));
      const entries = (await fs.readdir(item.absolute, { withFileTypes: true })).sort((a, b) => Number(a.isSymbolicLink()) - Number(b.isSymbolicLink()) || a.name.localeCompare(b.name, 'en'));
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        pending.push({ absolute: path.join(item.absolute, entry.name), relative: path.join(item.relative, entry.name), parent: id });
      }
    } catch (error) {
      if (!item.parent) throw error;
      diagnostics.push({ code: 'scan-read', path: slash(item.relative), message: error.message });
    }
  }
  return { root, nodes, files, diagnostics, configurations, stats, exclusions };
}
module.exports = { scan, excludedConvention };
