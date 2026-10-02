# Analysis architecture and compatibility contract

## Baseline

The 1.0.1 launcher serves dist on port 3000, opens localhost, and falls back to index.html for missing assets. The manual editor keeps schema-2 state in project-mind-graph-v6 and mindtree-projects-v1 localStorage keys. Structure import creates a new manual project. These behaviors remain covered by tests/baseline.test.js.

## CLI

`mindtree` without arguments retains the legacy path. `--structure`, `--imports`, and `--symbols` are composable boolean switches followed by one optional project path (default: working directory). `--imports` and `--symbols` can be used independently. `--json` emits the generated graph to stdout without starting a server. `--no-open` serves the analysis without opening a browser. `--port N` changes the analysis server port. `--help` and `--version` do not scan. Invalid combinations fail with actionable errors.

## Boundaries

- cli/options: syntax and validation; no filesystem traversal.
- scanner: inventory, canonical paths, exclusions, symlink-cycle protection, recoverable diagnostics.
- configuration: reads declarative project files only; never executes build scripts or configuration code.
- languages: parser-backed adapters exposing imports, declarations, and reference candidates.
- resolver: maps imports to inventoried files and references to unambiguous declarations.
- graph: versioned data independent of the existing manual-editor schema.
- service: orchestrates these components; imports parser dependencies only when analysis needs them.
- server: serves an immutable graph snapshot and a dedicated viewer on loopback.
- viewer: structure, import, symbol and combined projections of the same snapshot. Expansion, filtering, and selection are presentation state, not rescans.

Shared constants live in lib/constants.js. Language syntax rules remain in their owning adapters. Parser trees are disposed after each file. New adapters register through the language registry without modifying the CLI, scanner or viewer.

The language registry supplies both import extraction and import resolution. Language-specific resolvers live under `lib/languages/resolution`; the central resolver only owns the inventory lookup and dispatch. Symbol declaration grammar rules live in `symbol-rules.js`. New language symbol syntax may require extending the shared syntax-to-reference extractor as well as its declaration rules.

WASM parsers use the installed `web-tree-sitter` API (`Parser.init`, `Language.load`, parse and dispose), verified against its bundled README and the [upstream bindings documentation](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md). Parser/runtime versions are pinned and all seven grammars (including TSX) are exercised by fixtures.

## Graph v1

`{ schemaVersion, project, modes, nodes, edges, diagnostics, stats, coverage, engines }`.

Nodes have stable path-based IDs, kind (folder/file/module/class/function/method/struct/interface/trait/enum/type), name, path, parent and optional language, source location, or unresolved status. Edges have stable IDs, from, to, kind (contains/imports/references), status (resolved/possible/unresolved), and optional source location, specifier, evidence and engine. Imports never imply symbol usage. Installed third-party dependencies are omitted from nodes and edges. Coverage records file counts by language, relationship outcome counts and active semantic engines. Ambiguous, dynamic and unsupported resolution is reported rather than represented as a verified connection.

## Exclusions and safety

Include hidden paths and symlink targets. Exclude recognized dependency directories, configured output paths and generated binary artifacts. Ambiguous directory names remain source unless configuration identifies them as output. Resolve canonical targets before traversing symlinks; reject dependency/output targets even through aliases. Do not execute project code, install its dependencies, build the target, emit target artifacts or write into the analyzed project. Semantic tools run in no-emit modes: TypeScript compiler API, isolated Pyright, Javac with processing disabled, the built-in Go source binder, and rust-analyzer with Cargo build scripts/procedural macros/checks disabled. Configuration formats which require arbitrary execution remain unsupported.

## Presentation

The analysis viewer is separate from the manual editor and does not access its localStorage keys. Structure starts collapsed beyond the first level. Relations are selected-node focused; a bounded neighborhood and searchable list prevent an all-edges diagram. Users can switch standalone/combined views, choose import/symbol relations, filter relationship status, expand folders and inspect source locations, coverage and diagnostics. The manual app remains accessible via the base command.

## Versioning

Release as 1.1.0, synchronizing package.json and package-lock.json. Preserve the existing executable name and manual state schema 2. Analysis graph schema starts at 1 and has explicit validation at the viewer boundary. Package the new lib modules and viewer assets; verify both legacy and analysis paths from the packed artifact. Publishing is outside this execution plan.
