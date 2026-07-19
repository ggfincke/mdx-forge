# mdx-forge/compiler — reference

Full API surface for the compiler domain. Subpath: `mdx-forge/compiler`.
Source: `src/compiler/index.ts`. Types: `src/compiler/types/` and
`src/compiler/safe-document/types.ts`.

## Contents

- [Exports](#exports)
- [`compileSafeDocument`](#compilesafedocumentsource-options)
- [`compileSafe`](#compilesafemdxtext-config)
- [`compileTrusted`](#compiletrustedmdxtext-_isentry-config)
- [Compiler config and Safe Mode behavior](#compilerconfig)
- [Frontmatter helpers](#extractfrontmattermdxtext)
- [Known components and constants](#known_generic_components)
- [Plugin loading and host services](#loadpluginsfromconfigconfig-compilerconfig)
- [Advanced pipeline phases](#pipeline-phases-advanced)

## Exports

| Symbol                     | Kind     | Brief                                                      |
| -------------------------- | -------- | ---------------------------------------------------------- |
| `compileSafeDocument`      | function | MDX → versioned JSON-only structural document              |
| `SAFE_DOCUMENT_VERSION`    | constant | Current structured-document contract version (`1`)         |
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
| `DocumentFormat`           | type     | `'detect' \| 'md' \| 'mdx'`                                |
| `DiagramBehavior`          | type     | `'placeholder' \| 'code'`                                  |
| `PluginSpec`               | type     | `string \| [string, Record<string, unknown>]`              |
| `MdxPreviewConfig`         | type     | `.mdx-previewrc.json` schema subset                        |
| `ResolvedConfig`           | type     | Loaded config + `configPath` + `configDir`                 |
| `NextraPageMeta`           | type     | Nextra page-level metadata                                 |
| `CompilerLogger`           | type     | Logger contract (`debug`/`info`/`warn`/`error`)            |
| `TrustValidator`           | type     | Trust check contract for plugin loading                    |
| `PluginLoader`             | type     | Module-resolution contract for custom plugins              |
| `ErrorReporter`            | type     | Error reporter for plugin load failures                    |
| `PluginLoadError`          | type     | Plugin load error payload                                  |

## `compileSafeDocument(source, options?)`

```ts
function compileSafeDocument(
  source: string,
  options?: SafeDocumentCompileOptions
): Promise<SafeDocument>;
```

Structured compilation is the closed-data path for untrusted MDX that needs
host-rendered components. It parses with a fixed `remark-parse` + `remark-gfm`

- `remark-mdx` pipeline and returns no HTML, JavaScript, React values, imports,
  plugins, or compiler AST objects.

`source` must be a JavaScript string; other runtime values throw `TypeError`
before parsing so ranges always use string-relative UTF-16 offsets.

It does not accept `CompilerConfig`, component import paths, plugin loaders,
trust validators, or browser/runtime options. The structured path never calls
Trusted Mode or component import generation.

### Component schemas

```ts
interface SafeDocumentCompileOptions {
  components?: Readonly<Record<string, SafeDocumentComponentSchema>>;
  unknownComponents?: 'reject' | 'inert'; // default: reject
  rawHtml?: 'reject' | 'allow'; // default: reject
  allowUrl?: (url: string, context: SafeDocumentUrlContext) => boolean;
}

interface SafeDocumentComponentSchema {
  props?: Readonly<Record<string, SafeDocumentValueSchema>>;
  requiredProps?: readonly string[];
  children?: 'none' | 'optional' | 'required';
}

type SafeDocumentValueSchema =
  | {
      type: 'string';
      enum?: readonly string[];
      format?: 'url';
      maxLength?: number;
    }
  | {
      type: 'number';
      integer?: boolean;
      minimum?: number;
      maximum?: number;
    }
  | { type: 'boolean' }
  | { type: 'null' }
  | {
      type: 'array';
      items: SafeDocumentValueSchema;
      maxItems?: number;
    }
  | {
      type: 'object';
      properties: Readonly<Record<string, SafeDocumentValueSchema>>;
      required?: readonly string[];
      additionalProperties?: false;
      maxProperties?: number;
    };
```

Nested object schemas are closed. Unknown nested keys fail validation;
`additionalProperties: true` is not supported. Options and schemas are
normalized once from own data properties into a frozen internal snapshot;
inherited fields are ignored, while accessors, symbols, unknown fields,
malformed values, and cycles throw `TypeError` before source parsing.
Null-prototype records remain supported. Document-authored problems return
diagnostics instead.

Reserved component props are forbidden even if a schema declares them:
`children`, `style`, `dangerouslySetInnerHTML`, `__html`, `key`, `ref`,
prototype-sensitive keys, and React-style `onXxx` event props.

### Literal rules

String attributes remain strings and shorthand attributes become `true`.
Expression attributes are decoded directly from remark-mdx's ESTree without
`eval`, `Function`, imports, or a second JavaScript runtime.

Allowed expression values:

- finite string, number, boolean, and `null` literals
- unary negative finite numbers
- no-substitution template literals
- recursively literal arrays without holes or spreads
- recursively literal objects with plain, noncomputed `init` properties

Rejected expression values include identifiers, calls, member access,
assignments, functions, classes, JSX, binary/logical/conditional expressions,
spreads, computed/method/shorthand properties, expression templates, regex,
bigint, `NaN`, infinities, and prototype-sensitive object keys. Literal data is
bounded to 16 nested levels and 1,000 value nodes.

Standalone MDX expressions and all MDX ESM imports/exports are error
diagnostics and never appear in the returned tree.

### Document tree

```ts
interface SafeDocument {
  version: 1;
  frontmatter: Record<string, SafeDocumentJsonValue>;
  root: SafeDocumentRootNode;
  diagnostics: SafeDocumentDiagnostic[];
}

interface SafeDocumentRootNode {
  type: 'root';
  children: SafeDocumentNode[];
  source?: DiagnosticRange;
}

type SafeDocumentNode =
  | SafeDocumentTextNode
  | SafeDocumentElementNode
  | SafeDocumentComponentNode
  | SafeDocumentUnknownComponentNode;
```

The parsed document is preflighted iteratively before conversion. Documents
deeper than 64 source nodes or larger than 10,000 source nodes return
`MDXF110`, an empty root, and no recursive conversion attempt.

The structural element vocabulary is fixed to:

```text
a blockquote br code del em h1 h2 h3 h4 h5 h6 hr img li ol p pre
strong table tbody td th thead tr ul
```

Per-tag props are also fixed:

- `a`: required `href`, optional `title`
- `img`: required `src` and `alt`, optional `title`
- `code`: optional semantic `language` and `meta`
- `ol`: optional integer `start`
- `li`: optional boolean `checked`
- `td` / `th`: optional `align` (`left`, `center`, or `right`)
- every other tag has no props

GFM tables become `table > thead|tbody > tr > th|td`; fenced code becomes
`pre > code`. Reference links resolve through document definitions. Unsupported
Markdown variants produce diagnostics rather than untyped passthrough nodes.

Frontmatter is canonicalized separately into JSON values. Valid YAML dates
become ISO strings. Non-finite numbers, unsupported scalar types, cyclic or
non-plain objects, and prototype-sensitive keys produce `MDXF020`; unsafe data
does not enter `frontmatter`.

### Unknown components, raw elements, and URLs

- `unknownComponents: 'reject'` (default) emits an error, removes the wrapper
  and every unvalidated prop, and retains only safely converted children.
- `unknownComponents: 'inert'` emits a warning and returns an
  `unknownComponent` node containing only its name, safe children, and source.
- `rawHtml: 'reject'` (default) diagnoses lowercase MDX intrinsic syntax and
  removes the wrapper while retaining safe children.
- `rawHtml: 'allow'` still permits only the fixed tag and per-tag prop
  vocabulary above. It never emits raw HTML, arbitrary tags/attributes, or an
  HTML string.
- `br`, `hr`, and `img` are always void; authored children are diagnosed and
  discarded.

The built-in URL policy applies to Markdown links/images, intrinsic
`href`/`src`, and every component string schema marked `format: 'url'`,
including strings nested in objects or arrays. It allows relative/query/fragment
references plus `http:`, `https:`, `mailto:`, and `tel:`. It rejects slash- or
backslash-based network-path URLs, ASCII control/space obfuscation, and every
other protocol, including `javascript:`, `data:`, `blob:`, and `file:`. A
rejected nested URL drops its top-level authored prop without affecting sibling
props. `allowUrl` can narrow this baseline but cannot authorize a URL the
built-in policy rejected. A host callback must return the literal boolean
`true`; false, thrown errors, Promises, and other non-booleans fail closed.

Rejected links unwrap to safe children; rejected images are omitted.

### Diagnostics and source ranges

Structured diagnostics are JSON-only and use the shared stable codes:

| Code      | Structured meaning                                |
| --------- | ------------------------------------------------- |
| `MDXF001` | unknown host component                            |
| `MDXF002` | unknown component prop                            |
| `MDXF006` | missing required prop                             |
| `MDXF007` | invalid prop or children                          |
| `MDXF020` | non-JSON or invalid frontmatter                   |
| `MDXF030` | missing reference-link definition                 |
| `MDXF100` | MDX parse failure                                 |
| `MDXF110` | ESM, executable expression, or unsupported syntax |
| `MDXF111` | unsafe or host-denied URL                         |
| `MDXF112` | element outside the closed vocabulary             |
| `MDXF113` | attribute outside the per-tag/host schema         |
| `MDXF114` | raw element syntax rejected by policy             |

Ranges use unist conventions: 1-based line and column, 0-based UTF-16 offset,
exclusive end. Node and diagnostic ranges are rebased to the original complete
document, including stripped frontmatter.

Treat any `severity: 'error'` diagnostic as a failed document. Render only the
returned closed node vocabulary; do not reinterpret source strings as HTML,
JavaScript, JSX, React elements, or import specifiers.

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
- Diagram fences (mermaid/plantuml/dot/graphviz) become empty placeholder
  divs by default; pass `diagramBehavior: 'code'` for a visible fallback
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

  // parse mode; defaults to 'detect' (.md -> md, otherwise mdx)
  format?: 'detect' | 'md' | 'mdx';

  // diagram fence output; defaults to 'placeholder' (empty data-attribute
  // divs for renderer-owning hosts); 'code' emits a visible, language-
  // labeled code fallback for hosts without a diagram runtime
  diagramBehavior?: 'placeholder' | 'code';

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

Wraps `gray-matter` with its executable JavaScript engine disabled, then
normalizes the parsed data into bounded acyclic plain values (depth, node
& projected-size caps). Prototype-sensitive mapping keys are dropped. Cyclic
or amplification-heavy YAML alias graphs throw a deterministic error instead
of reaching consumers. Use this instead of raw `gray-matter` anywhere
caller-authored MDX frontmatter is parsed.

## `extractNextraFrontmatter(frontmatter)`

Takes an **already-parsed frontmatter object** (e.g., the `frontmatter`
returned by `extractFrontmatter` / `compileSafe`), not MDX text, & projects
the Nextra-relevant fields:

```ts
function extractNextraFrontmatter(
  frontmatter: Record<string, unknown>
): Partial<NextraPageMeta>;

interface NextraPageMeta {
  title?: string;
  layout?: 'default' | 'full' | 'raw';
  description?: string;
  toc?: boolean;
}
```

Only `title` (with `sidebarTitle` taking precedence), `description`, &
`layout` are populated; `toc` exists on the type but is not extracted.
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
