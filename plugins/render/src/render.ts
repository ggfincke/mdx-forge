// Compile MDX -> HTML via mdx-forge (Safe or Trusted Mode), screenshot via
// headless Chromium. Both modes emit three HTML variants:
//   html          body-only string (the compiled MDX output). for the MCP
//                 "compiled HTML" display block + screenshot source.
//   fullHtml      complete self-contained document. for claude.ai artifact
//                 rendering. in trusted mode the harness bundle is inlined so
//                 the artifact is interactive on its own.
//   previewHtml   served by the local HTTP preview server. identical to
//                 fullHtml in safe mode; in trusted mode it references the
//                 harness bundle via /harness/:framework/bundle.js to avoid
//                 resending ~650KB on every live-reload refresh.

import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compileSafe } from 'mdx-forge/compiler';
import { chromium, type Browser } from 'playwright';
import { resolveFrameworkCss, tokensCss, type Framework } from './css.js';
import {
  normalizeCompileError,
  RenderDiagnosticError,
  type Diagnostic,
} from './diagnostics.js';
import { sanitizeScreenshotHtml } from './html.js';
import { lintMdxSource } from './lint.js';
import {
  autoOpenOnce,
  getPreviewUrl,
  startPreviewServer,
  updatePreview,
} from './preview-server.js';
import { shutdownHarnessPages } from './harness-page.js';
import {
  compileTrustedModule,
  readHarnessBundle,
  snapshotTrustedModule,
  type TrustedCompiledModule,
} from './trusted.js';

export type RenderMode = 'safe' | 'trusted';

export interface RenderArgs {
  source: string;
  framework?: Framework;
  mode?: RenderMode;
  screenshot?: boolean;
  theme?: 'light' | 'dark';
  viewport?: { width?: number; height?: number };
  autoOpen?: boolean;
}

export interface RenderResult {
  html: string;
  fullHtml: string;
  frontmatter: Record<string, unknown>;
  previewPath: string;
  previewUrl: string;
  screenshot?: Buffer;
  // lint + runtime diagnostics. empty array on a clean render.
  diagnostics: Diagnostic[];
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
  // trusted mode owns its own Playwright Browser lifecycle; shut both down
  await Promise.allSettled([
    (async () => {
      if (!pending) {
        return;
      }
      const browser = await pending.catch(() => undefined);
      await browser?.close().catch(() => undefined);
    })(),
    shutdownHarnessPages(),
  ]);
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

function baseStyles(theme: 'light' | 'dark'): string {
  const bg = theme === 'dark' ? '#1e1e1e' : '#ffffff';
  const fg = theme === 'dark' ? '#e6e6e6' : '#1a1a1a';
  return `
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
  `;
}

function documentHead(
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark',
): string {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${tokens}</style>
  <style>${frameworkCss}</style>
  <style>${SHIKI_DEFAULTS}</style>
  <style>${baseStyles(theme)}</style>
</head>`;
}

function buildSafeDocument(
  bodyHtml: string,
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark',
): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
${documentHead(tokens, frameworkCss, theme)}
<body>${bodyHtml}</body>
</html>`;
}

// JSON-encode a string so it can sit inside a <script> tag as JS source.
// wraps in the safe HTML-in-JSON pattern (escape `</`, line separators, etc.)
// so the script tag can't be closed prematurely by hostile input.
function jsStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// escape a raw JS source block for embedding inside <script>...</script>.
// we only need to neutralise `</script>` sequences; the rest is fine as-is.
function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

interface TrustedDocumentOptions {
  compiled: TrustedCompiledModule;
  tokens: string;
  frameworkCss: string;
  theme: 'light' | 'dark';
  bundle: { kind: 'external'; src: string } | { kind: 'inline'; code: string };
}

function buildTrustedDocument(opts: TrustedDocumentOptions): string {
  const { compiled, tokens, frameworkCss, theme, bundle } = opts;

  const globals = `
    window.__MDX_FORGE_CODE__ = ${jsStringLiteral(compiled.cjsCode)};
    window.__MDX_FORGE_DEPS__ = ${JSON.stringify(compiled.dependencies)};
    window.__MDX_FORGE_ENTRY__ = ${jsStringLiteral(compiled.entryId)};
  `;

  const bundleTag =
    bundle.kind === 'external'
      ? `<script src="${bundle.src}"></script>`
      : `<script>${escapeInlineScript(bundle.code)}</script>`;

  return `<!doctype html>
<html lang="en" data-theme="${theme}">
${documentHead(tokens, frameworkCss, theme)}
<body>
  <div id="mdx-root"></div>
  <script>${globals}</script>
  ${bundleTag}
</body>
</html>`;
}

async function writePreviewFile(fullHtml: string): Promise<string> {
  const filename = `mdx-forge-render-${randomBytes(6).toString('hex')}.html`;
  const filePath = join(tmpdir(), filename);
  await writeFile(filePath, fullHtml, 'utf8');
  return filePath;
}

interface ModeDocs {
  bodyHtml: string;
  frontmatter: Record<string, unknown>;
  previewHtml: string;
  fullHtml: string;
}

async function buildModeDocs(
  mode: RenderMode,
  source: string,
  framework: Framework,
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark',
  warnings: readonly Diagnostic[],
): Promise<ModeDocs> {
  if (mode === 'trusted') {
    let compiled: TrustedCompiledModule;
    try {
      compiled = await compileTrustedModule(source, framework);
    } catch (err) {
      throw new RenderDiagnosticError(
        normalizeCompileError(err, { source, framework }),
        warnings,
      );
    }

    // snapshot failures stem from the user's MDX (component threw, missing
    // shim, etc.) — normalize. harness-bundle failures are infrastructure
    // (build never ran, file missing) — let them propagate raw.
    const snapshotPromise = snapshotTrustedModule(compiled).catch((err) => {
      throw new RenderDiagnosticError(
        normalizeCompileError(err, { source, framework }),
        warnings,
      );
    });
    const [bodyHtml, bundleSource] = await Promise.all([
      snapshotPromise,
      readHarnessBundle(framework),
    ]);

    const previewHtml = buildTrustedDocument({
      compiled,
      tokens,
      frameworkCss,
      theme,
      bundle: { kind: 'external', src: `/harness/${framework}/bundle.js` },
    });

    const fullHtml = buildTrustedDocument({
      compiled,
      tokens,
      frameworkCss,
      theme,
      bundle: { kind: 'inline', code: bundleSource },
    });

    return { bodyHtml, frontmatter: compiled.frontmatter, previewHtml, fullHtml };
  }

  let compiled: Awaited<ReturnType<typeof compileSafe>>;
  try {
    compiled = await compileSafe(source, {
      documentPath: '/virtual/render.mdx',
    });
  } catch (err) {
    throw new RenderDiagnosticError(
      normalizeCompileError(err, { source, framework }),
      warnings,
    );
  }
  const bodyHtml = sanitizeScreenshotHtml(compiled.html);
  const doc = buildSafeDocument(bodyHtml, tokens, frameworkCss, theme);
  return {
    bodyHtml,
    frontmatter: compiled.frontmatter,
    previewHtml: doc,
    fullHtml: doc,
  };
}

export async function renderMdx(args: RenderArgs): Promise<RenderResult> {
  const framework: Framework = args.framework ?? 'generic';
  const theme = args.theme ?? 'light';
  const mode: RenderMode = args.mode ?? 'safe';

  // lint first — catches syntax errors, unknown components, prop mismatches,
  // frontmatter gaps BEFORE we pay for the compile + headless render. a fatal
  // lint result short-circuits as a structured error.
  const lint = await lintMdxSource(args.source, framework);
  if (lint.fatal) {
    throw new RenderDiagnosticError(lint.fatal, lint.diagnostics);
  }
  const warnings = lint.diagnostics;

  const [tokens, frameworkCss, previewUrl] = await Promise.all([
    tokensCss(),
    resolveFrameworkCss(framework),
    startPreviewServer(),
  ]);

  const docs = await buildModeDocs(
    mode,
    args.source,
    framework,
    tokens,
    frameworkCss,
    theme,
    warnings,
  );

  const previewPath = await writePreviewFile(docs.fullHtml);
  updatePreview(docs.previewHtml);

  if (args.autoOpen) {
    autoOpenOnce(getPreviewUrl() ?? previewUrl);
  }

  const base: RenderResult = {
    html: docs.bodyHtml,
    fullHtml: docs.fullHtml,
    frontmatter: docs.frontmatter,
    previewPath,
    previewUrl,
    diagnostics: [...warnings],
  };

  if (!args.screenshot) {
    return base;
  }

  // screenshots always use the headless snapshot doc so even interactive
  // trusted renders yield a predictable PNG without waiting for React mount.
  const screenshotDoc =
    mode === 'trusted'
      ? buildSafeDocument(docs.bodyHtml, tokens, frameworkCss, theme)
      : docs.fullHtml;

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
    await page.setContent(screenshotDoc, { waitUntil: 'networkidle' });
    const png = await page.screenshot({ type: 'png', fullPage: true });
    return { ...base, screenshot: png };
  } finally {
    await context.close();
  }
}
