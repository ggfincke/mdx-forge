// tests/internal/render-plugin.test.ts
// screenshot render regressions for HTML sanitization & CSS bundle inlining

import { afterAll, describe, expect, it } from 'vitest';
import { resolveFrameworkCss, tokensCss } from '../../plugins/render/src/css';
import { sanitizeScreenshotHtml } from '../../plugins/render/src/html';
import { renderMdx, shutdownBrowser } from '../../plugins/render/src/render';
import { stopPreviewServer } from '../../plugins/render/src/preview-server';
import {
  DEFAULT_VIEWPORT,
  resolveViewport,
  VIEWPORT_PRESETS,
} from '../../plugins/render/src/viewports';

describe('render plugin screenshot helpers', () => {
  it('strips executable raw HTML before building screenshot documents', () => {
    const sanitized = sanitizeScreenshotHtml(
      [
        '<div onclick="alert(1)" data-source-line="1">Safe</div>',
        '<script>alert(2)</script>',
        '<a href="java&#x0A;script:alert(3)">Bad Link</a>',
        '<iframe srcdoc="<script>alert(4)</script>"></iframe>',
      ].join('')
    );

    expect(sanitized).toContain('Safe');
    expect(sanitized).toContain('Bad Link');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('<iframe');
    expect(sanitized).not.toContain('srcdoc');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toMatch(/\son[a-z]+=/i);
  });

  it('inlines imported framework CSS before screenshot injection', async () => {
    const frameworkCss = await resolveFrameworkCss('generic');

    expect(frameworkCss).toContain('[data-callout-type]');
    expect(frameworkCss).toContain('.mdx-preview-generic-code-group');
    expect(frameworkCss).not.toContain('@import');
  });

  it('inlines the tokens CSS bundle before screenshot injection', async () => {
    const tokens = await tokensCss();

    expect(tokens).toContain('--mdx-color-note');
    expect(tokens).not.toContain('@import');
  });
});

describe('resolveViewport', () => {
  it('returns default when input is undefined', () => {
    const v = resolveViewport(undefined);
    expect(v).toEqual({ ...DEFAULT_VIEWPORT });
    expect(v.preset).toBeUndefined();
  });

  it('maps a preset name to width/height', () => {
    expect(resolveViewport('mobile')).toEqual({
      preset: 'mobile',
      ...VIEWPORT_PRESETS.mobile,
    });
    expect(resolveViewport('wide')).toEqual({
      preset: 'wide',
      ...VIEWPORT_PRESETS.wide,
    });
  });

  it('fills in defaults for partial explicit dimensions', () => {
    expect(resolveViewport({ width: 500 })).toEqual({
      width: 500,
      height: DEFAULT_VIEWPORT.height,
    });
    expect(resolveViewport({ height: 400 })).toEqual({
      width: DEFAULT_VIEWPORT.width,
      height: 400,
    });
  });

  it('passes through explicit width/height unchanged', () => {
    expect(resolveViewport({ width: 500, height: 500 })).toEqual({
      width: 500,
      height: 500,
    });
  });
});

describe('render_mdx matrix screenshots', () => {
  afterAll(async () => {
    await Promise.allSettled([shutdownBrowser(), stopPreviewServer()]);
  });

  const MATRIX_SOURCE = `# Hello\n\nA paragraph with **bold** text.\n`;

  const pngWidth = (buf: Buffer): number => buf.readUInt32BE(16);
  const pngHeight = (buf: Buffer): number => buf.readUInt32BE(20);
  const isPng = (buf: Buffer): boolean =>
    buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47;

  it('captures a 2x2 matrix of themes x viewports', async () => {
    const result = await renderMdx({
      source: MATRIX_SOURCE,
      screenshots: {
        themes: ['light', 'dark'],
        viewports: ['mobile', 'desktop'],
      },
    });

    const variants = result.screenshots;
    expect(variants).toBeDefined();
    expect(variants).toHaveLength(4);

    const labels = variants!.map((v) => v.label).sort();
    expect(labels).toEqual(
      [
        'dark-desktop-1280x800',
        'dark-mobile-375x667',
        'light-desktop-1280x800',
        'light-mobile-375x667',
      ].sort(),
    );

    for (const variant of variants!) {
      expect(variant.png.length).toBeGreaterThan(0);
      expect(isPng(variant.png)).toBe(true);
      expect(pngHeight(variant.png)).toBeGreaterThan(0);
    }

    const byLabel = new Map(variants!.map((v) => [v.label, v]));
    const lightMobile = byLabel.get('light-mobile-375x667')!;
    const lightDesktop = byLabel.get('light-desktop-1280x800')!;
    const darkMobile = byLabel.get('dark-mobile-375x667')!;
    const darkDesktop = byLabel.get('dark-desktop-1280x800')!;

    expect(pngWidth(lightMobile.png)).toBeLessThan(
      pngWidth(lightDesktop.png),
    );
    expect(pngWidth(darkMobile.png)).toBeLessThan(pngWidth(darkDesktop.png));

    expect(lightMobile.png.equals(darkMobile.png)).toBe(false);
    expect(lightDesktop.png.equals(darkDesktop.png)).toBe(false);
  }, 60_000);

  it('treats screenshots: {} as a single capture using defaults', async () => {
    const result = await renderMdx({
      source: MATRIX_SOURCE,
      screenshots: {},
    });

    expect(result.screenshots).toBeDefined();
    expect(result.screenshots).toHaveLength(1);
    const only = result.screenshots![0];
    expect(only.theme).toBe('light');
    expect(only.viewport.width).toBe(DEFAULT_VIEWPORT.width);
    expect(only.viewport.height).toBe(DEFAULT_VIEWPORT.height);
    expect(only.label).toBe(
      `light-custom-${DEFAULT_VIEWPORT.width}x${DEFAULT_VIEWPORT.height}`,
    );
    expect(isPng(only.png)).toBe(true);
  }, 30_000);

  it('warns and prefers screenshots when both inputs are set', async () => {
    const result = await renderMdx({
      source: MATRIX_SOURCE,
      screenshot: true,
      screenshots: { themes: ['dark'], viewports: ['mobile'] },
    });

    expect(result.screenshots).toHaveLength(1);
    expect(result.screenshots![0].theme).toBe('dark');
    expect(result.screenshots![0].viewport.preset).toBe('mobile');
    expect(
      result.diagnostics.some(
        (d) => d.kind === 'deprecated-alias' && /screenshots/.test(d.message),
      ),
    ).toBe(true);
  }, 30_000);
});
