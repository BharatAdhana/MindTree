'use strict';

module.exports = Object.freeze({
  GRAPH_SCHEMA_VERSION: 1,
  SEMANTIC_TIMEOUT_MS: 30000,
  DEFAULT_PORT: 3000,
  HOST: '127.0.0.1',
  GRAPH_ENDPOINT: '/graph.json',
  MODES: Object.freeze(['structure', 'imports', 'symbols']),
  // Conventions shared across supported ecosystems. Configured paths augment these.
  EXCLUDED_DIRECTORIES: Object.freeze([
    'node_modules', 'bower_components', '.pnpm-store', '.yarn', '.npm', '.npm-cache',
    '__pycache__', '.venv', 'venv', 'site-packages', '.tox', '.nox', '__pypackages__',
    '.pytest_cache', '.mypy_cache', '.ruff_cache', '.eggs',
    '.gradle', '.m2',
    'vendor', '.next', '.nuxt', '.output', '.svelte-kit', 'coverage',
    '.dart_tool', '.pub-cache', 'Pods', 'Carthage', '.build', '.swiftpm',
    '.bundle', '.stack-work', '.cabal-sandbox', '.terraform', 'CMakeFiles', '_build'
  ]),
  GENERATED_EXTENSIONS: Object.freeze(['.pyc', '.pyo', '.class', '.jar', '.war', '.ear', '.o', '.obj', '.a', '.so', '.dll', '.exe', '.rlib', '.rmeta', '.wasm']),
  EXTENSIONS: Object.freeze({
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'tsx', '.mts': 'typescript', '.cts': 'typescript',
    '.py': 'python', '.pyi': 'python', '.java': 'java', '.go': 'go', '.rs': 'rust'
  })
});
