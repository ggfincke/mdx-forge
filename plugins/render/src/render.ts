// plugins/render/src/render.ts
// render MDX to HTML documents, live preview output & optional screenshots

import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compileSafe } from 'mdx-forge/compiler';
import { chromium, type Browser } from 'playwright';
import { resolveFrameworkCss, tokensCss, type FrameworkId } from './css.js';
import {
  normalizeCompileError,
  RenderDiagnosticError,
  type Diagnostic,
} from './diagnostics.js';
import { sanitizeScreenshotHtml } from './html.js';
import { lintMdxSource } from './lint.js';
import {
  resolveViewport,
  viewportLabelFragment,
  type ResolvedViewport,
  type ViewportPreset,
} from './viewports.js';
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
export type Theme = 'light' | 'dark';

export interface ScreenshotsMatrix {
  themes?: Theme[];
  viewports?: ViewportPreset[];
  fullPage?: boolean;
}

export interface RenderArgs {
  source: string;
  framework?: FrameworkId;
  mode?: RenderMode;
  screenshot?: boolean;
  screenshots?: ScreenshotsMatrix;
  theme?: Theme;
  viewport?: { width?: number; height?: number };
  autoOpen?: boolean;
}

export interface CaptureVariant {
  label: string;
  theme: Theme;
  viewport: ResolvedViewport;
  png: Buffer;
}

export interface RenderResult {
  html: string;
  fullHtml: string;
  frontmatter: Record<string, unknown>;
  previewPath: string;
  previewUrl: string;
  screenshots?: CaptureVariant[];
  diagnostics: Diagnostic[];
}

export const MAX_SCREENSHOT_VARIANTS = 8;

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

// fallback CSS-variable values for code blocks when consumers omit a theme
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

function baseStyles(): string {
  return `
    [data-theme="light"] { color-scheme: light; }
    [data-theme="dark"] { color-scheme: dark; }
    body {
      margin: 0;
      padding: 2rem;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
    }
    [data-theme="light"] body { background: #ffffff; color: #1a1a1a; }
    [data-theme="dark"] body { background: #1e1e1e; color: #e6e6e6; }
    pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  `;
}

function documentHead(tokens: string, frameworkCss: string): string {
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${tokens}</style>
  <style>${frameworkCss}</style>
  <style>${SHIKI_DEFAULTS}</style>
  <style>${baseStyles()}</style>
</head>`;
}

function buildSafeDocument(
  bodyHtml: string,
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark'
): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
${documentHead(tokens, frameworkCss)}
<body>${bodyHtml}</body>
</html>`;
}

// encode string for safe embedding inside script-source JSON
// escape closing tags & line separators before HTML insertion
function jsStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/<\//g, '<\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// escape raw JS source for embedding inside <script>
// neutralize closing script tags; leave other source untouched
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
${documentHead(tokens, frameworkCss)}
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
  framework: FrameworkId,
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark',
  warnings: readonly Diagnostic[]
): Promise<ModeDocs> {
  if (mode === 'trusted') {
    let compiled: TrustedCompiledModule;
    try {
      compiled = await compileTrustedModule(source, framework);
    } catch (err) {
      throw new RenderDiagnosticError(
        normalizeCompileError(err, { source, framework }),
        warnings
      );
    }

    // normalize user MDX snapshot failures; let harness infrastructure fail raw
    const snapshotPromise = snapshotTrustedModule(compiled).catch((err) => {
      throw new RenderDiagnosticError(
        normalizeCompileError(err, { source, framework }),
        warnings
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

    return {
      bodyHtml,
      frontmatter: compiled.frontmatter,
      previewHtml,
      fullHtml,
    };
  }

  let compiled: Awaited<ReturnType<typeof compileSafe>>;
  try {
    compiled = await compileSafe(source, {
      documentPath: '/virtual/render.mdx',
    });
  } catch (err) {
    throw new RenderDiagnosticError(
      normalizeCompileError(err, { source, framework }),
      warnings
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
  const framework: FrameworkId = args.framework ?? 'generic';
  const theme = args.theme ?? 'light';
  const mode: RenderMode = args.mode ?? 'safe';

  // lint before compile/render to surface structured diagnostics early
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
    warnings
  );

  const previewPath = await writePreviewFile(docs.fullHtml);
  updatePreview(docs.previewHtml);

  if (args.autoOpen) {
    autoOpenOnce(getPreviewUrl() ?? previewUrl);
  }

  const diagnostics = [...warnings];
  const plan = buildCapturePlan(args, theme, diagnostics);
  const base: RenderResult = {
    html: docs.bodyHtml,
    fullHtml: docs.fullHtml,
    frontmatter: docs.frontmatter,
    previewPath,
    previewUrl,
    diagnostics,
  };

  if (plan.variants.length === 0) {
    return base;
  }

  const screenshotDoc =
    mode === 'trusted'
      ? buildSafeDocument(docs.bodyHtml, tokens, frameworkCss, theme)
      : docs.fullHtml;
  const screenshots = await captureVariants(screenshotDoc, plan);
  return { ...base, screenshots };
}

interface CapturePlanVariant {
  theme: Theme;
  viewport: ResolvedViewport;
}

interface CapturePlan {
  variants: CapturePlanVariant[];
  fullPage: boolean;
}

function buildCapturePlan(
  args: RenderArgs,
  defaultTheme: Theme,
  diagnostics: Diagnostic[]
): CapturePlan {
  const hasMatrix = args.screenshots !== undefined;
  const hasLegacy = args.screenshot === true;

  if (hasMatrix && hasLegacy) {
    diagnostics.push({
      kind: 'deprecated-alias',
      severity: 'warning',
      message:
        '`screenshot: true` ignored because `screenshots` matrix was supplied.',
    });
  }

  if (hasMatrix) {
    const matrix = args.screenshots as ScreenshotsMatrix;
    const themeInput = matrix.themes?.length ? matrix.themes : [defaultTheme];
    const themes = dedupeThemes(themeInput);
    const viewportInput: ResolvedViewport[] = matrix.viewports?.length
      ? matrix.viewports.map((p) => resolveViewport(p))
      : [resolveViewport(args.viewport)];
    const viewports = dedupeViewports(viewportInput);
    const variants: CapturePlanVariant[] = [];
    for (const viewport of viewports) {
      for (const t of themes) {
        variants.push({ theme: t, viewport });
      }
    }
    if (variants.length > MAX_SCREENSHOT_VARIANTS) {
      throw new RenderDiagnosticError(
        {
          kind: 'invalid-prop-value',
          severity: 'error',
          message: `screenshots matrix produced ${variants.length} variants; cap is ${MAX_SCREENSHOT_VARIANTS}.`,
          prop: 'screenshots',
        },
        diagnostics
      );
    }
    return { variants, fullPage: matrix.fullPage ?? true };
  }

  if (hasLegacy) {
    return {
      variants: [
        { theme: defaultTheme, viewport: resolveViewport(args.viewport) },
      ],
      fullPage: true,
    };
  }

  return { variants: [], fullPage: true };
}

function dedupeThemes(themes: readonly Theme[]): Theme[] {
  return Array.from(new Set(themes));
}

// shared by dedupe & capture grouping so the formats can't drift
function viewportKey(v: ResolvedViewport): string {
  return `${v.preset ?? ''}:${v.width}x${v.height}`;
}

function dedupeViewports(
  viewports: readonly ResolvedViewport[]
): ResolvedViewport[] {
  const seen = new Set<string>();
  const out: ResolvedViewport[] = [];
  for (const v of viewports) {
    const key = viewportKey(v);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

async function captureVariants(
  screenshotDoc: string,
  plan: CapturePlan
): Promise<CaptureVariant[]> {
  const browser = await getBrowser();
  const byViewport = new Map<string, CapturePlanVariant[]>();
  for (const variant of plan.variants) {
    const key = viewportKey(variant.viewport);
    const bucket = byViewport.get(key);
    if (bucket) {
      bucket.push(variant);
    } else {
      byViewport.set(key, [variant]);
    }
  }

  const results: CaptureVariant[] = [];
  for (const bucket of byViewport.values()) {
    const viewport = bucket[0].viewport;
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: bucket[0].theme,
    });
    try {
      const page = await context.newPage();
      await page.setContent(screenshotDoc, { waitUntil: 'networkidle' });
      for (const variant of bucket) {
        await page.emulateMedia({ colorScheme: variant.theme });
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, variant.theme);
        const png = await page.screenshot({
          type: 'png',
          fullPage: plan.fullPage,
        });
        results.push({
          label: `${variant.theme}-${viewportLabelFragment(viewport)}`,
          theme: variant.theme,
          viewport,
          png,
        });
      }
    } finally {
      await context.close();
    }
  }
  return results;
}
