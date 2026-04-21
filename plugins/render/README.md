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

## Scope

- Safe Mode only. No JS execution — custom components render as styled
  placeholders. See the `mdx-forge` skill for Trusted-Mode guidance.
- Screenshots reflect the chosen framework's CSS bundle plus `tokens.css`.
- `nextjs` framework has no bundled CSS — screenshots use the default
  body styles only.

## License

MIT
