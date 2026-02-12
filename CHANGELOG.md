# Changelog

All notable changes to mdx-forge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
