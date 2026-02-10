# mdx-forge

`mdx-forge` is a unified MDX runtime toolkit with three domain exports:

- `mdx-forge/compiler` for safe and trusted MDX compilation
- `mdx-forge/browser` for browser-side module loading/evaluation
- `mdx-forge/components` for framework shim components and CSS

## Install

```bash
npm install mdx-forge
```

Peer dependencies:

- `react >= 18` for `components`
- `unified` and `@mdx-js/mdx` for `compiler`

## Quick Start

```ts
import { compileSafe } from 'mdx-forge/compiler';

const result = await compileSafe('# Hello', {
  logger: { debug() {}, warn() {}, error() {} },
});

console.log(result.html);
```

## Subpath Exports

- `mdx-forge/compiler`
- `mdx-forge/compiler/plugins`
- `mdx-forge/compiler/transforms`
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

## Security Model

- `mdx-forge/browser` evaluates code via `new Function()`.
- Consumers must allow `unsafe-eval` in CSP for `mdx-forge/browser`.
- Runtime style injection may require `style-src 'unsafe-inline'` or a nonce-aware strategy.
- The library does not validate trust boundaries for fetched code; host code must enforce trust.
- `compileSafe` is a compilation mode, not a full sanitization layer.

## Limitations

- Browser-domain runtime assumes a browser environment.
- Component domain requires matching CSS imports.
- Trusted mode compilation/execution is not suitable for untrusted code without additional controls.

## License

MIT. See `LICENSE`.
