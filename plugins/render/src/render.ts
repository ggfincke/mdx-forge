// plugins/render/src/render.ts
// render MDX to HTML documents, live preview output & optional screenshots

import { randomBytes } from 'node:crypto';
import { readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { compileSafe } from 'mdx-forge/compiler';
import type { BrowserContext } from 'playwright';
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
import {
  applyDenyRoute,
  getPluginBrowser,
  shutdownHarnessPages,
} from './harness-page.js';
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

// render budgets (F29) - reject oversized input/output before allocation
export const MAX_SOURCE_BYTES = 1024 * 1024;
export const MAX_VIEWPORT_DIMENSION = 4000;
export const MAX_VARIANT_PIXELS = 10_000_000;
export const MAX_AGGREGATE_PIXELS = 48_000_000;
export const MAX_FULLPAGE_SCROLL_HEIGHT = 20_000;
export const MAX_PNG_BYTES = 8 * 1024 * 1024;
export const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;

// preview-artifact retention (F28) - bound temp file count & age
export const MAX_PREVIEW_ARTIFACTS = 50;
export const PREVIEW_ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000;
const PREVIEW_ARTIFACT_PREFIX = 'mdx-forge-render-';

// browser lifecycle is owned by harness-page's single plugin Browser (F27)
// capture uses isolated contexts off that same Browser
export async function shutdownBrowser(): Promise<void> {
  await shutdownHarnessPages();
}

// this plugin has no diagram runtime, so ask the core for visible code
// fallbacks (F34); cores w/o the option (<= 0.6.x) ignore the extra key
// & keep emitting empty placeholders — a documented minimum-core gap
const SAFE_COMPILE_CONFIG = {
  documentPath: '/virtual/render.mdx',
  diagramBehavior: 'code',
} as const;

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
    .mdx-diagram-code {
      margin: 1rem 0;
      border: 1px solid rgba(128,128,128,0.35);
      border-radius: 6px;
      overflow: hidden;
    }
    .mdx-diagram-code-label {
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.7;
      border-bottom: 1px solid rgba(128,128,128,0.35);
    }
    .mdx-diagram-code pre {
      margin: 0;
      padding: 0.75rem 1rem;
      overflow-x: auto;
    }
  `;
}

// independent containment for Safe artifacts: no scripts, img limited to data:,
// inline styles allowed (Shiki/KaTeX); trusted docs keep their executable contract
const SAFE_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; " +
  "font-src data:; base-uri 'none'; form-action 'none'";

function documentHead(
  tokens: string,
  frameworkCss: string,
  includeCsp: boolean
): string {
  const csp = includeCsp
    ? `\n  <meta http-equiv="Content-Security-Policy" content="${SAFE_CSP}">`
    : '';
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">${csp}
  <style>${tokens}</style>
  <style>${frameworkCss}</style>
  <style>${SHIKI_DEFAULTS}</style>
  <style>${baseStyles()}</style>
</head>`;
}

// includeCsp: portable artifacts & screenshots get the Safe CSP; the live-reload
// preview page omits it so its infra script can run on localhost
function buildSafeDocument(
  bodyHtml: string,
  tokens: string,
  frameworkCss: string,
  theme: 'light' | 'dark',
  includeCsp: boolean
): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
${documentHead(tokens, frameworkCss, includeCsp)}
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

  // trusted documents keep their executable contract; no Safe CSP here
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
${documentHead(tokens, frameworkCss, false)}
<body>
  <div id="mdx-root"></div>
  <script>${globals}</script>
  ${bundleTag}
</body>
</html>`;
}

async function writePreviewFile(fullHtml: string): Promise<string> {
  const filename = `${PREVIEW_ARTIFACT_PREFIX}${randomBytes(6).toString('hex')}.html`;
  const filePath = join(tmpdir(), filename);
  await writeFile(filePath, fullHtml, 'utf8');
  return filePath;
}

// prune temp preview artifacts beyond the age TTL & count cap (F28)
// best-effort; called on server start & after each render
export async function prunePreviewArtifacts(): Promise<void> {
  const dir = tmpdir();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const candidates = names.filter(
    (n) => n.startsWith(PREVIEW_ARTIFACT_PREFIX) && n.endsWith('.html')
  );
  const now = Date.now();
  const live: Array<{ path: string; mtimeMs: number }> = [];
  for (const name of candidates) {
    const filePath = join(dir, name);
    let info;
    try {
      info = await stat(filePath);
    } catch {
      continue;
    }
    if (now - info.mtimeMs > PREVIEW_ARTIFACT_TTL_MS) {
      await unlink(filePath).catch(() => undefined);
      continue;
    }
    live.push({ path: filePath, mtimeMs: info.mtimeMs });
  }
  if (live.length <= MAX_PREVIEW_ARTIFACTS) {
    return;
  }
  // drop oldest beyond the count cap
  live.sort((a, b) => b.mtimeMs - a.mtimeMs);
  for (const stale of live.slice(MAX_PREVIEW_ARTIFACTS)) {
    await unlink(stale.path).catch(() => undefined);
  }
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
    compiled = await compileSafe(source, SAFE_COMPILE_CONFIG);
  } catch (err) {
    throw new RenderDiagnosticError(
      normalizeCompileError(err, { source, framework }),
      warnings
    );
  }
  const bodyHtml = sanitizeScreenshotHtml(compiled.html);
  // preview page omits CSP so live-reload infra runs; artifact carries the CSP
  const previewHtml = buildSafeDocument(
    bodyHtml,
    tokens,
    frameworkCss,
    theme,
    false
  );
  const fullHtml = buildSafeDocument(
    bodyHtml,
    tokens,
    frameworkCss,
    theme,
    true
  );
  return {
    bodyHtml,
    frontmatter: compiled.frontmatter,
    previewHtml,
    fullHtml,
  };
}

// enforce input budgets before compile/render; direct API & server share this
export function validateRenderBudgets(args: RenderArgs): void {
  const sourceBytes = Buffer.byteLength(args.source, 'utf8');
  if (sourceBytes > MAX_SOURCE_BYTES) {
    throw new RenderDiagnosticError(
      {
        kind: 'invalid-prop-value',
        severity: 'error',
        message: `source is ${sourceBytes} bytes; cap is ${MAX_SOURCE_BYTES}.`,
        prop: 'source',
      },
      []
    );
  }
  const dims: Array<number | undefined> = [
    args.viewport?.width,
    args.viewport?.height,
  ];
  for (const dim of dims) {
    if (dim !== undefined && dim > MAX_VIEWPORT_DIMENSION) {
      throw new RenderDiagnosticError(
        {
          kind: 'invalid-prop-value',
          severity: 'error',
          message: `viewport dimension ${dim} exceeds cap ${MAX_VIEWPORT_DIMENSION}.`,
          prop: 'viewport',
        },
        []
      );
    }
  }
}

// reject per-variant & aggregate pixel budgets before launching a browser
export function validatePixelBudgets(plan: CapturePlan): void {
  let aggregate = 0;
  for (const variant of plan.variants) {
    const pixels = variant.viewport.width * variant.viewport.height;
    if (pixels > MAX_VARIANT_PIXELS) {
      throw new RenderDiagnosticError(
        {
          kind: 'invalid-prop-value',
          severity: 'error',
          message: `variant is ${pixels} px; per-variant cap is ${MAX_VARIANT_PIXELS}.`,
          prop: 'viewport',
        },
        []
      );
    }
    aggregate += pixels;
  }
  if (aggregate > MAX_AGGREGATE_PIXELS) {
    throw new RenderDiagnosticError(
      {
        kind: 'invalid-prop-value',
        severity: 'error',
        message: `aggregate is ${aggregate} px; cap is ${MAX_AGGREGATE_PIXELS}.`,
        prop: 'screenshots',
      },
      []
    );
  }
}

export async function renderMdx(args: RenderArgs): Promise<RenderResult> {
  const framework: FrameworkId = args.framework ?? 'generic';
  const theme = args.theme ?? 'light';
  const mode: RenderMode = args.mode ?? 'safe';

  validateRenderBudgets(args);

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
  // best-effort retention prune; never block the render on cleanup
  void prunePreviewArtifacts();

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

  validatePixelBudgets(plan);

  // trusted snapshots capture through a static CSP'd Safe document
  const screenshotDoc =
    mode === 'trusted'
      ? buildSafeDocument(docs.bodyHtml, tokens, frameworkCss, theme, true)
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

// explicit readiness in place of networkidle (F27): load + fonts + paint settle
async function waitForCaptureReadiness(page: {
  evaluate: <R>(fn: () => R) => Promise<R>;
}): Promise<void> {
  await page.evaluate(async () => {
    const doc = document as Document & { fonts?: FontFaceSet };
    if (doc.fonts?.ready) {
      await doc.fonts.ready;
    }
    // two rAFs let layout & first paint settle without a fixed timer
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function captureVariants(
  screenshotDoc: string,
  plan: CapturePlan
): Promise<CaptureVariant[]> {
  const browser = await getPluginBrowser();
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
    // isolated capture context off the shared plugin Browser
    const context: BrowserContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: bucket[0].theme,
    });
    // default-deny network so Safe artifacts can't reach loopback / remote hosts
    await applyDenyRoute(context);
    try {
      const page = await context.newPage();
      await page.setContent(screenshotDoc, { waitUntil: 'load' });
      await waitForCaptureReadiness(page);
      if (plan.fullPage) {
        // reject tall pages before allocating a full-page surface
        const scrollHeight = await page.evaluate(
          () => document.documentElement.scrollHeight
        );
        if (scrollHeight > MAX_FULLPAGE_SCROLL_HEIGHT) {
          throw new RenderDiagnosticError(
            {
              kind: 'invalid-prop-value',
              severity: 'error',
              message: `full-page height ${scrollHeight}px exceeds cap ${MAX_FULLPAGE_SCROLL_HEIGHT}px.`,
              prop: 'screenshots',
            },
            []
          );
        }
      }
      for (const variant of bucket) {
        await page.emulateMedia({ colorScheme: variant.theme });
        await page.evaluate((t) => {
          document.documentElement.dataset.theme = t;
        }, variant.theme);
        const png = await page.screenshot({
          type: 'png',
          fullPage: plan.fullPage,
        });
        if (png.length > MAX_PNG_BYTES) {
          throw new RenderDiagnosticError(
            {
              kind: 'invalid-prop-value',
              severity: 'error',
              message: `screenshot is ${png.length} bytes; cap is ${MAX_PNG_BYTES}.`,
              prop: 'screenshots',
            },
            []
          );
        }
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
