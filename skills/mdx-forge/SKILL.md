---
name: mdx-forge
description: Use when working with the mdx-forge npm package — compiling MDX with compileSafeDocument (closed JSON data), compileSafe (HTML output), or compileTrusted (executable JavaScript), wiring up the browser-side module loader (loadModule, evaluateModuleToComponent, setModuleFetcher, registerPreloadEntries), using framework component shims for Docusaurus, Starlight, Nextra, Next.js, or generic, choosing an output contract for a security boundary, configuring remark/rehype plugins via the CompilerConfig plugin pipeline, or working with mdx-forge subpath exports in a TypeScript project.
---

# mdx-forge

`mdx-forge` is an ESM-only MDX runtime toolkit (Node >= 22, MIT). It ships
four independent domains, each with its own subpath export. **There is no
root import** — `import {} from 'mdx-forge'` will fail.

## Subpath inventory

| Subpath                                  | Environment | Purpose                                     |
| ---------------------------------------- | ----------- | ------------------------------------------- |
| `mdx-forge/compiler`                     | Node        | MDX → closed data, HTML, or trusted JS      |
| `mdx-forge/compiler/plugins`             | Node        | Plugin loader, builders, `mergePlugins`     |
| `mdx-forge/diagnostics`                  | Any         | `Diagnostic`, `DIAGNOSTIC_CODES` contract   |
| `mdx-forge/diagnostics/analyze`          | Any         | `analyzeMdx`, unknown-component rules       |
| `mdx-forge/browser`                      | Browser     | `loadModule`, `evaluateModuleToComponent`   |
| `mdx-forge/browser/registry`             | Browser     | `ModuleRegistry` direct access              |
| `mdx-forge/components`                   | Both        | Factory primitives (`createCallout`, etc.)  |
| `mdx-forge/components/generic`           | Both        | Generic shims (Callout, Tabs, CodeGroup…)   |
| `mdx-forge/components/docusaurus`        | Both        | Docusaurus shims (Tabs, CodeBlock, Details) |
| `mdx-forge/components/starlight`         | Both        | Starlight shims (Card, Aside, Steps…)       |
| `mdx-forge/components/nextra`            | Both        | Nextra shims (Callout, Cards, FileTree…)    |
| `mdx-forge/components/nextjs`            | Both        | Next.js shims (Image, Link)                 |
| `mdx-forge/components/registry`          | Both        | `COMPONENT_REGISTRY`, `isGenericComponent`  |
| `mdx-forge/components/styles/<fw>.css`   | Any         | Framework CSS bundles                       |
| `mdx-forge/components/styles/tokens.css` | Any         | Shared design tokens                        |

Frameworks: `generic`, `docusaurus`, `starlight`, `nextra`, `nextjs`.

## Picking an output contract

This is a **security boundary decision**, not a performance or ergonomics
preference:

- **`compileSafeDocument()`** → returns a versioned JSON-only tree. It accepts
  fixed Markdown structure plus schema-declared host components, rejects
  executable syntax, & preserves source ranges and diagnostics. Use when an
  untrusted document needs live host-rendered components or a closed renderer.
- **`compileSafe()`** → returns `{ html, frontmatter }`. No JS executes, but
  the HTML is not sanitized. Unknown JSX components become placeholders and
  expressions are stripped. Use for static HTML flows whose host applies its
  own sanitizer/CSP as appropriate.
- **`compileTrusted()`** → returns `{ code, frontmatter }` where `code` is
  executable JavaScript. Requires a host that runs `new Function()` (or
  similar) on the output. Use only when source is trusted & you control the
  runtime.

Default to `compileSafeDocument()` for untrusted host-component documents,
`compileSafe()` for static HTML, and `compileTrusted()` only for deliberate
code execution.

## Minimal Structured Mode (Node)

```ts
import { compileSafeDocument } from 'mdx-forge/compiler';

const document = await compileSafeDocument(source, {
  components: {
    Hotspots: {
      props: {
        metric: { type: 'string', enum: ['fanIn', 'fanOut'] },
        limit: { type: 'number', integer: true, minimum: 1 },
      },
      requiredProps: ['metric'],
      children: 'none',
    },
  },
});
```

Treat any error diagnostic as a failed document. Render only the returned
closed node/tag vocabulary; never reinterpret source text as HTML or code.

## Minimal Safe Mode (Node)

```ts
import { compileSafe } from 'mdx-forge/compiler';

const { html, frontmatter } = await compileSafe(source, {
  documentPath: '/path/to/file.mdx',
});
```

`documentPath` is required — it anchors relative-import resolution. Other
`CompilerConfig` fields are optional (logger, trustValidator,
componentsBuiltins, componentsUnknownBehavior, etc.). See
`references/compiler.md` for the full list.

## Minimal Trusted Mode (Node side)

```ts
import { compileTrusted } from 'mdx-forge/compiler';

// signature: compileTrusted(mdxText, _isEntry, config)
// the middle boolean is currently unused but required positionally
const { code, frontmatter } = await compileTrusted(source, true, {
  documentPath: '/path/to/file.mdx',
});
```

`compileTrusted` does **not** return a dependency list. The host computes
dependencies separately (typically by walking imports) before passing them
to `evaluateModuleToComponent` in the browser.

## Minimal Trusted Mode (browser side)

```ts
import {
  registerPreloadEntries,
  setModuleFetcher,
  evaluateModuleToComponent,
} from 'mdx-forge/browser';

// register React, MDX runtime, framework shims, etc.
// (one-arg form targets the singleton registry)
registerPreloadEntries(preloadManifest);

// supply a fetcher the runtime calls for each listed dependency
// (typically RPC back to the host that ran compileTrusted)
setModuleFetcher(async (request, isBare, parentId) => {
  // return { fsPath, code, dependencies, css? } for the requested module
  return await rpc.fetch(request, parentId);
});

const Component = await evaluateModuleToComponent(
  code, // from compileTrusted
  '/preview.mdx', // entry file path
  dependencies // the entry's direct import specifiers (host-computed)
);
```

The runtime fetches **only the dependencies you list** (plus whatever each
`FetchResult.dependencies` lists, recursively). It does not discover
unlisted imports — `[]` is valid only when every import is preloaded.

## Need more detail?

- **Compiler API & config** (full `CompilerConfig`, `extractFrontmatter`,
  `safeMatter`, `KNOWN_GENERIC_COMPONENTS`, `VALID_CALLOUT_TYPES`,
  `GITHUB_ALERT_TYPES`)
  → read `references/compiler.md`
- **Diagnostics API** (`Diagnostic`, `DIAGNOSTIC_CODES`, `analyzeMdx`,
  `classifyComponentSource`, unknown-component data)
  → use `mdx-forge/diagnostics` and `mdx-forge/diagnostics/analyze`
- **Browser runtime setup** (`registerPreloadEntries`, `setModuleFetcher`,
  invalidation, framework-shim loading, security caveats)
  → read `references/browser-runtime.md`
- **Components & framework shims** (per-framework inventory, factory
  primitives, `COMPONENT_REGISTRY` queries, CSS dependencies, alias
  resolution)
  → read `references/components.md`
- **Plugin pipeline** (`loadPluginsFromConfig`, `mergePlugins`,
  `PluginSpec`, `MdxPreviewConfig` shape for `.mdx-previewrc.json`)
  → read `references/plugins.md`

## Common gotchas

- **No bare `mdx-forge` import** — always use a subpath. The package has no
  root export; `import { compileSafe } from 'mdx-forge'` fails.
- **React is the only peer dependency** — compiler dependencies ship with
  mdx-forge. Install `react>=18` only when consuming component entry points.
- **ESM-only** — no CJS build. Consumers must be ESM (`"type": "module"`,
  `.mjs`, or bundler-resolved).
- **Framework components need their CSS** — importing from
  `mdx-forge/components/docusaurus` without loading
  `mdx-forge/components/styles/docusaurus.css` (& usually `tokens.css`)
  gives unstyled output. Next.js is the exception — it has no bundled CSS.
- **`compileTrusted` takes 3 args, not 2** — the middle `_isEntry: boolean`
  is currently ignored but required positionally. Pass `true`.
- **Dependency lists are explicit** — `evaluateModuleToComponent` /
  `loadModule` fetch only the specifiers you pass (recursively via each
  `FetchResult.dependencies`). An unlisted, non-preloaded `import` fails
  at evaluation time; it is never discovered dynamically.
- **Diagram fences default to empty placeholders** — mermaid/plantuml/
  graphviz code blocks compile to empty `<div data-*-chart>` placeholders
  for hosts that own a diagram runtime. Hosts without one should pass
  `diagramBehavior: 'code'` in `CompilerConfig` to get a visible,
  language-labeled code fallback instead.
- **`sideEffects` is `["**/\*.css"]`\*\* — bundlers can tree-shake everything
  else aggressively, which is intended; just don't be surprised when CSS is
  the only side-effecting file.
- **Trusted Mode evaluation uses `new Function()`** — the host is
  responsible for trust enforcement. mdx-forge does not validate or
  sandbox; that's the consumer's job (e.g., VS Code Workspace Trust).

## Worked examples

Self-contained TypeScript examples live in `examples/`:

- `examples/safe-compile.ts` — minimal `compileSafe` end-to-end
- `examples/safe-document.ts` — closed host-component document compilation
- `examples/trusted-compile.ts` — minimal `compileTrusted` end-to-end
- `examples/browser-setup.ts` — wiring `registerPreloadEntries` +
  `setModuleFetcher` + `evaluateModuleToComponent`
- `examples/framework-shim.tsx` — consuming components from a framework
  subpath with the matching CSS

These are kept compile-checkable so they don't drift from the published
API.
