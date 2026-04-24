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

After installing, run `npm install` in the plugin directory once — this
fetches Chromium via Playwright's postinstall (~170MB download):

```bash
cd "$(claude plugin path mdx-forge-render)"
npm install
npm run build
```

## Tool: `render_mdx`

| Param       | Type                                                              | Default       |
| ----------- | ----------------------------------------------------------------- | ------------- |
| `source`    | string (MDX)                                                      | required      |
| `framework` | `'generic' \| 'docusaurus' \| 'starlight' \| 'nextra' \| 'nextjs'` | `'generic'`   |
| `mode`      | `'safe' \| 'trusted'`                                             | `'safe'`      |
| `screenshot`| boolean                                                           | `false`       |
| `theme`     | `'light' \| 'dark'`                                               | `'light'`     |
| `viewport`  | `{ width?, height? }`                                             | `1024 x 768`  |

Returns three content blocks:
1. **Lead-in text** with a live preview URL + `file://` fallback.
2. **PNG screenshot** (only when `screenshot: true`).
3. **Trailing text** with a `### Warnings` section (plain-text
   diagnostics), a `### Diagnostics (structured)` JSON block, the
   frontmatter (JSON), compiled HTML body, and self-contained HTML for
   claude.ai artifacts.

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
  "warnings": [ /* any diagnostics accumulated before the failure */ ]
}
```

## Tool: `list_components`

| Param       | Type                                                              | Default       |
| ----------- | ----------------------------------------------------------------- | ------------- |
| `framework` | `'generic' \| 'docusaurus' \| 'starlight' \| 'nextra' \| 'nextjs'` | `'generic'`   |
| `name`      | string (component name or alias)                                  | all           |

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
    | 'runtime-error';
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
  component?: string;
  prop?: string;
  field?: string;
  suggestion?: string;
}
```

The lint pass walks the MDX AST before compiling, so unknown
components and malformed props are caught cheaply and reported with
positions. Frontmatter is validated against per-framework schemas
(e.g., Starlight requires `title`, Docusaurus accepts
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
preview, by contrast, runs in *your* browser against `127.0.0.1` with no
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
