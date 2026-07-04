// plugins/cartographer/src/emit/html.ts
// render architecture MDX to a self-contained HTML file via compileSafe

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { compileSafe } from 'mdx-forge/compiler';

const require = createRequire(import.meta.url);

export interface RenderedArchitecture {
  html: string;
  title: string;
}

export async function renderArchitectureHtml(
  mdxSource: string,
  documentPath: string
): Promise<RenderedArchitecture> {
  const { html, frontmatter } = await compileSafe(mdxSource, { documentPath });
  const title =
    typeof frontmatter.title === 'string' ? frontmatter.title : 'Architecture';
  return { html: wrapHtml(html, title), title };
}

function wrapHtml(body: string, title: string): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${frameworkCss()}${BASE_CSS}</style>`,
    '</head>',
    '<body><main class="cartographer-page">',
    body,
    '</main></body>',
    '</html>',
    '',
  ].join('\n');
}

// inline mdx-forge generic styles so the file stays self-contained
function frameworkCss(): string {
  try {
    const stylesDir = dirname(
      require.resolve('mdx-forge/components/styles/generic.css')
    );
    return (
      readFileSync(join(stylesDir, 'tokens.css'), 'utf-8') +
      readFileSync(join(stylesDir, 'generic.css'), 'utf-8')
    );
  } catch {
    return '';
  }
}

const BASE_CSS = `
.cartographer-page {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.6;
}
.cartographer-page table { border-collapse: collapse; margin: 1rem 0; }
.cartographer-page th, .cartographer-page td {
  border: 1px solid #d0d7de;
  padding: 0.35rem 0.75rem;
}
.cartographer-page pre { overflow-x: auto; }
`;

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
