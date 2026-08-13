#!/usr/bin/env node
// plugins/render/src/server.ts
// mdx-forge-render MCP tools for rendering & component registry queries

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { FRAMEWORK_IDS } from 'mdx-forge/components/registry'
import { z } from 'zod'
import {
  formatDiagnostic,
  RenderDiagnosticError,
  type Diagnostic,
} from './diagnostics.js'
import {
  MAX_RESPONSE_BYTES,
  MAX_SCREENSHOT_VARIANTS,
  MAX_SOURCE_BYTES,
  MAX_VIEWPORT_DIMENSION,
  prunePreviewArtifacts,
  renderMdx,
  shutdownBrowser,
  type CaptureVariant,
} from './render.js'
import { boundedStringify } from './frontmatter-bounds.js'
import {
  describeComponent,
  findComponent,
  getFrontmatterSchema,
  listComponentsForFramework,
  listFrameworks,
  type FrameworkId,
} from './registry.js'
import { startPreviewServer, stopPreviewServer } from './preview-server.js'
import { VIEWPORT_PRESET_NAMES } from './viewports.js'

const THEMES = ['light', 'dark'] as const

const server = new McpServer({
  name: 'mdx-forge-render',
  version: '0.2.0',
})

// --- render_mdx --------------------------------------------------------------

server.tool(
  'render_mdx',
  'Compile MDX via mdx-forge (Safe or Trusted Mode), publish it to a local live-reload HTTP server (stable URL across calls, auto-refreshes open tabs), & save a self-contained HTML file on disk. By default returns a preview URL, diagnostics, frontmatter & a size summary; pass `inlineHtml: true` to also embed the full self-contained HTML for claude.ai artifact rendering. Surfaces structured diagnostics (unknown components, prop lint, frontmatter schema mismatches) so the model can self-correct. Pass `screenshot: true` for a single PNG; pass `screenshots: { themes, viewports }` to capture a matrix of named-preset variants in one call (cap: 8).',
  {
    source: z
      .string()
      .refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_SOURCE_BYTES, {
        message: `source must not exceed ${MAX_SOURCE_BYTES} bytes`,
      })
      .describe(
        'MDX source text (inline). Frontmatter is parsed automatically.'
      ),
    framework: z
      .enum(FRAMEWORK_IDS)
      .optional()
      .describe(
        "Framework CSS bundle to apply — one of 'generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'. Default: 'generic'."
      ),
    mode: z
      .enum(['safe', 'trusted'])
      .optional()
      .describe(
        "Rendering mode. 'safe' compiles MDX to sanitized static HTML (no JS execution). 'trusted' executes the compiled MDX as React in a sandboxed, network-blocked Chromium context, giving full fidelity for JSX tags like <Tabs>, <Callout>, <Steps>, etc. Use 'trusted' when the MDX relies on framework components. Default: 'safe'."
      ),
    screenshot: z
      .boolean()
      .optional()
      .describe(
        'Single-shot PNG screenshot via headless Chromium using top-level `theme` & `viewport`. Ignored when `screenshots` matrix is also supplied. Default: false.'
      ),
    screenshots: z
      .object({
        themes: z
          .array(z.enum(THEMES))
          .min(1)
          .max(THEMES.length)
          .optional()
          .describe(
            "Themes to capture. Default: [top-level `theme` or 'light']."
          ),
        viewports: z
          .array(z.enum(VIEWPORT_PRESET_NAMES))
          .min(1)
          .max(VIEWPORT_PRESET_NAMES.length)
          .optional()
          .describe(
            'Named viewport presets: mobile (375x667), tablet (768x1024), desktop (1280x800), wide (1920x1080). Default: [top-level `viewport` or 1024x768].'
          ),
        fullPage: z
          .boolean()
          .optional()
          .describe(
            'Capture full page height vs viewport-clipped. Default: true.'
          ),
      })
      .refine(
        (v) =>
          (v.themes?.length ?? 1) * (v.viewports?.length ?? 1) <=
          MAX_SCREENSHOT_VARIANTS,
        `themes x viewports must not exceed ${MAX_SCREENSHOT_VARIANTS}`
      )
      .optional()
      .describe(
        'Matrix screenshot capture — cross-product of themes & viewports. Returns one labeled PNG per variant. Wins over `screenshot` when both are set.'
      ),
    theme: z
      .enum(THEMES)
      .optional()
      .describe(
        "Preferred color scheme for the preview & screenshot. Default: 'light'."
      ),
    viewport: z
      .object({
        width: z
          .number()
          .int()
          .positive()
          .max(MAX_VIEWPORT_DIMENSION)
          .optional(),
        height: z
          .number()
          .int()
          .positive()
          .max(MAX_VIEWPORT_DIMENSION)
          .optional(),
      })
      .optional()
      .describe('Viewport size for single-shot screenshot. Default: 1024x768.'),
    inlineHtml: z
      .boolean()
      .optional()
      .describe(
        'Inline the full self-contained HTML document (large) in the response for claude.ai artifact rendering. Default: false — the response returns the preview URL, diagnostics, frontmatter & a summary instead.'
      ),
    autoOpen: z
      .boolean()
      .optional()
      .describe(
        'Auto-open the preview URL in the default browser on the first render this session. Subsequent renders rely on live reload (no focus-stealing). Default: false.'
      ),
  },
  async (args) =>
  {
    try
    {
      const result = await renderMdx(args)
      const httpUrl = result.previewUrl
      const fileUrl = `file://${result.previewPath}`

      const leadIn = [
        `**[🖼 Open live preview in browser](${httpUrl})** — auto-reloads on every render.`,
        '',
        `Offline fallback: [${result.previewPath}](${fileUrl})`,
      ].join('\n')

      const inlineHtml = args.inlineHtml === true
      const trailingSections: string[] = [
        '### Preview URLs',
        '',
        `- Live (reloads on new renders): ${httpUrl}`,
        `- Static file: ${fileUrl}`,
        '',
      ]
      const warningsBlock = renderWarningsBlock(result.diagnostics)
      if (warningsBlock)
      {
        trailingSections.push(warningsBlock)
      }
      trailingSections.push(
        '### Frontmatter',
        '',
        '```json',
        boundedStringify(result.frontmatter, 2),
        '```',
        '',
        '### Summary',
        '',
        `- Body HTML: ${Buffer.byteLength(result.html, 'utf8')} bytes`,
        `- Full self-contained HTML: ${Buffer.byteLength(result.fullHtml, 'utf8')} bytes`,
        `- Screenshots: ${result.screenshots?.length ?? 0}`,
        `- Inline HTML in this response: ${inlineHtml ? 'yes' : 'no (pass inlineHtml: true to embed it)'}`,
        ''
      )

      // default to URL + diagnostics + frontmatter + summary; inlining the full
      // document is opt-in (F28) & already contains the body, so never ship both
      if (inlineHtml)
      {
        trailingSections.push(
          '### Full self-contained HTML (for claude.ai artifact)',
          '',
          '```html',
          result.fullHtml,
          '```',
          ''
        )
      }

      trailingSections.push(
        '### AGENT INSTRUCTIONS',
        '',
        `1. You MUST include the markdown link \`[Open preview](${httpUrl})\` in your visible reply so the user can click to view the render in their browser. Chat surfaces may hide this tool output behind a collapsed panel — the link is the user's primary path to the rendering.`,
        '',
        inlineHtml
          ? '2. If the user is on claude.ai web, ALSO create an HTML artifact using the "Full self-contained HTML" block above — this renders the preview inline in the claude.ai artifact side panel.'
          : '2. If the user is on claude.ai web and wants an inline artifact, re-call render_mdx with `inlineHtml: true` to get the full self-contained HTML block.',
        '',
        '3. If a "### Warnings" section is present above, surface the issues to the user (or fix them yourself before showing the render) — they include unknown components, invalid props, and frontmatter gaps with line numbers and did-you-mean suggestions.',
        '',
        '4. Keep the rest of your reply concise. Do not dump the HTML body verbatim unless the user asked.'
      )
      const trailing = trailingSections.join('\n')

      const content: ContentBlock[] = [{ type: 'text', text: leadIn }]

      if (result.screenshots && result.screenshots.length > 0)
      {
        content.push(...buildScreenshotBlocks(result.screenshots))
      }

      content.push({ type: 'text', text: trailing })

      enforceResponseBudget(content)
      return { content }
    }
    catch (err)
    {
      return buildErrorResponse(err)
    }
  }
)

// --- list_components ---------------------------------------------------------

server.tool(
  'list_components',
  "Return the MDX component registry for a framework — names, props, required vs optional, enum values, examples. Call this BEFORE writing MDX that uses framework-specific components so you don't guess at prop names or enum values. When `name` is supplied, returns the full detail for that one component; otherwise returns the summary list for the entire framework.",
  {
    framework: z
      .enum(FRAMEWORK_IDS)
      .optional()
      .describe(
        "Framework whose shim registry to list. Default: 'generic'. Each framework is scoped to its own shim barrel; generic components are listed separately."
      ),
    name: z
      .string()
      .optional()
      .describe(
        'Look up a single component by name (or alias). If omitted, returns all components for the framework.'
      ),
  },
  async (args) =>
  {
    const framework: FrameworkId = args.framework ?? 'generic'

    if (args.name)
    {
      const spec = findComponent(framework, args.name)
      if (!spec)
      {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: {
                    kind: 'unknown-component',
                    component: args.name,
                    framework,
                    message: `No component named "${args.name}" is registered for framework "${framework}".`,
                  },
                },
                null,
                2
              ),
            },
          ],
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(describeComponent(spec), null, 2),
          },
        ],
      }
    }

    const frameworkComponents =
      listComponentsForFramework(framework).map(describeComponent)
    const frontmatterSchema = getFrontmatterSchema(framework)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              framework,
              availableFrameworks: listFrameworks(),
              components: frameworkComponents,
              frontmatter: {
                fields: frontmatterSchema.fields,
                allowUnknown: frontmatterSchema.allowUnknown ?? true,
              },
            },
            null,
            2
          ),
        },
      ],
    }
  }
)

// --- helpers ----------------------------------------------------------------

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }

function buildScreenshotBlocks(
  variants: readonly CaptureVariant[]
): ContentBlock[]
{
  if (variants.length === 1)
  {
    return [
      {
        type: 'image',
        data: variants[0].png.toString('base64'),
        mimeType: 'image/png',
      },
    ]
  }
  const blocks: ContentBlock[] = []
  for (const v of variants)
  {
    blocks.push({ type: 'text', text: `### ${v.label}` })
    blocks.push({
      type: 'image',
      data: v.png.toString('base64'),
      mimeType: 'image/png',
    })
  }
  return blocks
}

// bound the aggregate (base64-expanded) response size (F29)
function enforceResponseBudget(content: readonly ContentBlock[]): void
{
  let bytes = 0
  for (const block of content)
  {
    bytes +=
      block.type === 'text'
        ? Buffer.byteLength(block.text, 'utf8')
        : block.data.length
  }
  if (bytes > MAX_RESPONSE_BYTES)
  {
    throw new RenderDiagnosticError(
      {
        kind: 'invalid-prop-value',
        severity: 'error',
        message: `response is ${bytes} bytes; cap is ${MAX_RESPONSE_BYTES}. Reduce screenshots or omit inlineHtml.`,
        prop: 'screenshots',
      },
      []
    )
  }
}

function renderWarningsBlock(diagnostics: readonly Diagnostic[]): string
{
  if (diagnostics.length === 0)
  {
    return ''
  }
  const lines = diagnostics.map((d) => `- ${formatDiagnostic(d)}`)
  return ['### Warnings', '', ...lines, ''].join('\n')
}

function buildErrorResponse(err: unknown): {
  isError: true
  content: Array<{ type: 'text'; text: string }>
}
{
  if (err instanceof RenderDiagnosticError)
  {
    const payload = {
      error: err.diagnostic,
      warnings: err.warnings,
    }
    const human = [
      `render_mdx failed: ${formatDiagnostic(err.diagnostic)}`,
      '',
      err.warnings.length > 0
        ? [
            'Additional warnings:',
            ...err.warnings.map((d) => `- ${formatDiagnostic(d)}`),
          ].join('\n')
        : '',
      '',
      '```json',
      JSON.stringify(payload, null, 2),
      '```',
    ]
      .filter(Boolean)
      .join('\n')
    return {
      isError: true,
      content: [{ type: 'text', text: human }],
    }
  }
  const message = err instanceof Error ? err.message : String(err)
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `render_mdx failed: ${message}`,
      },
    ],
  }
}

async function main(): Promise<void>
{
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // start preview server early; renderMdx awaits the shared promise
  void startPreviewServer().catch((err) =>
  {
    console.error('mdx-forge-render: preview server failed to start:', err)
  })
  // prune stale temp preview artifacts on startup (F28)
  void prunePreviewArtifacts()
}

const cleanup = async (): Promise<void> =>
{
  await Promise.allSettled([shutdownBrowser(), stopPreviewServer()])
  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

main().catch((err) =>
{
  console.error('mdx-forge-render failed to start:', err)
  process.exit(1)
})
