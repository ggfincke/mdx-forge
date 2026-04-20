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

Returns:
- HTML (fenced code block)
- Parsed YAML frontmatter (JSON)
- PNG screenshot (when `screenshot: true`)

## Scope

- Safe Mode only. No JS execution — custom components render as styled
  placeholders. See the `mdx-forge` skill for Trusted-Mode guidance.
- Screenshots reflect the chosen framework's CSS bundle plus `tokens.css`.
- `nextjs` framework has no bundled CSS — screenshots use the default
  body styles only.

## License

MIT
