'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const jsonc = require('jsonc-parser');
const toml = require('smol-toml');
const { XMLParser } = require('fast-xml-parser');

const CONFIG_FILES = Object.freeze(['.mindtree.json', 'package.json', 'tsconfig.json', 'jsconfig.json', 'pyproject.toml', 'go.mod', 'go.work', 'Cargo.toml', '.cargo/config.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'setup.cfg']);
const slash = value => value.split(path.sep).join('/');
const inside = (root, candidate) => { const rel = path.relative(root, candidate); return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel)); };

async function readConfig(file, diagnostics) {
  try {
    const text = await fs.readFile(file, 'utf8');
    if (/\.json$/.test(file)) {
      const errors = [];
      const result = jsonc.parse(text, errors, { allowTrailingComma: true });
      if (errors.length) throw new Error('Invalid JSON/JSONC');
      return result;
    }
    if (/\.toml$/.test(file)) return toml.parse(text);
    if (/\.xml$/.test(file)) return new XMLParser({ processEntities: false }).parse(text);
    return text;
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') diagnostics.push({ code: 'config-read', path: file, message: error.message });
    return null;
  }
}

async function loadTsConfig(file, diagnostics, seen = new Set()) {
  const absolute = path.resolve(file);
  if (seen.has(absolute)) { diagnostics.push({ code: 'config-cycle', path: file, message: 'Cyclic configuration inheritance.' }); return {}; }
  seen.add(absolute);
  const config = await readConfig(file, diagnostics) || {};
  let parent = {};
  if (typeof config.extends === 'string') {
    if (config.extends.startsWith('.')) {
      let parentFile = path.resolve(path.dirname(file), config.extends);
      if (!path.extname(parentFile)) parentFile += '.json';
      parent = await loadTsConfig(parentFile, diagnostics, seen);
    } else diagnostics.push({ code: 'config-extends', path: file, message: `Package-based extends is not read from excluded dependencies: ${config.extends}` });
  }
  const opts = config.compilerOptions || {};
  const baseUrl = opts.baseUrl ? path.resolve(path.dirname(file), opts.baseUrl) : parent.baseUrl || path.dirname(file);
  return {
    ...parent, ...config, baseUrl,
    compilerOptions: { ...parent.compilerOptions, ...opts },
    pathBase: opts.paths ? baseUrl : parent.pathBase || baseUrl,
    outputPaths: [...(parent.outputPaths || []), ...['outDir', 'declarationDir', 'outFile'].filter(k => typeof opts[k] === 'string').map(k => path.resolve(path.dirname(file), opts[k]))]
  };
}

async function directoryConfiguration(directory, diagnostics) {
  const result = { directory, excluded: [], included: [], explicitExcluded: [], configs: {} };
  const entries = await Promise.all(CONFIG_FILES.map(async name => [name, await readConfig(path.join(directory, name), diagnostics)]));
  const addOutput = value => {
    if (typeof value !== 'string' || !value || /\$|\{|\*/.test(value)) return;
    const absolute = path.resolve(directory, value);
    if (absolute !== directory) result.excluded.push(absolute);
  };
  for (const [name, config] of entries) {
    if (config === null) continue;
    result.configs[name] = config;
    if (name === 'package.json') for (const output of await require('./configuration-outputs').nodeBuildOutputs(directory, config, diagnostics)) addOutput(output);
    if (name === 'pyproject.toml' && (config.project || config['build-system'] || config.tool?.poetry)) { addOutput('build'); addOutput('dist'); }
    if (name === '.mindtree.json') {
      for (const [key, destination] of [['exclude', result.explicitExcluded], ['include', result.included]]) {
        if (config[key] !== undefined && (!Array.isArray(config[key]) || config[key].some(value => typeof value !== 'string' || !value.trim()))) throw new Error(`${path.join(directory, name)}: ${key} must be an array of non-empty relative paths.`);
        for (const entry of config[key] || []) {
          const absolute = path.resolve(directory, entry);
          if (!inside(directory, absolute) || absolute === directory || /[*?]/.test(entry)) throw new Error(`${path.join(directory, name)}: ${key} paths must be literal child paths within the project.`);
          destination.push(absolute);
        }
      }
    }
    if (name === 'tsconfig.json' || name === 'jsconfig.json') {
      const loaded = await loadTsConfig(path.join(directory, name), diagnostics);
      result.configs[name] = loaded;
      loaded.outputPaths.forEach(p => result.excluded.push(p));
    }
    if (name === 'Cargo.toml') addOutput('target');
    if (name === '.cargo/config.toml') addOutput(config.build?.['target-dir']);
    if (name === 'pom.xml') {
      const build = config.project?.build || {};
      addOutput(build.directory || 'target');
      for (const value of [build.directory, build.outputDirectory, build.testOutputDirectory]) {
        if (typeof value === 'string') addOutput(value.replace(/\$\{(?:project\.)?basedir\}/g, directory).replace(/\$\{project\.build\.directory\}/g, build.directory || 'target'));
      }
    }
    if (/^build\.gradle/.test(name)) {
      addOutput('build');
      for (const match of config.matchAll(/(?:buildDir\s*=|buildDirectory\s*\.\s*set\s*\()\s*["']([^"']+)["']/g)) addOutput(match[1]);
      diagnostics.push({ code: 'declarative-config-only', path: path.join(directory, name), message: 'Gradle is not executed; only literal output-directory assignments are read.' });
    }
    if (name === 'setup.cfg') for (const match of config.matchAll(/^\s*(?:build_base|build_lib|bdist_base|dist_dir)\s*=\s*(.+)$/gm)) addOutput(match[1].trim());
  }
  return result;
}

function nearestConfig(inventory, file, name) {
  let directory = path.dirname(file);
  while (inside(inventory.root, directory)) {
    const config = inventory.configurations.get(directory)?.configs[name];
    if (config) return { directory, value: config };
    if (directory === inventory.root) break;
    directory = path.dirname(directory);
  }
  return null;
}

module.exports = { directoryConfiguration, nearestConfig, readConfig, inside, slash };
