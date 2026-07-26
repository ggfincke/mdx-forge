# Changelog

All notable changes to mdx-forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.9.1] - 2026-07-26

### Added

- **React JSX development runtime preload ID**: `PRELOADED_MODULE_IDS.jsxDevRuntime` gives browser hosts one canonical module identity for dependencies compiled against `react/jsx-dev-runtime`

## [0.9.0] - 2026-07-26

Carries a broad correctness and performance hardening pass across compiler fidelity, browser module loading, diagnostics, and framework components, alongside canonical component identity and repository-wide quality gates. Hosts should re-check the behavior changes below: browser dependencies now preserve import-vs-require identity, open components forward their documented DOM props, and the nested render plugin now requires `mdx-forge@^0.8.0`.

### Changed

- **Component metadata has one canonical identity source**: public metadata, registry queries, framework barrels, compound-member diagnostics, and compiler identity checks derive from the same immutable definition table while identity-only compiler paths remain React-free
- **Open-prop contracts are authoritative**: components marked open now expose and forward their supported DOM props to the correct root; closed components no longer advertise unsupported forwarding
- **Neutral compiler infrastructure**: browser/compiler LRU ownership, frontmatter extraction, source-position rebasing, reserved object-key policy, and component identity now live in dependency-neutral internal modules
- **Render plugin minimum core**: the nested render plugin now requires `mdx-forge@^0.8.0` and locks `0.8.0`, dropping the legacy 0.7.x support path so visible diagram-code fallbacks, unified document diagnostics, original-file positions, invalid-prop checks, and compound-member checks are guaranteed across its supported core range
- **Repository quality gates**: local ESLint rules now enforce file headers, comment tags and casing, block-doc placement, no inline comments, and ASCII arrows across the full repository; Prettier owns Allman braces and no-semicolon formatting; Husky runs lint-staged checks before commits and repository-wide formatting, lint, guardrails, and typechecking before pushes
- **Repository maintenance**: owned source, tests, the render plugin, dev app, scripts, and shipped skill examples were normalized under the shared comment and formatting contract; unused browser/compiler/component/diagnostic surfaces and redundant or over-mocked tests were pruned while regression coverage was retained; current API examples and browser-runtime guidance were refreshed
- **Development and render dependencies**: root tooling moves to `@testing-library/jest-dom` 7.0.0, `@vitejs/plugin-react` 6.0.4, Prettier 3.9.6, `typescript-eslint` 8.65.0, and React/React DOM 19.2.8; the nested render plugin also moves to React/React DOM 19.2.8

### Fixed

- **Conditional export identity**: structured browser dependencies carry import-vs-require intent through fetch, in-flight coordination, resolution hints, and evaluation, so one parent can load both conditional branches of the same package without collisions; runtime requests are canonicalized before loading, duplicate legacy/structured requires prefer the structured identity deterministically, and legacy string dependencies plus three-argument fetchers remain supported
- **Compiler hardening**: prototype-sensitive directive names no longer crash Safe or Trusted compilation; source lines account for frontmatter and injected imports; directive titles are retained; unknown inline components preserve authored children; non-object frontmatter is rejected; frontmatter byte limits count UTF-8 bytes
- **Compiler parity**: Safe and Trusted modes agree on `open="false"`, table-of-contents data is preserved, fence titles retain embedded brackets, public plugin arrays cannot mutate process-wide defaults, and plugin failures use the documented diagnostic code
- **Browser loader concurrency**: cross-branch cycles reject instead of deadlocking; cache clears and targeted invalidations fence old in-flight fetches while preserving unrelated cached modules; preload generations cannot repopulate cleared state; sibling commits protect dependencies before LRU eviction; failed graphs cannot retain dependency, resolution, or CSS state; preload batches commit atomically
- **Incremental module evaluation**: same-entry refreshes and single-leaf invalidations reuse stable relative and bare dependencies while refetching only changed targets; cached CSS is restored after style cleanup; cache size accounting no longer serializes exported functions or ignores retained closure estimates
- **Prototype-name identities**: preload aliases such as `constructor` and `__proto__` register atomically, while component identity queries no longer mistake inherited object properties for known components
- **Diagnostics accuracy**: compound members are framework-aware, unresolved spreads suppress false missing-required errors, named default functions and recursive destructuring count as local bindings, rule overrides take effect, and enum checks accept only genuinely static strings
- **Framework components**: Nextra Callout preserves its unstyled `type={null}` mode, Tabs callbacks receive documented arguments, and FileTree owns framework-neutral structure; Next Image invokes its advertised loader; Next/Nextra/Starlight link, tab, code, and open-prop behavior now matches exported types and registry metadata
- **Component lifecycle details**: tab persistence is not blocked after the first mount, clipboard timers cannot update after unmount, copied code retains meaningful whitespace, Next Image `fill` does not force `object-fit: cover`, and registry query arrays cannot mutate canonical state

### Performance

- **Trusted compilation parses once**: default-export discovery reuses the existing MDX AST instead of reparsing the document
- **Custom plugin loading is cached**: resolved plugin modules are reused within the compiler session
- **Safe document stripping is linear**: removable sibling runs compact without repeated array splices
- **Compiler identity bundles are smaller**: identity-only imports no longer pull the component metadata table or React

### Security

- **Dependency advisory fixes**: the root lockfile updates `brace-expansion` to 5.0.8 to close GHSA-mh99-v99m-4gvg, while the render-plugin lockfile updates `fast-uri` to 3.1.4 to close GHSA-v2hh-gcrm-f6hx and GHSA-4c8g-83qw-93j6

## [0.8.0] - 2026-07-19

Carries the mega-review remediation (34 findings across the Safe render boundary, browser runtime, compiler fidelity, diagnostics, framework component contracts, and the published package) alongside the new structured Safe Document compiler. Hosts should re-check the behavior changes below: Trusted MCP responses no longer inline the rendered artifact by default, Nextra `Bleed` drops its unrelated `size`/`weight`/`align` props, and Starlight `LinkCard` now keeps internal links in the same tab.

### Added

- **`compileSafeDocument` structured compiler**: `mdx-forge/compiler` now exposes an isolated parser-to-data path for untrusted host-component documents. It returns a versioned JSON-only tree with bounded document traversal, a closed Markdown element/prop vocabulary, normalized own-data-only component schemas, recursively enforced URL fields, typed bounded literals, original-document source ranges, JSON diagnostics, frontmatter canonicalization, fail-closed URL policy plus host narrowing, and explicit unknown/raw-element policies. MDX ESM, standalone expressions, executable prop expressions, unsafe URLs, arbitrary DOM props, invalid void-element children, and prototype-sensitive data are diagnosed and never enter the tree; the path has no Trusted Mode, plugin, component-import, browser, HTML, or React dependency
- **Structured compiler contracts and example**: public node, schema, policy, JSON value, source, and diagnostic types ship from `mdx-forge/compiler`; the Claude skill adds a compile-checked `safe-document.ts` example and a three-output decision guide
- **`analyzeMdxDocument` engine entry**: `mdx-forge/diagnostics/analyze` now exposes a document-level API returning diagnostics plus the extracted frontmatter, body content, original-file body offsets, and any parse failure as a structured `parseError` field (the `analyzeMdx` contract of returning `[]` on unparseable input is unchanged). One frontmatter extraction and one MDX parse feed every rule
- **Prop validation rules (`MDXF002`-`MDXF007`)**: The analyze engine validates props against registry metadata — unknown props (with a real `on[A-Z]` event-prop grammar, so `only=` is flagged), missing required props, enum values and deprecated enum aliases, deprecated props, and invalid prop values including string values on boolean props (`open="false"`) and non-numeric strings on number props. New stable code `MDXF007` (`INVALID_PROP_VALUE`)
- **Compound-member validation (`MDXF008`)**: Dotted JSX members are checked against a diagnostics-layer allowlist of known compound members (`Tabs.Tab`, `Cards.Card`, `FileTree.Folder`, `FileTree.File`); unknown members such as `FileTree.Nope` or `Callout.Nope` are flagged. New stable code `MDXF008` (`UNKNOWN_COMPOUND_MEMBER`)
- **`diagramBehavior` compiler option**: New typed `CompilerConfig` field (`'placeholder' | 'code'`, default `'placeholder'`). The default preserves the existing empty-placeholder contract for renderer-owning hosts; `'code'` emits a visible, selectable, language-labeled code fallback for hosts without a diagram runtime. Threaded through the Safe/Trusted plugin builders (`getSafeRehypePluginSets`, `buildTrustedRehypePlugins`, `buildTrustedPluginPipeline`)
- **One-argument `registerPreloadEntries(entries)`**: New overload targeting the singleton module registry, matching the documented high-level browser setup; the two-argument `(registry, entries)` form is unchanged
- **Browser runtime exports**: `PRELOADED_MODULE_IDS` and the `ModuleFetcher`, `ModuleLoaderConfig`, `MDXRuntime`, `Framework`, and `FrameworkId` types are now exported from `mdx-forge/browser`
- **Consumer matrix gate**: `check:consumers` builds and packs the artifact, typechecks every public export subpath in clean NodeNext consumers under both `skipLibCheck` settings (with `compileSafe` / `compileSafeDocument` not-`any` assertions), executes the structured compiler from the installed tarball, bundles every CSS subpath, compiles the shipped skill examples and dev app against the packed declarations, and drives the plugin compatibility legs
- **Plugin compatibility gate**: `check:plugin-compat` clean-installs the render plugin against its locked minimum core and the current packed core, runs typecheck/build/bounded smokes, and asserts diagram fences are visible and non-zero-height in code mode
- **Framework tab synchronization**: Docusaurus `Tabs` implement real cross-instance `groupId` sync with `localStorage` persistence and `queryString` URL restore/update (the boolean form derives the parameter from `groupId`), plus lazy single-panel mounting; Starlight gets its own adapter with `syncKey` sync and `TabItem` icons; generic `Tabs` gains `groupId` sync. Label-only default items resolve through the value/label fallback chain
- **Nextra compound and layout contracts**: `FileTree.Folder` and `FileTree.File` compound statics render a real tree (the `ul`/`li` fallback is kept), `Steps` is a native numbered rail around heading-delimited content, and `Bleed` implements its boolean `full` mode without DOM leakage
- **Render budgets**: source size, pixel area, full-page height, PNG size, and response budgets are enforced in the render-plugin server schema and the direct API

### Changed

- **Compiler dependency ownership**: `@mdx-js/mdx` and `unified` are direct runtime dependencies instead of advertised optional peers. A clean `npm install mdx-forge` can import `mdx-forge/compiler` without consumers reconstructing the compiler's internal dependency set; React remains an optional peer for component entry points
- **Render plugin diagnostics engine**: The plugin lint pass now feature-detects the core's `analyzeMdxDocument` and, when present, delegates all body analysis to the single core engine, keeping only frontmatter schema lint and an MCP formatting adapter locally. Unified-engine lint restores stripped-frontmatter offsets (diagnostics report original-file lines), flags `open="false"`, `only=`, and unknown dotted members, and treats generic built-ins as known under every framework (previously flagged `unknown-component` per framework barrel). With the locked minimum core (0.7.1) the plugin falls back to its previous analyzer unchanged; the MCP diagnostic shape, unknown-component message wording, and severity mapping are preserved. Bumping the plugin's minimum core to require the unified engine is a pending deliberate release step
- **Syntax highlighting engine**: moved to `@shikijs/core` with the JavaScript regex engine, promise-deduped per-language grammar imports, and a plaintext fast path, instead of initializing roughly 50 grammars for the first fence
- **Code block tokenization cache**: a bounded byte-aware LRU caches block tokenization templates, cloned per use so cached HAST never leaks between documents; unchanged blocks are no longer re-highlighted on every edit
- **Screenshot capture**: explicit readiness signals replace `networkidle` (roughly 500 ms saved per capture) and a single browser owner replaces duplicate instances
- **Trusted MCP responses**: default to URL, diagnostics, and summary rather than inlining the 0.66-0.75 MB artifact; the harness page is minified and artifacts have a retention policy
- **Framework CSS token emission**: the shared token sheet is imported once from `base/styles/index.css` (leaf and framework sheets no longer import it, `callout.css` imports `callout-variants` directly), and the render-plugin inliner caches raw reads and dedupes resolved files per bundle, so a document carries exactly one token sheet — generic document CSS 42.2 KB -> 22.6 KB, Starlight 54.8 KB -> 35.2 KB
- **Shared tab-list interaction**: a new `useTabListInteraction` hook owns the button ref array, Arrow/Home/End keyboard navigation with disabled awareness, roving tabindex, and reciprocal tab/panel `useId` wiring; value tabs, index tabs, and `CodeGroup` consume it while keeping their own state models
- **Component prop types**: `CalloutProps`, `CollapsibleProps`, and `CodeProps` now derive from their implementations (`className` included), and `CodeGroup` derives tab labels from compiled fence `data-title`. Registry metadata was updated so runtime, types, metadata, and examples agree
- **Guard script traversal**: `scripts/lib/collect-files.mjs` is the single parameterized recursive collector (suffix filter, ignored directories, file-or-directory entries); the comment-style, frontmatter-import, legacy-path, copy-css, and ESM-specifier scripts use it with identical output
- **Dependencies**: bump root dev dependencies (`@types/node` 26.1.1, `eslint` 10.7.x, `typescript-eslint` 8.64.x, `vite` 8.1.5, `vitest` 4.1.10, `prettier` 3.9.5) and the render plugin (`@types/node` 26.1.1, `typescript` 7.0.2, minimum `mdx-forge` ^0.7.1)

### Removed

- **Nextra `Bleed` props**: the unrelated `size`, `weight`, and `align` props are dropped; `Bleed` exposes only its boolean `full` mode
- **Dead internal surfaces**: the `DEFAULT_SHIM_LOAD_*` retry constants and their parity test, the unreferenced `NEXTRA_FRONTMATTER_KEYS` list, the unreferenced `CopyIcon`/`CheckIcon` Lucide variants, the dead `shared/index.css` proxy, `createNextraWrapper`, and the `decrementStyleRef`/`unmarkStyleInjected` ref-count surface

### Fixed

- **Frontmatter prototype-key hardening**: `safeMatter`, `extractFrontmatter`, and both existing compiler modes now drop `__proto__`, `constructor`, and `prototype` mappings during bounded normalization instead of invoking inherited object setters or retaining prototype-sensitive data
- **Core diagnostic JSX name grammar**: The analyze engine now follows real JSX semantics — capitalized components that case-fold to HTML names (`<Button>`, `<Table>`), member expressions (`<Frobnicate.Item>`), and underscore/dollar identifiers (`<Frobnicate_Thing>`, `<$Widget>`) are analyzed as component references instead of silently reporting a clean result; lowercase, dashed (web component), and namespaced (`svg:path`) tags are intrinsic. Member expressions classify through their root identifier, so imported or config-declared roots cover their members
- **Published NodeNext declarations**: The post-build specifier fixer and `check:esm-specifiers` now rewrite emitted `.d.ts` files (including bare `'.'`/`'..'` directory references) so NodeNext consumers resolve every public export with `skipLibCheck` on or off, instead of TS2834/TS2835 errors or silent `any` degradation
- **Render plugin dependencies**: Directly imported runtime packages (`esbuild`, `gray-matter`, `remark-parse`, `remark-mdx`, `unist-util-visit`) are now declared production dependencies of the render plugin
- **Dev app typecheck**: `npx tsc -p dev/tsconfig.json --noEmit` passes (CSS side-effect imports resolved via `vite/client` types) and runs in CI as `typecheck:dev`
- **Module dependency eviction**: dependencies of live cached modules are protected from LRU eviction, so a cached dependent can never outlive its dependency generation and split module singletons are no longer possible; memory accounting now only drops modules that are genuinely unreachable
- **CSS module lifecycle**: a cached CSS module owns its style end-to-end — module eviction or invalidation removes both the tracking entry and the DOM node, changed bytes under the same ID replace the node, and unchanged bytes keep duplicate-import dedup
- **Stale browser loads**: a cache generation epoch rejects in-flight loads issued before a clear (`STALE_GENERATION`), `evaluateModuleToComponent` compare-and-clears exact shim handles so a newer load installed mid-await wins, and runtime budgets must be finite positive integers at the public config boundary
- **Registry query helpers**: return defensive copies over private immutable state instead of exposing mutable compiler-global state; `KNOWN_GENERIC_COMPONENTS` is a readonly snapshot and Safe compilation checks `isGenericComponent()` rather than reading the shared set
- **Trusted codegen hygiene**: collision-safe wrapper aliases, quoted import specifiers and object keys, no unused classic React import, and a clear error for unsupported component keys, so generated JavaScript stays parseable
- **MDX default-export detection**: real estree inspection of MDX ESM replaces the regex scan that a fenced example containing `export default` could fool
- **Safe intrinsic JSX semantics**: intrinsic JSX children are preserved structurally across the AST-to-HTML crossing, block-level JSX inside paragraphs is unwrapped, and transform labels and titles are no longer pre-escaped into double-escaped text
- **Code fence metadata**: read from its real HAST location and carried across `rehype-raw`; highlight ranges are clamped to the block's line count
- **Index tab state**: `useIndexTabs` is hydration-safe (no storage read during render, restore after mount) and normalizes default, controlled, stored, and set indices against the enabled items; invalid values land on the first enabled item
- **Control and accessibility invariants**: `type="button"` on all tab, code-group, copy, and dev controls so they cannot submit an enclosing form; reciprocal `useId`-based `aria-controls`/`aria-labelledby`; copy buttons revealed on `focus-visible`/`focus-within`; reduced-motion overrides for the Docusaurus, Starlight, and Nextra motion CSS; and `aria-current`/`aria-pressed` on dev navigation and theme controls. Unmounted lazy tab panels no longer leave dangling `aria-controls` IDREFs
- **Starlight `FileTree`**: the first filename node is parsed structurally (text, code, and bold wrappers, spaces preserved) and later formatting is retained as structural comment content instead of being reinterpreted as a filename
- **`Collapsible` contract**: the Safe transform now matches the React implementation — summary precedence and `open ?? defaultOpen`, including `{true}`/`{false}` literals — and the generic `CollapsibleProps` derives from the same base contract
- **Starlight `LinkCard`**: extends and forwards native anchor props; internal links stay in the same tab, only external or explicitly targeted links open a new one, and a safe `rel` is merged only when `_blank` is used
- **Copy feedback timers**: a single timer ref per component, restarted on each success and cleared on unmount, so timers no longer race or outlive their component

### Security

- **Safe render boundary**: the hand-rolled sanitizer is replaced by a `hast-util-sanitize` allowlist plus a Safe-document CSP, and all Playwright capture and preview loads run behind a default-deny resource route — a final Safe document is inert in a real browser and screenshot capture makes no outbound requests
- **Frontmatter bounds**: frontmatter is normalized to acyclic plain data under explicit depth, node-count, and size limits, so cyclic and exponentially amplified graphs are rejected rather than expanded

## [0.7.1] - 2026-07-03

Republish of the withdrawn `0.7.0` release; npm permanently reserves that version slot after first publish.

### Added

- **`mdx-forge/diagnostics`**: New zero-dependency contract leaf — a host-agnostic, JSON-serializable `Diagnostic` shape (`code`, `ruleId`, `severity`, `message`, `source`, unist-native 1-based `range`, discriminated `data`) plus the stable `DIAGNOSTIC_CODES` table (`MDXF###`). Consumed by VS Code and tests today; CLI and MCP consumption is planned
- **`mdx-forge/diagnostics/analyze`**: New render-free analysis engine — `analyzeMdx(source, ctx)` runs one safe-frontmatter extraction + a single remark/remark-mdx parse and emits `Diagnostic[]` with no compile. Ships the ported unknown-component rule (`MDXF001`) and the reusable, framework-accurate `classifyComponentSource` ladder so every host shares one classification implementation
- **`FrontmatterResult` offsets**: `extractFrontmatter` now returns the 1-based original-document line and column where the body begins, so lint positions are file-relative without re-evaluating frontmatter
- **`safeMatter`**: Now exported from `mdx-forge/compiler` so hosts can route diagnostics parses through the no-eval (`---js` / `---javascript`) frontmatter parser

### Changed

- **Dependencies**: Bump root and render-plugin dependency sets to current releases, including `@types/node` 26.x, `eslint` 10.6.x, `vite` 8.1.x, `shiki` 4.3.x, `playwright` 1.61.x, `prettier` 3.9.x, `typescript-eslint` 8.62.x, React type/runtime patches, and `actions/checkout` v7; refresh transitive audit fixes so both package scopes report zero npm audit vulnerabilities

## [0.6.2] - 2026-06-11

### Changed

- **Render plugin**: Simplify the Trusted Mode harness and preview server, including shared harness-page execution, serialized per-framework page access to avoid render deadlocks, and a cleaner shutdown sequence
- **Browser runtime**: Simplify module registry and preload internals, pruning stale shim-loader plumbing while preserving the public preload API
- **Compiler**: Simplify Safe Mode compilation and the Shiki/admonition pipeline, with leaner Shiki HAST generation and reduced internal pipeline helpers
- **Components**: Simplify tab navigation and registry type derivation, including lazy tab-state initialization and eager generic-component lookup tables
- **Dependencies**: Bump `@types/node` to ^25.9.3, `@types/react` to ^19.2.17, `prettier` to ^3.8.4 and `typescript-eslint` to ^8.61.0

## [0.6.0] - 2026-06-05

### Added

- **`ShimBarrelConfig.injectCss`**: Shim-barrel config entries can now flag that a framework's stylesheet should be injected, so code generators emit the matching `mdx-forge/components/styles/<framework>.css` import. Consumed by the MDX Preview webview shim generator
- **`FRAMEWORK_IDS`**: Now exported from `mdx-forge/components/registry` as the single source of framework identifiers

### Changed

- **Internal consolidation** (behavior-preserving): The `render` registry is now a thin facade over the core component identity — deleted a 534-line metadata shadow and single-sourced `FRAMEWORK_IDS`. Shim and metadata value sets are single-sourced (`CodeGroup` built on `BaseTabs`, Cards on `BaseCard`), react-free shim metadata is extracted into `components/internal/metadata.ts`, and compiler callout/alert handling is factored into `createCalloutCard` + `stripDefaultMdxExport` with alert labels derived from the registry. Module evaluation routes through the shared error factory with `extractErrorMessage` parity locked. Compiled output for existing components is unchanged
- **Dev config**: `dev/tsconfig.json` now extends the shared base instead of copying its compiler options

### Removed

- **`injectStyles` from `mdx-forge/browser`**: Removed the unused `injectStyles` export; style injection is handled internally by the browser registry during module evaluation
- **Dead internal code**: Pruned unreachable browser-registry methods, compiler pipeline-warning helpers, and stale pipeline types

## [0.5.0] - 2026-06-03

### Added

- **Document format detection**: New `format` compiler option (`'detect' | 'md' | 'mdx'`, default `'detect'`). `.md`/`.markdown`/`.mdown`/`.mkd` compile as lenient CommonMark (so prose like `<1 day` or `{...}` no longer errors) while `.mdx` stays strict MDX. `format: 'mdx'` forces strict parsing for any document; `format: 'md'` forces lenient.

### Changed

- **`.md` parsing**: By default `.md` documents now compile as CommonMark instead of strict MDX. Callers that relied on strict MDX parsing of `.md` (e.g. unknown-component stripping) should pass `format: 'mdx'`.
- **Dependencies**: Bump `@types/react` to ^19.2.16, `eslint` to ^10.4.1, `react` & `react-dom` to ^19.2.7, `shiki` to 4.2.0, `typescript-eslint` to ^8.60.1, `vite` to ^8.0.16 (picks up the `server.fs.deny` dev-server hardening, GHSA-fx2h-pf6j-xcff) & `vitest` to ^4.1.8

### Security

- **Frontmatter eval (RCE)**: Disable gray-matter's default `javascript` engine so `---js` / `---javascript` frontmatter is no longer evaluated via `eval()`. Previously any MDX passed to `compileSafe()`, `compileTrusted()`, `extractFrontmatter()` or `hasDefaultExport()` could execute arbitrary code in the host process (CWE-94). YAML & JSON frontmatter are unaffected.
- **Plain-markdown (`.md`) raw HTML**: `.md` compiles as CommonMark, so raw HTML — including event-handler attributes and elements that strict MDX would reject — passes through verbatim in Safe Mode. Safe Mode is a compile mode, not a sanitizer; hosts rendering untrusted `.md` must sanitize downstream or apply a CSP. Use `format: 'mdx'` to keep strict parsing. MDX component handling (`componentsUnknownBehavior`, `componentNameResolver`, component maps) does not apply to `.md`; the compiler now emits warning `MDX009` when such config is set for a `.md` document.
- **Layout import hardening**: `customLayoutFilePath` is JSON-quoted when emitted into generated Trusted Mode modules, so a crafted path can no longer break out of the import string to inject `import` statements. Applies to both the markdown and MDX layout paths.
- **Format-detection hardening**: Document paths containing control characters (e.g. embedded NUL) fail closed to strict MDX, preventing extension-confusion downgrades to the lenient parser.

## [0.4.4] - 2026-05-26

### Changed

- **Dependencies**: Bump `@types/node` to ^25.9.1, `@types/react` to ^19.2.15, `eslint` to ^10.4.0, `shiki` to ^4.1.0, `typescript-eslint` to ^8.60.0, `vite` to ^8.0.14 & `vitest` to ^4.1.7

## [0.4.3] - 2026-05-14

### Changed

- **Dependencies**: Bump patch dependency set, including `@types/node`, `eslint`, `globals`, `playwright`, `react`, `react-dom`, `typescript-eslint`, `vite` & `vitest`

## [0.4.2] - 2026-05-05

### Changed

- **Docs**: Surface Claude Code skill & render plugin install details in the README, including marketplace commands and links to bundled plugin assets
- **Claude Plugin**: Refresh marketplace and skill metadata copy for the `mdx-forge` skill and `mdx-forge-render` plugin
- **Dependencies**: Bump May 2026 dependency set, including `@types/node`, `eslint`, `globals`, `jsdom`, `prettier`, `typescript`, `typescript-eslint`, `vite` & `vitest`

## [0.4.1] - 2026-04-25

### Added

- **Plugin (mdx-forge-render)**: New MCP server plugin under `plugins/render/` exposing `render_mdx` & `list_components` tools — compiles MDX via Safe or Trusted Mode & captures Playwright screenshots of the result
- **Plugin (mdx-forge-render)**: Live-reload preview server on a stable per-session port w/ SSE-driven auto-refresh, optional `autoOpen` browser launch & self-contained HTML output for claude.ai artifacts
- **Plugin (mdx-forge-render)**: Trusted Mode rendering — sandboxed headless harness for snapshots plus per-framework esbuild IIFE bundles under `dist/harness/` so live previews mount real React (Tabs, hooks & `onClick` handlers all work)
- **Plugin (mdx-forge-render)**: Pre-compile MDX lint surfacing unknown components, invalid props & frontmatter gaps w/ line numbers & did-you-mean suggestions
- **Plugin (mdx-forge-render)**: Default Shiki CSS-variable theme so code blocks render colored out of the box; sanitizer strips `<script>`/`<iframe>`/`<meta>`, inline event handlers & `javascript:` URLs from Safe-Mode output before injection
- **Claude Plugin**: `.claude-plugin/marketplace.json` & `.claude-plugin/plugin.json` shipping `mdx-forge` skill alongside the `mdx-forge-render` plugin
- **Skill (mdx-forge)**: `skills/mdx-forge/SKILL.md` w/ reference files (compiler, browser-runtime, components, plugins) & 4 compile-checkable examples (safe-compile, trusted-compile, browser-setup, framework-shim)
- **Browser**: Circular dependency detection in module loader; `Semaphore.available` & `Semaphore.waiting` now exposed
- **Compiler**: GitHub alerts preserve rich markdown content (links, inline code, formatting) instead of flattening to plain text
- **Tooling**: `check-comment-style.mjs` & `check-legacy-path-prefixes.mjs` guardrails wired into `npm run lint` via `check:guardrails`
- **Dev**: Screenshot matrix w/ themed & viewport-specific captures across Docusaurus, Generic, Nextjs, Nextra & Starlight showcase pages
- **Testing**: `render-plugin-cache` & `render-plugin-registry` suites; expanded `render-plugin`, `render-plugin-trusted`, `load-module`, `safe-compile` & `trusted-compile` coverage

### Changed

- **Plugin (mdx-forge-render)**: Split `registry.ts` into a thin facade over mdx-forge core component identity; extract frontmatter schema & component metadata into separate modules instead of duplicating prop shapes
- **Browser**: Tighten `isBareImport()` to reject arbitrary URL schemes & Windows absolute paths
- **Dependencies**: Bump `@types/node` to ^25.6.0, `eslint` to ^10.2.1, `globals` to ^17.5.0, `jsdom` to ^29.0.2, `prettier` to ^3.8.3, `react`/`react-dom` to ^19.2.5, `typescript-eslint` to ^8.59.0, `vite` to ^8.0.10 & `vitest` to ^4.1.4
- **CI**: Bump `softprops/action-gh-release` from v2 to v3

## [0.3.1] - 2026-03-31

### Removed

- **Compiler**: Delete stale `src/compiler/transforms/` re-export barrel (subpath export removed in 0.2.2)

### Fixed

- **Browser**: Use ES2022 `Error.cause` constructor option instead of unsafe manual casts in `ModuleError` & `evaluateModule`
- **Docs**: Remove stale `mdx-forge/compiler/transforms` from README subpath exports list
- **Docs**: Fix Quick Start example — add required `documentPath` field, remove incorrect logger

## [0.3.0] - 2026-03-30

### Added

- **Compiler**: HTML intrinsic elements (e.g., `<table>`, `<div>`, `<figure>`) written as JSX in MDX now pass through as real HTML in Safe Mode instead of rendering as "unknown component" placeholders
- **Compiler**: Add `rehype-raw` to the Safe Mode pipeline to parse serialized HTML nodes into proper HAST elements
- **Compiler**: `getSafeRehypePluginSets()` now returns a `raw` field for the `rehype-raw` plugin
- **Compiler**: `isHtmlElement()`, `serializeJsxToHtml()` & `serializeAttribute()` helpers for JSX-to-HTML serialization

### Changed

- **Compiler**: `remarkStripMdx` now handles `mdxJsxFlowElement` & `mdxJsxTextElement` in a unified code path instead of separate branches

## [0.2.4] - 2026-03-30

### Changed

- **Dependencies**: Bump `vitest` to 4.1.1, `typescript-eslint` to 8.58.0, `jsdom` to 29.0.1, `vite` to 8.0.3 & `typescript` to 6.0.2

## [0.2.3] - 2026-03-21

### Changed

- **Registry**: Add `semanticAliases`, `snippetTemplate` & `snippetDoc` fields to `ComponentDefinition` for registry-driven alias lookup & completions
- **Registry**: Make `preloadId` & `webviewImport` optional, remove values from all entries (host metadata now computed downstream)
- **Registry**: Re-export `Framework`/`FrameworkId` from `components/registry/types` in `browser/types`
- **Compiler**: Remove legacy `docFsPath` & `docUri` backwards-compatible aliases from `CompilerConfig`; rename `useVscodeMarkdownStyles` to `useHostMarkdownStyles`
- **Compiler**: Export `VALID_CALLOUT_TYPES`, `CalloutType` & `GITHUB_ALERT_TYPES` from compiler barrel

### Added

- **Registry**: `getSemanticAlias()` & `getGenericComponentSnippets()` query functions
- **Testing**: `PRELOADED_MODULE_IDS` cross-repo parity check

## [0.2.2] - 2026-03-05

### Changed

- **Compiler**: Consolidate diagram placeholder plugins (mermaid, PlantUML, Graphviz) into single `create-diagram-placeholder.ts` factory, eliminating 3 single-use wrapper files
- **Compiler**: Deduplicate callout config via shared `buildCalloutStyleMap()` — both `admonitions.ts` & `callout.ts` derived from single source, reducing ~160 lines of repetitive wiring

### Removed

- **Exports**: Remove unused `./compiler/transforms` subpath export from `package.json`

## [0.2.1] - 2026-03-02

### Changed

- **Dependencies**: Bump `shiki` from >=3.22.0 to >=4.0.0, `globals` to ^17.4.0 & `@types/node` to ^25.3.3

## [0.2.0] - 2026-02-27

### Added

- **Compiler**: Add `rehypeSourceLine` plugin to annotate rendered elements with `data-source-line` in both Safe and Trusted outputs
- **Compiler**: Preserve `data-source-line` metadata through Shiki code block wrappers and diagram placeholder transforms
- **Callouts**: Expand supported canonical types to 17 total by adding `summary`, `hint`, `success`, `question`, `failure`, `bug`, `example`, `quote`, `todo` and `attention`
- **Testing**: Add broader component and cross-repo contract coverage (`framework-shims`, `nextjs-shims`, `file-tree`, `code-group`, `useIndexTabs` and metadata contracts)

### Changed

- **Callouts**: Introduce alias mappings for `abstract`/`tldr`, `check`/`done`, `help`/`faq`, `fail`/`missing`, `snippet` and `cite` to canonical types
- **Components**: Refresh callout, tabs and token styling across Generic, Docusaurus, Nextra and Starlight themes (updated color tokens, focus states, dark-mode fallbacks and elevation styling)
- **Dependencies**: Bump `eslint` from 9.x to ^10.0.2 and refresh lockfile versions (including `jsdom` 28.1.0, `@types/node` 25.3.1, `shiki` 3.23.0 and `typescript-eslint` 8.56.1)

### Fixed

- **Tabs**: Use `window.localStorage` in `useIndexTabs` and harden storage mocking in tests for browser-like runtime compatibility

## [0.1.6] - 2026-02-13

### Changed

- **Browser**: Add `HostPreloadCallbacks` interface for environment-specific preload behavior (replaces hardcoded layout callback)
- **Browser**: Align `DEFAULT_SHIM_LOAD_MAX_RETRIES` (2->3) & `DEFAULT_SHIM_LOAD_RETRY_DELAY_MS` (150->200) w/ downstream consumers
- Bump Vite from 6.x to ^7.3.1 & `@vitejs/plugin-react` from 4.x to ^5.1.4

### Added

- Cross-repo duplicate warnings on `cn.ts`, `clipboard.ts` & `semaphore.ts`
- Component tests: generic smoke tests, callout type rendering & `useTabState` hook
- Constants contract & cross-repo utility parity tests
- Dev dependencies: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

## [0.1.5] - 2026-02-11

### Added

- Vite + React dev showcase app (`dev/`) for visualizing component shims during development
- Showcase pages for all 5 framework targets: Generic, Docusaurus, Starlight, Nextra & Next.js
- Light/Dark/System theme toggle in dev app (activates both `prefers-color-scheme` & `.vscode-dark` pathways)
- `npm run dev` script to launch the showcase at localhost:5173

### Fixed

- Dark mode text colors in `tokens.css` — added `--mdx-text-primary`, `--mdx-text-secondary`, `--mdx-text-muted` & `--mdx-link-color` overrides for both `prefers-color-scheme: dark` & `.vscode-dark` blocks

## [0.1.4] - 2026-02-11

### Changed

- Bump `actions/checkout` from 4 to 6
- Bump `globals` from 15.15.0 to 17.3.0
- Bump `@types/node` from 20.x to 25.2.3
- Bump `@types/react` from 18.x to 19.2.14
- Bump `shiki` from 1.x to >=3.22.0

### Fixed

- React 19 type compatibility: cast `ReactElement.props` access in `extractTextContent` & `FileTree`

## [0.1.3] - 2026-02-11

### Added

- Callout normalization tests & XSS escape test for callout titles
- `CalloutStyleConfig` shared interface for callout/admonition/alert config objects
- `createTrustedModeNotice()` helper for Safe Mode feature placeholders
- `getGenericComponentAliases()` in component registry queries
- Document path helpers (`getDocumentPath`, `getDocumentDir`, `getDocumentUri`) in compiler internals

### Changed

- Admonitions, GitHub alerts & callout defaults now use shared `CalloutStyleConfig` & `createNode()`
- Tabs & code-group transforms use `createTrustedModeNotice()` instead of inline HTML
- Safe-compile JSX placeholder logic extracted into `createFlowPlaceholder()` & `createInlinePlaceholder()`
- Component registry functions consolidated from `compiler/internal/components` into `components/registry/queries`
- Document path helpers centralized in `compiler/internal/path` (removed duplicates from `trusted/compile`)
- Publish workflow now generates GitHub Releases with changelog

### Removed

- `src/compiler/internal/components.ts` (replaced by `components/registry/queries`)

## [0.1.2] - 2026-02-11

### Added

- Callout normalization tests & XSS escape test for callout titles

### Refactored

- Adopt `CalloutStyleConfig` & `createNode()` in admonitions, alerts & callout defaults
- Add `createTrustedModeNotice()` & extract safe-compile placeholder helpers
- Centralize document path helpers in `internal/path`
- Delete `internal/components` & consolidate into `registry/queries`
- Add `CalloutStyleConfig` interface & export `CALLOUT_TITLES`
- Adopt `cn()` utility for className construction in components
- Add `TransformNode` type & centralize CSS class constants
- Remove `ADMONITION_ICONS` alias & fix icon import paths
- Slim `pipeline-config` & deduplicate `REHYPE_RAW_CONFIG`
- Consolidate cache defaults into shared constants in browser
- Remove dead modules & inline circular dependency calls in browser

## [0.1.1] - 2026-02-10

### Added

- Initial release as standalone repository
- **Compiler**: MDX compilation with Safe mode (MDX to HTML) & Trusted mode (MDX to JavaScript)
- **Browser**: Client-side module loading, evaluation, registry with LRU cache & dependency tracking
- **Components**: React component shims for Docusaurus, Starlight, Nextra, Next.js & generic usage
- **Component Registry**: Component metadata, queries, alias resolution & shim configuration
- **Plugin System**: Remark/rehype plugin pipeline with builder pattern & custom plugin loading
- **Syntax Highlighting**: Shiki integration with O(1) language lookup & lazy initialization
- **Diagram Support**: Mermaid, PlantUML & Graphviz placeholder generation
- **CI/CD**: GitHub Actions for CI (lint, typecheck, test, build) & automated npm publishing
