# Changelog

All notable changes to mdx-forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
