#!/usr/bin/env node
// mdx-forge-render MCP server — single tool `render_mdx`

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { renderMdx, shutdownBrowser } from './render.js';
import { startPreviewServer, stopPreviewServer } from './preview-server.js';

const FRAMEWORKS = ['generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'] as const;

const server = new McpServer({
  name: 'mdx-forge-render',
  version: '0.1.0',
});

server.tool(
  'render_mdx',
  'Compile MDX via mdx-forge (Safe or Trusted Mode), publish it to a local live-reload HTTP server (stable URL across calls, auto-refreshes open tabs), & save a self-contained HTML file on disk. Returns a preview URL for the browser plus the full HTML for claude.ai artifact rendering. Optional PNG screenshot for chat surfaces that collapse tool output.',
  {
    source: z.string().describe('MDX source text (inline). Frontmatter is parsed automatically.'),
    framework: z
      .enum(FRAMEWORKS)
      .optional()
      .describe(
        "Framework CSS bundle to apply — one of 'generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'. Default: 'generic'.",
      ),
    mode: z
      .enum(['safe', 'trusted'])
      .optional()
      .describe(
        "Rendering mode. 'safe' compiles MDX to sanitized static HTML (no JS execution). 'trusted' executes the compiled MDX as React in a sandboxed, network-blocked Chromium context, giving full fidelity for JSX tags like <Tabs>, <Callout>, <Steps>, etc. Use 'trusted' when the MDX relies on framework components. Default: 'safe'.",
      ),
    screenshot: z
      .boolean()
      .optional()
      .describe('Also render a PNG screenshot via headless Chromium. Default: false.'),
    theme: z
      .enum(['light', 'dark'])
      .optional()
      .describe("Preferred color scheme for the preview & screenshot. Default: 'light'."),
    viewport: z
      .object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .optional()
      .describe('Viewport size for the screenshot. Default: 1024x768.'),
    autoOpen: z
      .boolean()
      .optional()
      .describe(
        'Auto-open the preview URL in the default browser on the first render this session. Subsequent renders rely on live reload (no focus-stealing). Default: false.',
      ),
  },
  async (args) => {
    try {
      const result = await renderMdx(args);
      const httpUrl = result.previewUrl;
      const fileUrl = `file://${result.previewPath}`;

      const leadIn = [
        `**[🖼 Open live preview in browser](${httpUrl})** — auto-reloads on every render.`,
        '',
        `Offline fallback: [${result.previewPath}](${fileUrl})`,
      ].join('\n');

      const trailing = [
        '### Preview URLs',
        '',
        `- Live (reloads on new renders): ${httpUrl}`,
        `- Static file: ${fileUrl}`,
        '',
        '### Frontmatter',
        '',
        '```json',
        JSON.stringify(result.frontmatter, null, 2),
        '```',
        '',
        '### Compiled HTML (body only)',
        '',
        '```html',
        result.html,
        '```',
        '',
        '### Full self-contained HTML (for claude.ai artifact)',
        '',
        '```html',
        result.fullHtml,
        '```',
        '',
        '### AGENT INSTRUCTIONS',
        '',
        `1. You MUST include the markdown link \`[Open preview](${httpUrl})\` in your visible reply so the user can click to view the render in their browser. Chat surfaces may hide this tool output behind a collapsed panel — the link is the user's primary path to the rendering.`,
        '',
        '2. If the user is on claude.ai web, ALSO create an HTML artifact using the "Full self-contained HTML" block above — this renders the preview inline in the claude.ai artifact side panel.',
        '',
        '3. Keep the rest of your reply concise. Do not dump the HTML body verbatim unless the user asked.',
      ].join('\n');

      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [{ type: 'text', text: leadIn }];

      if (result.screenshot) {
        content.push({
          type: 'image',
          data: result.screenshot.toString('base64'),
          mimeType: 'image/png',
        });
      }

      content.push({ type: 'text', text: trailing });

      return { content };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `render_mdx failed: ${message}`,
          },
        ],
      };
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Kick off preview server in the background — first render_mdx call awaits
  // it inside renderMdx, but starting early warms the port.
  void startPreviewServer().catch((err) => {
    console.error('mdx-forge-render: preview server failed to start:', err);
  });
}

const cleanup = async (): Promise<void> => {
  await Promise.allSettled([shutdownBrowser(), stopPreviewServer()]);
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
  console.error('mdx-forge-render failed to start:', err);
  process.exit(1);
});
