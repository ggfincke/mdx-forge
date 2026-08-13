# mdx-forge-render

Claude Code plugin that exposes two MCP tools for authoring MDX with
structured feedback:

- `render_mdx` — compile MDX to HTML (Safe or Trusted Mode), publish a
  live-reloading preview, optionally screenshot, and return structured
  diagnostics (unknown components, invalid props, frontmatter gaps) with
  line numbers and did-you-mean suggestions.
- `list_components` — look up the framework's component registry (names,
  required/optional props, enum values, examples) before writing MDX.

## Install

```bash
# add the mdx-forge marketplace (if not already added)
/plugin marketplace add ggfincke/mdx-forge

# install the render plugin
/plugin install mdx-forge-render@mdx-forge
```

After installing, run `npm install` in the plugin directory once. Repository
development uses Node 24.19.0 and npm 11.17.0, while the plugin retains its
Node 22+ runtime floor. Installation fetches Chromium via Playwright's
postinstall (~170MB download):

```bash
cd "$(claude plugin path mdx-forge-render)"
npm install
npm run build
```

## Supported mdx-forge core range

This package is versioned independently from the `mdx-forge` core — the
plugin version, the core version, and the marketplace metadata version are
deliberately **not** coupled.

- **Declared range:** the `mdx-forge` entry in `package.json` (`^0.10.0`)
  is the minimum-supported core line. The lockfile pins the exact minimum
  the plugin is proven against.
- **Current core:** the repository's `check:plugin-compat` gate also
  installs the current packed core tarball into a clean copy of this
  plugin and re-runs typecheck, build, and bounded smokes — so every core
  release candidate is proven against this plugin before publishing.
- **Bumping the range:** raising the minimum (or absorbing a new major or
  minor line) is a deliberate release step, made after the compat gate
  passes, never an implicit side effect of a core release.

### Diagram fences

The plugin ships no Mermaid/PlantUML/Graphviz runtime, so it requests
`diagramBehavior: 'code'` from the compiler: diagram fences render as
visible, language-labeled code blocks instead of empty placeholder divs
across the supported core range.

### Unified diagnostics engine

Every supported core exposes the extended analysis API at
`mdx-forge/diagnostics/analyze`. The lint pass delegates to
`analyzeMdxDocument`, so one core parse powers every diagnostic rule —
correct JSX name grammar, prop validation, compound member checks, and
file-relative positions across frontmatter — while the plugin only
adapts stable `MDXF###` codes to its MCP shape. This includes diagnostics
for values such as `open="false"` and `only=`, plus unknown dotted members
such as `FileTree.Nope`.

## Tool: `render_mdx`

| Param         | Type                                                               | Default      |
| ------------- | ------------------------------------------------------------------ | ------------ |
| `source`      | string (MDX)                                                       | required     |
| `framework`   | `'generic' \| 'docusaurus' \| 'starlight' \| 'nextra' \| 'nextjs'` | `'generic'`  |
| `mode`        | `'safe' \| 'trusted'`                                              | `'safe'`     |
| `screenshot`  | boolean                                                            | `false`      |
| `screenshots` | `{ themes?, viewports?, fullPage? }`                               | unset        |
| `theme`       | `'light' \| 'dark'`                                                | `'light'`    |
| `viewport`    | `{ width?, height? }`                                              | `1024 x 768` |
| `inlineHtml`  | boolean                                                            | `false`      |
| `autoOpen`    | boolean                                                            | `false`      |

Returns a variable-length content sequence:

1. **Lead-in text** with a live preview URL + `file://` fallback.
2. **Zero or more labeled PNG image blocks**. `screenshot: true` requests one;
   `screenshots` requests the themes × viewports matrix and takes precedence
   when both inputs are present.
3. **Trailing text** with a `### Warnings` section (plain-text
   diagnostics), the frontmatter (JSON), and a `### Summary` of body /
   full-HTML byte sizes. The full self-contained HTML for claude.ai
   artifacts is only inlined when `inlineHtml: true` — the default keeps
   responses small and points at the preview URL instead.

## Render budgets

Inputs and outputs are bounded in both the MCP schema and the direct
`renderMdx()` API; oversized requests are rejected before allocation.

| Budget                      | Constant                     | Default  |
| --------------------------- | ---------------------------- | -------- |
| Max source size             | `MAX_SOURCE_BYTES`           | 1 MiB    |
| Max viewport width/height   | `MAX_VIEWPORT_DIMENSION`     | 4000 px  |
| Max per-variant pixels      | `MAX_VARIANT_PIXELS`         | 10 MP    |
| Max aggregate pixels        | `MAX_AGGREGATE_PIXELS`       | 48 MP    |
| Max full-page scroll height | `MAX_FULLPAGE_SCROLL_HEIGHT` | 20000 px |
| Max PNG size                | `MAX_PNG_BYTES`              | 8 MiB    |
| Max response size           | `MAX_RESPONSE_BYTES`         | 24 MiB   |

Temp preview artifacts are pruned on server start and after each render
beyond `MAX_PREVIEW_ARTIFACTS` (50) and `PREVIEW_ARTIFACT_TTL_MS` (24h).

When MDX fails to compile or render, the tool returns `isError: true`
with a structured payload:

```json
{
  "error": {
    "kind": "unknown-component",
    "component": "Tab",
    "suggestion": "TabItem",
    "line": 12,
    "column": 1,
    "message": "Component <Tab> is not in the \"generic\" shim registry."
  },
  "warnings": [/* any diagnostics accumulated before the failure */]
}
```

## Tool: `list_components`

| Param       | Type                                                               | Default     |
| ----------- | ------------------------------------------------------------------ | ----------- |
| `framework` | `'generic' \| 'docusaurus' \| 'starlight' \| 'nextra' \| 'nextjs'` | `'generic'` |
| `name`      | string (component name or alias)                                   | all         |

Returns the shim registry as JSON. When `name` is supplied, responds
with the full spec for that one component (props, required flags, enum
values, description, example). Otherwise responds with every component
the framework exposes plus the generic set it inherits, plus the
framework's frontmatter schema.

**Why call it:** so you write correct MDX without guessing at prop
names or enum values. Instead of shipping `<Callout type="danger">`
and only discovering a framework accepts `info | warning | error`
after a failed render, look up the contract first.

## Diagnostics

Both tools produce diagnostics with a stable shape:

```ts
interface Diagnostic {
  kind:
    | 'mdx-syntax'
    | 'unknown-component'
    | 'invalid-prop'
    | 'missing-required-prop'
    | 'invalid-prop-value'
    | 'deprecated-alias'
    | 'missing-frontmatter'
    | 'unknown-frontmatter'
    | 'invalid-frontmatter-type'
    | 'runtime-error'
  severity: 'error' | 'warning'
  message: string
  line?: number
  column?: number
  component?: string
  prop?: string
  field?: string
  suggestion?: string
}
```

The lint pass analyzes the MDX before compiling, so unknown components
and malformed props are caught cheaply and reported with positions.
With a core that ships the unified diagnostics engine (see “Unified
diagnostics engine” above), positions are original-file line numbers
even below frontmatter, string values on boolean props
(`open="false"`) and non-event `on*` names (`only=`) are flagged, and
dotted members are validated against the known compound components.
Frontmatter is validated against per-framework schemas (e.g.,
Starlight requires `title`, Docusaurus accepts
`sidebar_position: number`).

Chat-surface compatibility:

- **Claude Code (CLI)**: click the `file://` URL to open in your browser.
- **Claude desktop**: same, plus the PNG appears inside the collapsed Result panel.
- **claude.ai web**: ask Claude to read the preview file and convert it
  into an HTML artifact for inline side-panel rendering.

## Rendering modes

### Safe Mode (default)

`compileSafe()` produces static, sanitized HTML. No JavaScript runs.
Custom JSX tags render as styled placeholders. Use this when fidelity to
the framework component library isn't required.

### Trusted Mode (`mode: 'trusted'`)

`compileTrusted()` compiles the MDX to JavaScript. The live preview served
at `http://127.0.0.1:<port>/preview` loads the harness bundle directly in
**your browser** — so tab switches, form state, hooks, and onClick handlers
all run for real. For the `html` snapshot used in the MCP response +
screenshot, the same module is also rendered once in a sandboxed,
network-blocked Chromium process driven by Playwright.

The `fullHtml` block returned to claude.ai is fully self-contained: the
per-framework harness bundle is inlined (~650 KB) so the artifact renders
React interactively on its own without reaching the preview server.

**What's supported:**

- JSX tags for components in the selected framework's shim barrel
  (`<Tabs>`, `<TabItem>`, `<Callout>`, etc.) — resolved at render time
  via `MDXProvider`.
- Frontmatter, GFM, math, Shiki code highlighting — same as Safe Mode.

**What's not supported:**

- `import` statements for user modules. Use JSX tags directly instead of
  `import Tabs from '@theme/Tabs'`.
- Framework components that aren't in `mdx-forge/components/{framework}`
  will throw `Expected component 'X' to be defined`.

**Security boundary:** The headless snapshot runs in a Chromium context
with all non-`file://` / non-`data:` network requests blocked. The live
preview, by contrast, runs in _your_ browser against `127.0.0.1` with no
additional sandboxing — same security posture as any page you visit on
localhost. Only render MDX you author or trust.

**Performance:** first call per framework cold-starts ~1–2s (Playwright
page load + React bundle parse). Subsequent calls reuse the cached harness
page and land in ~100–300ms. The browser-side mount is whatever React 19
takes to hydrate the component tree, typically <50ms.

## Scope

- Screenshots reflect the chosen framework's CSS bundle plus `tokens.css`.
- `nextjs` framework has no bundled CSS — screenshots use the default
  body styles only.
- Trusted Mode bundles ship pre-built under `dist/harness/{framework}/`
  (roughly 600 KB each, five frameworks). They're regenerated on
  `npm run build` via the `build-harness` script.

## License

MIT
