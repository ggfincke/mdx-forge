#!/usr/bin/env node
// mdx-forge-render MCP server — single tool `render_mdx`

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { renderMdx, shutdownBrowser } from './render.js';

const FRAMEWORKS = ['generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'] as const;

const server = new McpServer({
  name: 'mdx-forge-render',
  version: '0.1.0',
});

server.tool(
  'render_mdx',
  'Compile MDX source to HTML via mdx-forge Safe Mode, with an optional headless-Chromium screenshot. Returns HTML, parsed frontmatter, and (if screenshot: true) a PNG image.',
  {
    source: z.string().describe('MDX source text (inline). Frontmatter is parsed automatically.'),
    framework: z
      .enum(FRAMEWORKS)
      .optional()
      .describe(
        "Framework CSS bundle to apply — one of 'generic', 'docusaurus', 'starlight', 'nextra', 'nextjs'. Default: 'generic'. Only affects the screenshot.",
      ),
    screenshot: z
      .boolean()
      .optional()
      .describe('Render a PNG screenshot via headless Chromium. Default: false (HTML only).'),
    theme: z
      .enum(['light', 'dark'])
      .optional()
      .describe("Preferred color scheme for the screenshot. Default: 'light'."),
    viewport: z
      .object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .optional()
      .describe('Viewport size for the screenshot. Default: 1024x768.'),
  },
  async (args) => {
    try {
      const result = await renderMdx(args);
      const summary = [
        '### HTML',
        '',
        '```html',
        result.html,
        '```',
        '',
        '### Frontmatter',
        '',
        '```json',
        JSON.stringify(result.frontmatter, null, 2),
        '```',
      ].join('\n');

      const content: Array<
        | { type: 'text'; text: string }
        | { type: 'image'; data: string; mimeType: string }
      > = [{ type: 'text', text: summary }];

      if (result.screenshot) {
        content.push({
          type: 'image',
          data: result.screenshot.toString('base64'),
          mimeType: 'image/png',
        });
      }

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
}

const cleanup = async (): Promise<void> => {
  await shutdownBrowser();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

main().catch((err) => {
  console.error('mdx-forge-render failed to start:', err);
  process.exit(1);
});
