# mdx-forge-render

MCP plugin for authoring MDX with structured feedback and viewing files in
compatible desktop hosts:

- `render_mdx` — compile MDX to HTML (Safe or Trusted Mode), publish a
  live-reloading preview, optionally screenshot, and return structured
  diagnostics (unknown components, invalid props, frontmatter gaps) with
  line numbers and did-you-mean suggestions.
- `list_components` — look up the framework's component registry (names,
  required/optional props, enum values, examples) before writing MDX.
- `open_mdx_file` — desktop file entrypoint for `.md` and `.mdx` resources.
- `render_file_preview` — app-only compilation used by the file viewer.

## File-viewer prototype

Build and open the included sample in a local prototype host:

```bash
cd plugins/render
npm ci
npm run build
npm run viewer:demo -- prototype/showcase.mdx
```

Open the printed loopback URL. Save edits to the selected file to refresh the
preview automatically, including editors that replace the file on save. The
host reads only that file and never writes it. `Refresh` also works manually.
The host banner identifies this as a local simulator; native ChatGPT plugin
registration and beside-conversation placement are still unverified.

Markdown uses Forge's CommonMark pipeline. MDX starts in Safe mode, with
sanitized HTML and JavaScript disabled. Enable `Interactive` for working
framework shims such as Tabs and Collapsible, or inline MDX components and
hooks. Interactive code runs in a separate iframe with an opaque origin,
network access blocked, and no host tool bridge. Selecting a new file or
turning Interactive off removes the running frame. `.md` files stay in Safe
mode. Local component imports, remote assets, and custom plugins are outside
this prototype's scope.

Syntax errors retain the last successful preview and display an error.
Top-level JavaScript and React render failures display a runtime diagnostic
inside the interactive preview. Fixing the file triggers another render.
Framework, theme, source inspection, and diagnostics controls are included.
Edits rebuild the document and reset component state.

### Desktop integration

The server advertises a file entrypoint with
`_meta['openai/ui'].entrypoints` and an MCP Apps resource at
`ui://mdx-forge/file-viewer.html`. The viewer uses
`@openai/mcp-extensions` to read the supplied opaque resource URI as text,
subscribe to resource updates, and reread after each notification. The
compiler receives source through the app-only tool; it does not resolve
arbitrary host paths or execute authored JavaScript on the server.

This follows the official [file-viewer extensions](https://developers.openai.com/plugins/build/extensions)
and [MCP Apps UI](https://developers.openai.com/plugins/build/chatgpt-ui)
contracts. `plugin.json` and `mcp.json` provide a portable stdio package using
the current [plugin packaging format](https://developers.openai.com/plugins/build/plugins).
The existing Claude manifest and MCP configuration remain available.
Registering it in a native host is a separate acceptance step; this source
package has not been installed or published.

The extension SDK currently requires MCP Apps 1.x, so its two UI dependencies
are pinned together. The viewer bundles executable browser code ahead of
time, avoiding a runtime `new Function()` under the host's default CSP.
Both source and output size budgets apply to the viewer tools.

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

Each theme settles before its rendered dimensions are measured. Full-page
captures apply the height and pixel budgets to that measured rectangle, with
aggregate pixels counted across all viewport groups. Screenshots use CSS-pixel
scaling and a fixed clip: they represent the measured snapshot, so subsequent
layout growth does not enlarge the image allocation. PNG byte limits still
apply after capture.

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
diagnostics engine” above), positions are original-file line and column numbers,
including fatal MDX body parse failures after frontmatter. String values on
boolean props (`open="false"`) and non-event `on*` names (`only=`) are flagged, and
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
