# Changelog

All notable changes to mdx-forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-04-24

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
