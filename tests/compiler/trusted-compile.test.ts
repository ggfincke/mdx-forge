// tests/compiler/trusted-compile.test.ts
// unit tests for Trusted Mode MDX compilation (MDX -> JavaScript) via compiler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileTrusted } from '../../src/compiler/index';
import type { CompilerConfig } from '../../src/compiler/index';
import { FIXTURES } from '../fixtures';

// create library-native CompilerConfig
function createConfig(overrides: Partial<CompilerConfig> = {}): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  };
}

describe('compileTrusted()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to JavaScript with React imports', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig()
    );

    expect(result.code).toContain('import React from');
    expect(result.code).toContain('MDXContent');
    expect(result.code).toContain('export default');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileTrusted(
      FIXTURES.mdxWithFrontmatter,
      true,
      createConfig()
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
  });

  it('injects vscode-markdown-layout when no default export and useHostMarkdownStyles is true', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig({ useHostMarkdownStyles: true })
    );

    expect(result.code).toContain('vscode-markdown-layout');
    expect(result.code).toContain('createLayout');
  });

  it('preserves existing default export (no layout injection)', async () => {
    const result = await compileTrusted(
      FIXTURES.mdxWithLayout,
      true,
      createConfig({ useHostMarkdownStyles: true })
    );

    // should NOT inject vscode-markdown-layout when there's already a default export
    expect(result.code).not.toContain('vscode-markdown-layout');
  });

  it('returns empty frontmatter when none present', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig()
    );

    expect(result.frontmatter).toEqual({});
  });

  it('adds source-line metadata to compiled JSX output', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig()
    );

    expect(result.code).toContain('data-source-line');
  });

  it('maps source lines past frontmatter and injected builtin imports', async () => {
    const result = await compileTrusted(
      '---\ntitle: x\n---\n# H',
      true,
      createConfig({
        componentsBuiltins: true,
        useHostMarkdownStyles: false,
      })
    );

    expect(result.code).toContain('import _builtin_');
    // original-document line contract (BH-FC-2)
    expect(result.code).toContain('"data-source-line": "4"');
  });

  it('maps source lines past injected layout wrapping', async () => {
    const result = await compileTrusted(
      '---\ntitle: x\n---\n# H',
      true,
      createConfig({
        componentsBuiltins: false,
        useHostMarkdownStyles: true,
      })
    );

    expect(result.code).toContain('vscode-markdown-layout');
    // original-document line contract (BH-FC-2)
    expect(result.code).toContain('"data-source-line": "4"');
  });

  it('compiles rich GitHub alert content to JSX', async () => {
    const result = await compileTrusted(
      `> [!NOTE]
> Visit [docs](https://example.com) with \`code\` and **strong**.`,
      true,
      createConfig()
    );

    expect(result.code).toContain(
      'className: "github-alert github-alert-note"'
    );
    expect(result.code).toContain('className: "github-alert-content"');
    expect(result.code).toContain('href: "https://example.com"');
    expect(result.code).toContain('children: "docs"');
    expect(result.code).toContain('children: "code"');
    expect(result.code).toContain('children: "strong"');
    expect(result.code).not.toContain('[!NOTE]');
  });

  it('compiles prototype-colliding callout inputs without throwing', async () => {
    const callout = await compileTrusted(
      '<Callout type="constructor">body</Callout>',
      true,
      createConfig()
    );
    const admonition = await compileTrusted(
      `:::constructor
body
:::`,
      true,
      createConfig()
    );

    expect(callout.code).toContain('constructor');
    expect(admonition.code).toContain('mdx-preview-admonition-note');
  });

  // pins: github-alert output classes for all 5 types incl title + content
  it('emits github-alert classes (outer + title + content) for all 5 types', async () => {
    const cases: Array<[string, string, string]> = [
      ['NOTE', 'note', 'Note'],
      ['TIP', 'tip', 'Tip'],
      ['IMPORTANT', 'important', 'Important'],
      ['WARNING', 'warning', 'Warning'],
      ['CAUTION', 'caution', 'Caution'],
    ];
    for (const [type, cls, label] of cases) {
      const result = await compileTrusted(
        `> [!${type}]\n> body`,
        true,
        createConfig()
      );
      expect(result.code).toContain(
        `className: "github-alert github-alert-${cls}"`
      );
      expect(result.code).toContain('className: "github-alert-title"');
      expect(result.code).toContain('className: "github-alert-content"');
      expect(result.code).toContain(`children: "${label}"`);
      expect(result.code).not.toContain(`[!${type}]`);
    }
  });

  // pins: wrap paths emit exactly one module-level export default
  it('wrapCompiledMdx (.mdx) yields exactly one module-level export default', async () => {
    const result = await compileTrusted(
      FIXTURES.basicMdx,
      true,
      createConfig({ documentPath: '/workspace/test.mdx' })
    );
    const defaults = result.code.match(/^export default/gm) ?? [];
    expect(defaults.length).toBe(1);
  });

  it('wrapCompiledMd (.md) yields one export default + the layout import', async () => {
    const result = await compileTrusted(
      '# hi\n',
      true,
      createConfig({
        documentPath: '/workspace/test.md',
        useHostMarkdownStyles: true,
      })
    );
    const defaults = result.code.match(/^export default/gm) ?? [];
    expect(defaults.length).toBe(1);
    expect(result.code).toContain('MDXContentWithLayout');
    expect(result.code).toContain("from 'vscode-markdown-layout'");
  });
});
