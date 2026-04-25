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
});
