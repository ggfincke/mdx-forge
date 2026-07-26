# mdx-forge/compiler/plugins — reference

Plugin pipeline subsystem. Subpath: `mdx-forge/compiler/plugins`. Source:
`src/compiler/plugins/`.

This is the lower-level plugin building block. Most consumers should call
`compileSafe` / `compileTrusted` & let them assemble pipelines internally —
reach for this subpath when building custom pipeline introspection or
codegen tooling.

## Exports

| Symbol                       | Kind     | Brief                                             |
| ---------------------------- | -------- | ------------------------------------------------- |
| `loadPluginsFromConfig`      | function | Resolve & load plugins from a `ResolvedConfig`    |
| `mergePlugins`               | function | Concat built-in + custom plugin arrays            |
| `parsePluginSpec`            | function | Split `PluginSpec` → `{ name, options }`          |
| `getPluginName`              | function | Extract just the plugin name from a spec          |
| `buildTrustedPluginPipeline` | function | Assemble Trusted Mode remark + rehype phases      |
| `buildTrustedRemarkPlugins`  | function | Just the Trusted Mode remark phase                |
| `buildTrustedRehypePlugins`  | function | Just the Trusted Mode rehype phase                |
| `getSafeRemarkPlugins`       | function | Safe Mode remark plugins (shared subset)          |
| `getSafeRehypePluginSets`    | function | Safe Mode rehype plugin sets (split for raw/math) |
| `REHYPE_RAW_CONFIG`          | const    | Default `rehype-raw` config                       |

## `PluginSpec` — what users author

```ts
type PluginSpec = string | [string, Record<string, unknown>]
```

Two valid shapes:

```jsonc
// 1. bare specifier — uses plugin defaults
"remark-toc"

// 2. specifier + options
["remark-toc", { "tight": true, "maxDepth": 3 }]
```

The string is resolved as a Node module from the config file's directory.
Both relative paths (`"./local-plugin.js"`) & npm packages (`"remark-toc"`)
work.

## `MdxPreviewConfig` — `.mdx-previewrc.json` schema (subset)

```ts
interface MdxPreviewConfig {
  remarkPlugins?: PluginSpec[]
  rehypePlugins?: PluginSpec[]
  components?: ComponentMapping // name → import path
}

type ComponentMapping = Record<string, string>
```

Example:

```json
{
  "remarkPlugins": ["remark-toc", ["remark-frontmatter", { "type": "yaml" }]],
  "rehypePlugins": ["rehype-prism-plus"],
  "components": {
    "MyChart": "./src/components/MyChart.tsx",
    "Callout": "@mdx-preview/shims/docusaurus/Callout"
  }
}
```

The full `.mdx-previewrc.json` schema may have additional fields layered
on by consumers (e.g., vsc-mdx-preview adds settings like `safeMode`,
`framework`, etc.) — `MdxPreviewConfig` is the _compiler-relevant subset_.

## `loadPluginsFromConfig(config, compilerConfig)`

```ts
function loadPluginsFromConfig(
  config: ResolvedConfig | undefined,
  compilerConfig: CompilerConfig
): Promise<LoadedPlugins>

interface ResolvedConfig {
  config: MdxPreviewConfig
  configPath: string // absolute path to the config file
  configDir: string // dirname of the config file
}

interface LoadedPlugins {
  remarkPlugins: Pluggable[]
  rehypePlugins: Pluggable[]
  errorCount: number
}
```

Behavior:

1. If `config` is undefined or has no plugins, returns empty arrays
2. Calls `compilerConfig.trustValidator?.isTrusted(...)` if present —
   untrusted = empty arrays + reported error
3. For each `PluginSpec`:
   - Resolves via `compilerConfig.pluginLoader` (or default Node loader)
   - Loads the module, extracts the plugin function (`default` export, then
     named export matching plugin name, then the module itself if callable)
   - Wraps as `[fn, options]` if options were provided
4. Per-plugin failures are reported individually (via `errorReporter` if
   provided, else logged) & counted in `errorCount`

Trusted Mode only — Safe Mode warns & ignores custom plugins. (The
function itself doesn't gate on mode; it's the call sites in `compileSafe`
vs `compileTrusted` that decide.)

## `mergePlugins(builtIn, custom)`

```ts
function mergePlugins(builtIn: Pluggable[], custom: Pluggable[]): Pluggable[]
```

Returns `builtIn` unchanged if `custom.length === 0`, else concatenates
`[...builtIn, ...custom]`. Custom plugins always run _after_ built-ins.

## `parsePluginSpec(spec)` / `getPluginName(spec)`

```ts
function parsePluginSpec(spec: PluginSpec): {
  name: string
  options: Record<string, unknown> | undefined
}

function getPluginName(spec: PluginSpec): string
```

Utility splitters. `parsePluginSpec(['remark-toc', { tight: true }])` →
`{ name: 'remark-toc', options: { tight: true } }`. `getPluginName` just
returns the name.

## Trusted Mode pipeline builders

```ts
function buildTrustedPluginPipeline(
  custom: LoadedPlugins,
  diagramBehavior?: DiagramBehavior
): {
  remarkPlugins: Pluggable[]
  rehypePlugins: Pluggable[]
}

function buildTrustedRemarkPlugins(custom: LoadedPlugins): Pluggable[]
function buildTrustedRehypePlugins(
  custom: LoadedPlugins,
  diagramBehavior?: DiagramBehavior
): Pluggable[]
```

These assemble the full Trusted Mode pipeline (built-ins + custom) from a
`LoadedPlugins` result. `diagramBehavior` selects empty diagram
placeholders (default) or the visible code fallback. Used internally by
`compileTrusted`. Call directly only when building custom pipelines
outside the compile functions (e.g., for testing or codegen).

## Safe Mode pipeline builders

```ts
function getSafeRemarkPlugins(): Pluggable[]

function getSafeRehypePluginSets(diagramBehavior?: DiagramBehavior): {
  raw: Pluggable // rehype-raw config
  preMath: Pluggable[] // diagram fences (placeholder or code fallback)
  math: Pluggable // KaTeX
  postMath: Pluggable[] // plugins after KaTeX (slug, autolink, shiki, etc.)
}
```

Safe Mode splits the rehype phase into sets so the host can interleave its
own plugins around `rehype-raw` & math without re-implementing the order.

## Plugin loader contract

```ts
interface PluginLoader {
  resolve(specifier: string, fromDir: string): string
  load(resolvedPath: string): Promise<unknown> | unknown
}
```

Default behavior uses Node's `import.meta.resolve` + dynamic `import()`.
Override via `compilerConfig.pluginLoader` when:

- Running in a non-Node environment (browser preview server, edge runtime)
- Resolving from a virtual filesystem
- Sandboxing plugin loads behind a permission system

## Pipeline types (advanced)

The pipeline-related types exported through the `mdx-forge/compiler` type
barrel are:

- `LoadedPlugins` — `{ remarkPlugins, rehypePlugins, errorCount }`
- `ParsedPluginSpec` — `{ name, options }` from `parsePluginSpec`
- `PluginPipeline` — `{ remarkPlugins, rehypePlugins }`
- `PipelineWarning` / `PipelineWarningCode` — structured Safe Mode &
  markdown-format warnings (`MDX001`, `MDX002`, `MDX009`)

There is no annotated per-phase introspection API. Consumers wanting
plugin-level visibility should observe via `CompilerLogger`
(`debug`-level logs name each loaded plugin).
