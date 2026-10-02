# MindTree

MindTree is a beautiful, modern, and sleek Mind-Mapping tool designed to run completely inside the browser. It features a completely dynamic canvas, glassmorphic UI elements, tree layout mapping algorithms, and custom project management tools.

## Features
- Interactive node and tree-map creation
- Auto-collapsing & auto-expanding nodes
- Beautiful glassmorphic styling
- Recursive line length slider tools
- Cross-linked connections and stickies
- Client-side data persistence via LocalStorage

## Quick Start (NPM)

You can launch MindTree locally instantly without installing anything:

```bash
npx project-mind-graph
```

Or you can install it globally to run anywhere:

```bash
npm install -g project-mind-graph
mindtree
```

## Source analysis (1.1.0)

Running without options still opens the existing manual editor. Analysis is
opt-in and reads the target project without building it, running its scripts,
installing its dependencies, or modifying its files. Node.js 18 or newer is
required for this version.

```bash
# Folder and file hierarchy
npx project-mind-graph --structure ./my-project

# Standalone file/module imports
npx project-mind-graph --imports ./my-project

# Standalone symbols and their source references
npx project-mind-graph --symbols ./my-project

# Combined exploration, with separate relationship filters
npx project-mind-graph --structure --imports --symbols ./my-project

# Machine-readable graph, without a server or browser
npx project-mind-graph --structure --imports --symbols ./my-project --json > graph.json

# Serve on a different port without opening a browser
npx project-mind-graph --imports ./my-project --no-open --port 3100
```

The path defaults to the current directory. Quote paths containing spaces.
Use `--help` for options and `--version` for the installed version. From this
checkout, run `npm run build` and use `node bin/mindtree.js` in place of the NPX
command. The new version must be published before its NPX commands are available
from the registry.

To stay on a previous release, pin its version rather than using the unversioned
command, for example `npx project-mind-graph@1.0.1`. This repository prepares
1.1.0; it does not republish or modify earlier releases. The manual editor's
schema-2 saved data is unchanged. Analysis uses a separate graph schema and
viewer and never writes the manual editor's localStorage keys.

### Exploring a graph

Search or expand folders in the left explorer. Select a node to see incoming and
outgoing relationships, source locations, and its children. Select a class or
folder to include its descendants' relationships. Switch between standalone and
combined presentations without rescanning. Import and symbol filters are
separate, and relationship status can be filtered as resolved, possible, or
unresolved. A bounded neighborhood prevents large graphs from drawing every edge
at once; additional relationships remain accessible in the paged detail list.
The coverage strip reports supported/analyzed/partial/failed files by language
and resolved/possible/unresolved/skipped relationship counts. Use its language
tooltip, the diagnostics panel, and JSON export for detail. The display is a
snapshot; rerun the command after source changes.

### Language and exclusion coverage

Folder/file discovery is language-independent. Source analysis supports
JavaScript/Node (including CommonJS), TypeScript/TSX, Python, Java, Go, and Rust.
Declarations include classes, functions, methods, interfaces, structs, traits,
enums, types, and Rust modules where applicable. An import relationship does not
imply that an imported symbol is used.

| Language | Import/config resolution | Symbol binding engine and verified cases |
| --- | --- | --- |
| JavaScript / TypeScript / TSX | Relative modules, CommonJS, `baseUrl`, `paths`, local workspace packages and supported package entries | Bundled TypeScript checker; constructor, instance, static and inherited calls, aliases, interfaces, unions, and explicit Nest/Angular DI registrations |
| Python | Relative/absolute source packages and configured setuptools package roots | Bundled Pyright plus an installed Python interpreter; receiver/inherited methods and Protocol-annotated dependencies |
| Java | Declared packages/types, including types whose filename differs | Installed JDK 17+ compiler API with processing and emission disabled; constructors, receiver methods, inheritance and interfaces |
| Go | Local modules, `go.work`, and local `replace` precedence | Built-in conservative source binder; explicit concrete receivers and interface-typed dependencies. No Go installation or target build is required |
| Rust | File modules, Cargo workspaces, local path dependencies and custom library roots | Installed `rust-analyzer`; receiver/trait calls. Cargo build scripts, procedural macros, checks, sysroot discovery and target execution are disabled |

Installed third-party packages are never graph nodes or edges. Type/declaration
metadata may inform a project-owned relationship, while only project-owned files,
classes and interfaces appear in the graph.

Dependency conventions are centralized in `lib/constants.js`, including
`node_modules`, virtual environments, `site-packages`, package caches and
generated binary extensions. Ambiguous names such as `build`, `out`, and
`target` remain source unless a declarative project configuration identifies
them as output. The scanner reads TypeScript, Cargo, Maven, literal Gradle,
Python, and literal Vite output settings without executing configuration code.
`.mindtree.json` can declare literal `include` and `exclude` paths for other
outputs. Hidden source/configuration directories and symbolic-link targets are
included; repeated directory targets are represented once with aliases.

### Analysis limits

This is static source analysis, so it cannot prove every runtime target. Resolved
edges have a verified source declaration, possible edges preserve multiple valid
static targets, and unresolved/skipped counts remain visible. Reflection,
runtime-computed imports, monkey patching, native/plugin loading, generated source
that is absent during scanning, and dispatch decided only at runtime can remain
unresolved. Rust macro expansion is intentionally disabled. Syntax errors and
read failures are reported. There is no fixed source or configuration file-size
cutoff.

Resolution supports relative imports, TypeScript `baseUrl`/`paths` and relative
configuration inheritance, local package entries/exports, Python package roots,
Java package imports, scanned Go modules and file-based Rust modules. Conditional
exports use the supported types/import/require/default entries. Package-based
TypeScript configuration inheritance is not loaded from excluded dependencies.
Executable configuration is not run; output paths and aliases that exist only as
runtime configuration cannot be discovered automatically. Unknown language files
remain visible in the structure and are counted as unsupported for relationship
analysis. External dependencies are omitted from the graph and counted as
skipped; unresolved local imports and ambiguous symbols are explicitly reported.

The implementation boundaries and graph contract are documented in
[analysis architecture](docs/analysis-architecture.md).

### Verification

```bash
npm ci
npm run build
npm test
npm run test:browser
npm pack
```

Browser checks use installed Microsoft Edge on Windows. On other systems,
install Playwright Chromium (`npx playwright install chromium`), or set
`MINDTREE_BROWSER_CHANNEL` to an installed supported channel. Packaging runs the
build automatically and includes the CLI, analysis modules, and both viewers.

## Setup (Local Development)

To develop locally:

```bash
git clone https://github.com/BharatAdhana/MindTree.git
cd MindTree
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

## GitHub

Star or fork the project on GitHub:
https://github.com/BharatAdhana/MindTree

## License

MindTree is free for personal and non-commercial use.

Commercial use requires a separate commercial license. If you want to use MindTree commercially, please contact Bharat Adhana for commercial licensing.

This project is intentionally being made available free for individuals and non-commercial users.
