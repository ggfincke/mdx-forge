# mdx-forge

`mdx-forge` is a standalone MDX runtime toolkit published as an ESM package for Node 22+.

It exposes four domain-focused entry points:

- `mdx-forge/compiler` for structured, Safe HTML, and Trusted MDX compilation
- `mdx-forge/diagnostics` for host-agnostic diagnostic contracts and analysis
- `mdx-forge/browser` for browser-side module loading and evaluation
- `mdx-forge/components` for framework shim components, metadata, and CSS

## Install

```bash
npm install mdx-forge
```

Peer dependencies:

- `react >= 18` for component entry points

Compiler dependencies are installed with the package; consumers do not need
to install `@mdx-js/mdx` or `unified` separately.

## Quick Start

```ts
import { compileSafeDocument } from 'mdx-forge/compiler';

const result = await compileSafeDocument(
  '# Hello\n\n<Hotspots limit={10} />',
  {
    components: {
      Hotspots: {
        props: {
          limit: { type: 'number', integer: true, minimum: 1 },
        },
      },
    },
  }
);

if (result.diagnostics.some((item) => item.severity === 'error')) {
  throw new Error(JSON.stringify(result.diagnostics));
}

console.log(result.root);
```

## Public Entry Points

- `mdx-forge/compiler`
- `mdx-forge/compiler/plugins`
- `mdx-forge/diagnostics`
- `mdx-forge/diagnostics/analyze`
- `mdx-forge/browser`
- `mdx-forge/browser/registry`
- `mdx-forge/components`
- `mdx-forge/components/generic`
- `mdx-forge/components/docusaurus`
- `mdx-forge/components/starlight`
- `mdx-forge/components/nextra`
- `mdx-forge/components/nextjs`
- `mdx-forge/components/registry`
- `mdx-forge/components/styles/*.css`

## Domain Summary

### Compiler

- `compileSafeDocument()` compiles untrusted MDX into a versioned, JSON-only
  structural tree with closed Markdown elements, schema-declared host
  components, source ranges, and diagnostics; it never returns HTML or code
- `compileSafe()` compiles MDX to HTML for non-executing preview flows
- `compileTrusted()` compiles MDX to executable JavaScript for host-controlled trusted rendering
- `format` selects lenient CommonMark (`md`) vs strict MDX (`mdx`); `detect` (default) derives it from the document extension (`.md` → `md`, else `mdx`)
- Safe HTML and Trusted Mode remark/rehype support includes GFM, alerts,
  directives, math, diagrams, heading anchors, and syntax highlighting

### Browser Runtime

- `loadModule()` recursively loads modules and their dependencies
- module evaluation uses `new Function()` and requires a host that intentionally allows that execution model
- the registry layer coordinates module cache, style cache, and dependency tracking

### Diagnostics

- zero-dependency `Diagnostic` contract with stable `MDXF###` codes
- `analyzeMdx()` safely parses frontmatter and emits render-free diagnostics
- framework-aware unknown-component classification shared by hosts

### Components

- generic built-ins such as `Callout`, `Tabs`, `TabItem`, `CodeGroup`, and `Collapsible`
- framework shims for Docusaurus, Starlight, Nextra, and Next.js
- registry metadata used by codegen and host alias resolution

## Security Notes

- `mdx-forge/browser` evaluates code with `new Function()`
- hosts must explicitly enforce their own trust and path boundaries
- structured compilation accepts only bounded JSON literals, rejects executable
  syntax, applies a fixed URL baseline plus optional host narrowing, and never
  enters Trusted Mode; hosts must still render only the closed returned node
  vocabulary and stop on error diagnostics
- Safe compilation is a compile mode, not a full sanitization boundary by itself
- `.md` documents compile as CommonMark: raw HTML (including event-handler attributes and elements that strict MDX would reject) passes through verbatim, so sanitize untrusted `.md` downstream or set `format: 'mdx'` for strict parsing
- MDX component handling (`componentsUnknownBehavior`, `componentNameResolver`, component maps) does not apply to `.md`; the compiler warns (`MDX009`) when such config is set for a `.md` document
- runtime style injection may require `style-src 'unsafe-inline'` or a nonce-aware host strategy

## Build and Test

```bash
npm run build
npm run typecheck
npm test
```

## Claude Code Integration

`mdx-forge` ships two add-ons for [Claude Code](https://claude.com/claude-code), distributed via the marketplace defined in [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json):

### `mdx-forge` skill

A skill that teaches Claude how to use `compileSafeDocument`, `compileSafe`,
`compileTrusted`, the browser module loader (`loadModule`, `setModuleFetcher`,
`evaluateModuleToComponent`), and the framework component shims correctly.
Lives in [`skills/mdx-forge/`](./skills/mdx-forge/) — `SKILL.md`, four reference
docs (`compiler.md`, `browser-runtime.md`, `components.md`, `plugins.md`), and
five compile-checkable TypeScript examples.

### `mdx-forge-render` plugin

An MCP server that compiles MDX (Safe or Trusted Mode), publishes a live-reloading preview, optionally captures Playwright screenshots, and returns structured diagnostics (unknown components, invalid props, frontmatter gaps) with line numbers and did-you-mean suggestions. Two tools:

- `render_mdx` — compile + render + lint
- `list_components` — look up a framework's component contract before writing MDX

Lives in [`plugins/render/`](./plugins/render/). See [`plugins/render/README.md`](./plugins/render/README.md) for install instructions, tool parameters, and the diagnostic schema.

### Install both

```bash
/plugin marketplace add ggfincke/mdx-forge
/plugin install mdx-forge@mdx-forge          # the skill
/plugin install mdx-forge-render@mdx-forge   # the MCP server
```

## License

MIT. See `LICENSE`.
