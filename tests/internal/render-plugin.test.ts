// tests/internal/render-plugin.test.ts
// screenshot render regressions for HTML sanitization & CSS bundle inlining

import { describe, expect, it } from 'vitest';
import { resolveFrameworkCss, tokensCss } from '../../plugins/render/src/css';
import { sanitizeScreenshotHtml } from '../../plugins/render/src/html';

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
