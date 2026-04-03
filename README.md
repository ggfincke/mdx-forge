# mdx-forge

`mdx-forge` is a standalone MDX runtime toolkit published as an ESM package for Node 22+.

It exposes three domain-focused entry points:

- `mdx-forge/compiler` for Safe and Trusted MDX compilation
- `mdx-forge/browser` for browser-side module loading and evaluation
- `mdx-forge/components` for framework shim components, metadata, and CSS

## Install

```bash
npm install mdx-forge
```

Peer dependencies:

- `react >= 18` for component entry points
- `@mdx-js/mdx` and `unified` for compiler entry points

## Quick Start

```ts
import { compileSafe } from 'mdx-forge/compiler';

const result = await compileSafe('# Hello', {
  documentPath: '/example.mdx',
});

console.log(result.html);
```

## Public Entry Points

- `mdx-forge/compiler`
- `mdx-forge/compiler/plugins`
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

- `compileSafe()` compiles MDX to HTML for non-executing preview flows
- `compileTrusted()` compiles MDX to executable JavaScript for host-controlled trusted rendering
- built-in remark/rehype support includes GFM, alerts, directives, math, diagrams, heading anchors, and syntax highlighting

### Browser Runtime

- `loadModule()` recursively loads modules and their dependencies
- module evaluation uses `new Function()` and requires a host that intentionally allows that execution model
- the registry layer coordinates module cache, style cache, and dependency tracking

### Components

- generic built-ins such as `Callout`, `Tabs`, `TabItem`, `CodeGroup`, and `Collapsible`
- framework shims for Docusaurus, Starlight, Nextra, and Next.js
- registry metadata used by codegen and host alias resolution

## Security Notes

- `mdx-forge/browser` evaluates code with `new Function()`
- hosts must explicitly enforce their own trust and path boundaries
- Safe compilation is a compile mode, not a full sanitization boundary by itself
- runtime style injection may require `style-src 'unsafe-inline'` or a nonce-aware host strategy

## Build and Test

```bash
npm run build
npm run typecheck
npm test
```

## License

MIT. See `LICENSE`.
