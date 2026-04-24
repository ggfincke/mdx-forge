# mdx-forge/browser — reference

Full API surface for the browser runtime. Subpath: `mdx-forge/browser`.
Source: `src/browser/index.ts`. Types: `src/browser/types.ts`.

This domain is browser-only. The runtime evaluates compiled MDX via
`new Function()` — the host is responsible for trust enforcement.

## Exports

| Symbol                              | Kind     | Brief                                          |
| ----------------------------------- | -------- | ---------------------------------------------- |
| `evaluateModuleToComponent`         | function | Top-level: compiled MDX → React component      |
| `loadModule`                        | function | Lower-level module loader                      |
| `evaluateModule`                    | function | Lower-level: evaluate a loaded module          |
| `createSyncRequire`                 | function | Build a sync `require` from registry contents  |
| `setModuleFetcher`                  | function | Register the host's module resolver            |
| `configureRuntime`                  | function | Set load depth, concurrency, runtime overrides |
| `registerPreloadEntries`            | function | Append preload entries (incremental)           |
| `setPreloadEntries`                 | function | Replace preload entries (overwriting)          |
| `setHostPreloadCallbacks`           | function | Wire host-specific preload behavior            |
| `registry`                          | object   | Singleton `ModuleRegistry` instance            |
| `injectStyles`                      | function | Inject CSS for a module id                     |
| `clearInjectedStyles`               | function | Remove all injected styles                     |
| `resetModules`                      | function | Clear all non-preloaded modules                |
| `resetDependencies`                 | function | Clear dependency graph but keep cache          |
| `invalidateModule`                  | function | Remove a single module from cache              |
| `invalidateModuleWithDependents`    | function | Remove a module + everything depending on it   |
| `clearAllCaches`                    | function | Hard reset (modules, styles, dependencies)     |
| `ensureFrameworkShimsLoaded`        | function | Lazy-load shims for a framework                |
| `ensureGenericShimsLoaded`          | function | Lazy-load specific generic shims               |
| `Module`                            | type     | Cached module entry                            |
| `ModuleRuntime`                     | type     | Runtime values injected into evaluated modules |
| `FetchResult`                       | type     | Shape returned by `setModuleFetcher` callback  |
| `HostPreloadCallbacks`              | type     | Host-specific preload hooks                    |
| `PreloadEntry`                      | type     | Single preload entry                           |
| `Framework`                         | type     | Framework union (no `generic`)                 |
| `FrameworkId`                       | type     | `Framework \| 'generic'`                       |

## Top-level flow

```ts
import {
  registerPreloadEntries,
  setModuleFetcher,
  evaluateModuleToComponent,
} from 'mdx-forge/browser';

registerPreloadEntries(preloadManifest);   // 1
setModuleFetcher(hostFetcher);             // 2

const Component = await evaluateModuleToComponent(
  code,                                     // from compileTrusted
  '/preview.mdx',                           // entry path
  [],                                       // initial deps; can be empty
);                                          // 3

// render Component in your React tree
```

The fetcher is invoked for every dependency the runtime can't satisfy from
preloaded modules or already-evaluated modules.

## `evaluateModuleToComponent(code, entryFilePath, dependencies)`

```ts
function evaluateModuleToComponent(
  code: string,
  entryFilePath: string,
  dependencies: string[],
): Promise<(...args: unknown[]) => unknown>;
```

- Ensures preloaded modules are initialized
- Awaits any pending framework-shim or generic-shim loads
- If `entryFilePath` differs from the previous call, performs a full
  `resetModules()`; otherwise does incremental invalidation of the entry &
  its dependents
- Calls `loadModule(entryFilePath, code, dependencies, fetcher)` to load
  the entry & all transitive deps
- Returns the module's `default` export, validated to be a function

`dependencies` can be `[]` — the runtime will discover deps via the fetcher
as the entry executes. Pre-populating it lets you load deps in parallel
before evaluation starts.

## `loadModule(entryFilePath, code, dependencies, fetcher)`

```ts
function loadModule(
  entryFilePath: string,
  code: string,
  dependencies: string[],
  fetcher: ModuleFetcher,
): Promise<Module>;

interface Module {
  id: string;
  exports: Record<string, unknown> | unknown;
  loaded: boolean;
}
```

Lower-level than `evaluateModuleToComponent`. Use when you need direct
access to the `Module` object (e.g., to read named exports, not just
`default`).

## `setModuleFetcher(fetcher)`

```ts
function setModuleFetcher(fetcher: ModuleFetcher): void;

type ModuleFetcher = (
  request: string,
  isBare: boolean,
  parentId: string,
) => Promise<FetchResult | undefined>;

interface FetchResult {
  fsPath: string;          // absolute fs path (or virtual id) of the module
  code: string;            // transpiled JS source
  dependencies: string[];  // direct deps of this module (for prefetching)
  css?: string;            // optional CSS to inject alongside the module
}
```

- `request` is the import specifier (e.g., `'./sibling.tsx'`, `'lodash'`)
- `isBare` is true for bare specifiers (`'lodash'`), false for relative
- `parentId` is the resolved id of the importer — use it to anchor relative
  resolution
- Returning `undefined` signals "module not found" — the runtime will
  surface a load error

The fetcher is **required** for any non-trivial use. Without one, the
runtime throws `Module fetcher is not configured` on the first
non-preloaded import.

## `registerPreloadEntries(entries)` / `setPreloadEntries(entries)`

```ts
function registerPreloadEntries(entries: PreloadEntry[]): void;
function setPreloadEntries(entries: PreloadEntry[]): void;

interface PreloadEntry {
  id: string;             // canonical id (e.g., 'npm://react@18')
  exports: unknown;       // the actual module exports object
  aliases?: string[];     // additional names this preload satisfies
}
```

- `registerPreloadEntries` appends — safe to call multiple times
- `setPreloadEntries` replaces — only call once at startup

The `PRELOADED_MODULE_IDS` constant gives canonical ids for the modules
mdx-forge expects to be preloaded:

```ts
const PRELOADED_MODULE_IDS = {
  react:           'npm://react@18',
  reactDom:        'npm://react-dom@18',
  reactDomClient:  'npm://react-dom/client@18',
  jsxRuntime:      'npm://react/jsx-runtime@18',
  mdxReact:        'npm://@mdx-js/react@3',
  vscodeLayout:    'npm://vscode-markdown-layout@0.1.0',
} as const;
```

Aliases let you resolve bare specifiers — e.g., `aliases: ['react']` makes
`import 'react'` resolve to your preloaded entry.

## `setHostPreloadCallbacks(callbacks)`

```ts
interface HostPreloadCallbacks {
  initPreloadedModules?: (registry: ModuleRegistry, layout: unknown) => void;
  ensureFrameworkShims?: (
    registry: ModuleRegistry,
    framework: FrameworkId,
  ) => Promise<void>;
  ensureGenericShims?: (
    registry: ModuleRegistry,
    components: string[],
  ) => Promise<void>;
}
```

Host-specific preload behavior. Standalone usage keeps default no-ops; in
the VS Code webview, real implementations register dynamically-imported
shim bundles.

## `configureRuntime(config)`

```ts
interface ModuleLoaderConfig {
  maxModuleLoadDepth?: number;        // default: large
  maxConcurrentFetches?: number;      // default: small
  preloadAliases?: Record<string, string>;
  runtime?: Partial<MDXRuntime>;
}

interface MDXRuntime {
  Fragment: unknown;
  jsx: unknown;
  jsxs: unknown;
  jsxDEV?: unknown;
  useMDXComponents?: () => Record<string, unknown>;
}
```

Override the default depth & concurrency budgets, register additional
import aliases, or inject custom JSX runtime values.

## Invalidation primitives

| Function                               | Effect                                         |
| -------------------------------------- | ---------------------------------------------- |
| `resetModules()`                       | Drop all non-preloaded modules + clear styles  |
| `resetDependencies()`                  | Drop dependency graph; keep module cache       |
| `invalidateModule(id)`                 | Drop one module                                |
| `invalidateModuleWithDependents(id)`   | Drop module + every dependent (returns Set)    |
| `clearAllCaches()`                     | Hard reset (modules, styles, deps, preloads)   |

`evaluateModuleToComponent` does the right thing automatically:

- Different entry file than last call → `resetModules()`
- Same entry file → `invalidateWithDependents(entry)` + `resetDependencies()`

Call the primitives directly for HMR-style edits or manual cache control.

## Style injection

```ts
function injectStyles(id: string, css: string): void;
function clearInjectedStyles(): void;
```

`injectStyles` adds CSS to the document, scoped to a module id. The
runtime calls this automatically when a fetcher returns `FetchResult.css`.
`clearInjectedStyles` removes everything injected — called automatically by
`resetModules`, `clearAllCaches`, & between `evaluateModuleToComponent`
calls on the same entry.

## Framework shim lazy-loading

```ts
function ensureFrameworkShimsLoaded(framework: Framework): void;
function ensureGenericShimsLoaded(components: string[]): void;
```

Both are fire-and-forget. The next call to `evaluateModuleToComponent`
awaits any pending shim load before evaluating. Typical pattern:

1. Host detects framework + used components from MDX source
2. Host calls `ensureFrameworkShimsLoaded('docusaurus')` &
   `ensureGenericShimsLoaded(['Callout', 'Tabs'])`
3. Host calls `evaluateModuleToComponent(...)` — shim loads complete first

Race-free: a new shim load started during an in-flight evaluation will be
awaited by the *next* evaluation.

## Security caveats

- `evaluateModule` & `evaluateModuleToComponent` use `new Function()` to
  execute the compiled JS. There is no sandbox.
- Hosts must enforce trust **before** calling `compileTrusted` &
  `evaluateModuleToComponent` — by checking workspace trust, enabling
  scripts only when explicit, etc.
- The browser CSP must allow `unsafe-eval` for `new Function()` to work.
- Style injection requires `style-src 'unsafe-inline'` or a nonce-aware
  host strategy.
- The fetcher is the trust boundary for module sources — validate paths
  inside the fetcher, never trust `request` blindly.

## `mdx-forge/browser/registry`

Direct access to the singleton `ModuleRegistry` for advanced introspection
(cache size, preserved ids, dependency graph). Most consumers use the top-
level `registry` re-export from `mdx-forge/browser` instead.
