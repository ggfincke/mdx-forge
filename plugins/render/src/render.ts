// Compile MDX -> HTML via mdx-forge Safe Mode, screenshot via headless Chromium

import { compileSafe } from 'mdx-forge/compiler';
import { chromium, type Browser } from 'playwright';
import { resolveFrameworkCss, tokensCss, type Framework } from './css.js';
import { sanitizeScreenshotHtml } from './html.js';

export interface RenderArgs {
  source: string;
  framework?: Framework;
  screenshot?: boolean;
  theme?: 'light' | 'dark';
  viewport?: { width?: number; height?: number };
}

export interface RenderResult {
  html: string;
  frontmatter: Record<string, unknown>;
  screenshot?: Buffer;
}

let browserPromise: Promise<Browser> | undefined;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true }).catch((err) => {
      browserPromise = undefined;
      throw err;
    });
  }
  return browserPromise;
}

export async function shutdownBrowser(): Promise<void> {
  const pending = browserPromise;
  browserPromise = undefined;
  if (!pending) {
    return;
  }
  const browser = await pending.catch(() => undefined);
  await browser?.close().catch(() => undefined);
}

// Default Shiki CSS-variable theme (GitHub-style). mdx-forge emits
// `var(--shiki-*)` refs via createCssVariablesTheme — consumers supply the
// values. These defaults make code blocks colored out of the box.
const SHIKI_DEFAULTS = `
[data-theme="light"] {
  --shiki-foreground: #24292e;
  --shiki-background: #f6f8fa;
  --shiki-token-keyword: #d73a49;
  --shiki-token-string: #032f62;
  --shiki-token-string-expression: #032f62;
  --shiki-token-number: #005cc5;
  --shiki-token-comment: #6a737d;
  --shiki-token-function: #6f42c1;
  --shiki-token-constant: #005cc5;
  --shiki-token-parameter: #24292e;
  --shiki-token-link: #032f62;
  --shiki-token-punctuation: #24292e;
  --shiki-token-regex: #032f62;
}
[data-theme="dark"] {
  --shiki-foreground: #c9d1d9;
  --shiki-background: #0d1117;
  --shiki-token-keyword: #ff7b72;
  --shiki-token-string: #a5d6ff;
  --shiki-token-string-expression: #a5d6ff;
  --shiki-token-number: #79c0ff;
  --shiki-token-comment: #8b949e;
  --shiki-token-function: #d2a8ff;
  --shiki-token-constant: #79c0ff;
  --shiki-token-parameter: #c9d1d9;
  --shiki-token-link: #a5d6ff;
  --shiki-token-punctuation: #c9d1d9;
  --shiki-token-regex: #a5d6ff;
}
.mdx-preview-codeblock {
  margin: 1rem 0;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(128,128,128,0.2);
}
.mdx-preview-codeblock-shiki pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.9rem;
  line-height: 1.5;
}
`;

function buildDocument(
  bodyHtml: string,
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark',
): string {
  const bg = theme === 'dark' ? '#1e1e1e' : '#ffffff';
  const fg = theme === 'dark' ? '#e6e6e6' : '#1a1a1a';
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${tokens}</style>
  <style>${frameworkCss}</style>
  <style>${SHIKI_DEFAULTS}</style>
  <style>
    :root { color-scheme: ${theme}; }
    body {
      margin: 0;
      padding: 2rem;
      background: ${bg};
      color: ${fg};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export async function renderMdx(args: RenderArgs): Promise<RenderResult> {
  const framework: Framework = args.framework ?? 'generic';
  const theme = args.theme ?? 'light';

  const compiled = await compileSafe(args.source, {
    documentPath: '/virtual/render.mdx',
  });

  if (!args.screenshot) {
    return { html: compiled.html, frontmatter: compiled.frontmatter };
  }

  const [tokens, frameworkCss] = await Promise.all([
    tokensCss(),
    resolveFrameworkCss(framework),
  ]);
  const document = buildDocument(
    sanitizeScreenshotHtml(compiled.html),
    tokens,
    frameworkCss,
    theme,
  );

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: {
      width: args.viewport?.width ?? 1024,
      height: args.viewport?.height ?? 768,
    },
    colorScheme: theme,
  });
  try {
    const page = await context.newPage();
    await page.setContent(document, { waitUntil: 'networkidle' });
    const png = await page.screenshot({ type: 'png', fullPage: true });
    return {
      html: compiled.html,
      frontmatter: compiled.frontmatter,
      screenshot: png,
    };
  } finally {
    await context.close();
  }
}
