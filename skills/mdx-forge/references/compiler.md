# mdx-forge/compiler — reference

Full API surface for the compiler domain. Subpath: `mdx-forge/compiler`.
Source: `src/compiler/index.ts`. Types: `src/compiler/types/`.

## Exports

| Symbol                     | Kind     | Brief                                                      |
| -------------------------- | -------- | ---------------------------------------------------------- |
| `compileSafe`              | function | MDX → HTML (no JS execution)                               |
| `compileTrusted`           | function | MDX → executable JS                                        |
| `extractFrontmatter`       | function | YAML frontmatter splitter (gray-matter under)              |
| `safeMatter`               | function | No-eval gray-matter wrapper                                |
| `extractNextraFrontmatter` | function | Nextra-specific frontmatter (title, layout, toc)           |
| `KNOWN_GENERIC_COMPONENTS` | Set      | Set of built-in generic component names                    |
| `VALID_CALLOUT_TYPES`      | array    | Canonical callout type strings                             |
| `CalloutType`              | type     | Union of valid callout types                               |
| `GITHUB_ALERT_TYPES`       | array    | Canonical GitHub alert type strings                        |
| `loadPluginsFromConfig`    | function | Load custom remark/rehype plugins from a config            |
| `mergePlugins`             | function | Concat built-in + custom plugin arrays                     |
| `CompilerConfig`           | type     | Compiler input config                                      |
| `SafeHTMLResult`           | type     | `{ html, frontmatter }`                                    |
| `MdxTranspileResult`       | type     | `{ code, frontmatter }`                                    |
| `FrontmatterResult`        | type     | `{ content, frontmatter, bodyStartLine, bodyStartColumn }` |
| `UnknownBehavior`          | type     | `'strip' \| 'placeholder' \| 'raw'`                        |
| `PluginSpec`               | type     | `string \| [string, Record<string, unknown>]`              |
| `MdxPreviewConfig`         | type     | `.mdx-previewrc.json` schema subset                        |
| `ResolvedConfig`           | type     | Loaded config + `configPath` + `configDir`                 |
| `NextraPageMeta`           | type     | Nextra page-level metadata                                 |
| `CompilerLogger`           | type     | Logger contract (`debug`/`info`/`warn`/`error`)            |
| `TrustValidator`           | type     | Trust check contract for plugin loading                    |
| `PluginLoader`             | type     | Module-resolution contract for custom plugins              |
| `ErrorReporter`            | type     | Error reporter for plugin load failures                    |
| `PluginLoadError`          | type     | Plugin load error payload                                  |

## `compileSafe(mdxText, config)`

```ts
function compileSafe(
  mdxText: string,
  config: CompilerConfig
): Promise<SafeHTMLResult>;

interface SafeHTMLResult {
  html: string;
  frontmatter: Record<string, unknown>;
}
```

- Compiles MDX into static HTML via unified → remark → rehype-stringify
- Strips `mdxjsEsm` (imports/exports), expressions (`{...}`), & unknown JSX
  components according to `componentsUnknownBehavior`
- HTML intrinsic elements (lowercase JSX) pass through as raw HTML
- Math (KaTeX), GitHub alerts, syntax highlighting (Shiki), heading anchors,
  & callouts are all rendered server-side
- Custom remark/rehype plugins from `config.configFile` are **ignored** in
  Safe Mode (a warning is logged) — Safe Mode is intentionally minimal

The output is a complete HTML fragment. Hosts that render untrusted source
should still apply DOMPurify or equivalent sanitization & a strict CSP — the
function name "Safe" refers to the _compile mode_ (no JS execution), not to
output trust.

## `compileTrusted(mdxText, _isEntry, config)`

```ts
function compileTrusted(
  mdxText: string,
  _isEntry: boolean, // currently unused; pass `true`
  config: CompilerConfig
): Promise<MdxTranspileResult>;

interface MdxTranspileResult {
  code: string; // executable JavaScript
  frontmatter: Record<string, unknown>;
}
```

- Compiles MDX via `@mdx-js/mdx` to a JS module string
- Output uses `outputFormat: 'program'`, `jsxRuntime: 'automatic'`,
  `jsxImportSource: 'react'`, `providerImportSource: '@mdx-js/react'`
- If the source has no `export default`, a layout wrapper is injected (one
  of: `customLayoutFilePath`, `useHostMarkdownStyles`, or none)
- Component imports configured via `config.configFile.components` are
  prepended to the source before compilation
- Custom remark/rehype plugins from `config.configFile` **are loaded** in
  Trusted Mode (gated by `config.trustValidator` if provided)

The middle `_isEntry` boolean has no effect today but is required
positionally — pass `true`.

The result does not include a dependency list. The host computes
dependencies separately (e.g., by walking `import` statements in `code`)
before passing them to `evaluateModuleToComponent` in the browser.

## `CompilerConfig`

```ts
interface CompilerConfig {
  // canonical document path used for relative import generation (REQUIRED)
  documentPath: string;

  // optional explicit document directory (defaults to dirname(documentPath))
  documentDir?: string;

  // optional document URI for host-specific trust policies
  documentUri?: string;

  // layout injection (Trusted Mode only)
  customLayoutFilePath?: string;
  useHostMarkdownStyles?: boolean;
  useWhiteBackground?: boolean;

  // generic component handling
  componentsBuiltins?: boolean; // default: true
  componentsUnknownBehavior?: UnknownBehavior; // default: 'placeholder'

  // resolved .mdx-previewrc.json (or equivalent)
  configFile?: ResolvedConfig | null;

  // injected host services (all optional)
  logger?: CompilerLogger;
  trustValidator?: TrustValidator;
  pluginLoader?: PluginLoader;
  errorReporter?: ErrorReporter;

  // optional resolver for safe-mode component label rewriting
  componentNameResolver?: (name: string) => string | undefined;
}
```

`documentPath` is the only required field. Everything else is opt-in.

## `UnknownBehavior` (Safe Mode)

| Value           | Effect on unknown JSX                                       |
| --------------- | ----------------------------------------------------------- |
| `'placeholder'` | Render a styled placeholder box w/ component name (default) |
| `'strip'`       | Remove the element entirely (children dropped)              |
| `'raw'`         | Drop the wrapper but keep children inline                   |

## `extractFrontmatter(mdxText)`

```ts
function extractFrontmatter(mdxText: string): FrontmatterResult;

interface FrontmatterResult {
  content: string; // MDX body w/ frontmatter removed
  frontmatter: Record<string, unknown>; // parsed YAML object
  bodyStartLine: number; // 1-based original-doc body line
  bodyStartColumn: number; // 1-based original-doc body column
}
```

Uses `safeMatter()` under the hood, so `---js` / `---javascript` frontmatter
does not evaluate. Safe to call on input without frontmatter — returns
`{ content: mdxText, frontmatter: {}, bodyStartLine: 1, bodyStartColumn: 1 }`.

## `safeMatter(input)`

```ts
function safeMatter(input: string): GrayMatterFile<string>;
```

Wraps `gray-matter` with its executable JavaScript engine disabled. Use this
instead of raw `gray-matter` anywhere caller-authored MDX frontmatter is
parsed.

## `extractNextraFrontmatter(mdxText)`

Like `extractFrontmatter` but additionally validates & types the result as
`NextraPageMeta`:

```ts
interface NextraPageMeta {
  title?: string;
  layout?: 'default' | 'full' | 'raw';
  description?: string;
  toc?: boolean;
}
```

Use when the host integrates with Nextra's page-meta conventions.

## `KNOWN_GENERIC_COMPONENTS`

```ts
const KNOWN_GENERIC_COMPONENTS: Set<string>;
```

Set of names mdx-forge transforms into HTML in Safe Mode (Callout, Tabs,
TabItem, CodeGroup, Collapsible, etc., plus their aliases). Useful for
diagnostics — e.g., if a component name isn't in this set & isn't in the
user's `components` config, it'll render as an "unknown" placeholder.

## `VALID_CALLOUT_TYPES` / `CalloutType`

```ts
const VALID_CALLOUT_TYPES: readonly string[];
type CalloutType = (typeof VALID_CALLOUT_TYPES)[number];
```

Canonical set of callout type strings (note, warning, info, tip, danger,
caution, success, etc.). Used by completion providers, lint rules, & AST
transforms.

## `GITHUB_ALERT_TYPES`

```ts
const GITHUB_ALERT_TYPES: readonly string[];
```

Canonical GitHub-style alert types (NOTE, TIP, IMPORTANT, WARNING, CAUTION).
Matches the `> [!TYPE]` blockquote syntax.

## `loadPluginsFromConfig(config, compilerConfig)`

```ts
function loadPluginsFromConfig(
  config: ResolvedConfig | undefined,
  compilerConfig: CompilerConfig
): Promise<LoadedPlugins>;

interface ResolvedConfig {
  config: MdxPreviewConfig; // the parsed config object
  configPath: string; // absolute path to the config file
  configDir: string; // dirname of the config file
}

interface MdxPreviewConfig {
  remarkPlugins?: PluginSpec[];
  rehypePlugins?: PluginSpec[];
  components?: ComponentMapping;
}

type PluginSpec = string | [string, Record<string, unknown>];

interface LoadedPlugins {
  remarkPlugins: Pluggable[];
  rehypePlugins: Pluggable[];
  errorCount: number;
}
```

- Resolves each plugin spec from `configDir` using
  `compilerConfig.pluginLoader` (or the default Node loader)
- Trust-gated via `compilerConfig.trustValidator` if provided — failed
  trust check is reported via `errorReporter` & returns empty plugin lists
- Per-plugin failures are reported individually & counted in `errorCount`

For the schema users author in `.mdx-previewrc.json`, see
`references/plugins.md`.

## `mergePlugins(builtIn, custom)`

```ts
function mergePlugins(builtIn: Pluggable[], custom: Pluggable[]): Pluggable[];
```

Returns `builtIn` if `custom.length === 0`, else `[...builtIn, ...custom]`.
Cheap — call it without ceremony when assembling pipelines.

## Compiler-side host service contracts

These interfaces let consumers wire mdx-forge into their own observability
& trust models:

```ts
interface CompilerLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface TrustValidator {
  isTrusted(params: {
    documentPath: string;
    documentUri?: string;
    operation: string;
  }): { canExecute: boolean; reason?: string };
}

interface PluginLoader {
  resolve(specifier: string, fromDir: string): string;
  load(resolvedPath: string): Promise<unknown> | unknown;
}

interface ErrorReporter {
  reportPluginError(error: PluginLoadError): void;
}

interface PluginLoadError {
  message: string;
  code: 'PLUGIN_LOAD_ERROR' | 'PLUGIN_INVALID_EXPORT';
  pluginName: string;
  cause?: Error;
}
```

If you don't pass them, mdx-forge falls back to `console.*` logging, "trust
everything" validation, default Node module resolution, & log-only error
reporting.

## Pipeline phases (advanced)

For consumers building custom pipeline introspection (e.g., the codegen in
vsc-mdx-preview), `mdx-forge/compiler/plugins` exports lower-level
builders. See `references/plugins.md`.
