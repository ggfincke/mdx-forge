# mdx-forge-render

Claude Code plugin that exposes a single MCP tool, `render_mdx`, for
compiling MDX to HTML (via `mdx-forge` Safe Mode) with an optional
headless-Chromium screenshot.

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
1. **Lead-in text** with a `file://` URL to a self-contained HTML preview
   saved in your tmp directory — click to open in your default browser for
   the full-fidelity render (real CSS, Shiki colors, framework shims).
2. **PNG screenshot** (only when `screenshot: true`) — useful as a fallback
   in chat surfaces that don't render `file://` links.
3. **Trailing text** with the compiled HTML body (fenced), parsed
   frontmatter (JSON), and agent directives so the model surfaces the
   preview URL in its reply.

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
