// tests/compiler/safe-compile.test.ts
// unit tests for Safe Mode MDX compilation (MDX -> HTML) via compiler

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { compileSafe } from '../../src/compiler/index';
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

describe('compileSafe()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles basic MDX to HTML', async () => {
    const result = await compileSafe(FIXTURES.basicMdx, createConfig());

    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Hello');
    expect(result.html).toContain('<p');
    expect(result.html).toContain('World');
  });

  it('extracts frontmatter and returns it separately', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithFrontmatter,
      createConfig()
    );

    expect(result.frontmatter).toBeDefined();
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.author).toBe('Test Author');
    // frontmatter should not appear in HTML
    expect(result.html).not.toContain('Test Document');
    expect(result.html).not.toContain('author:');
  });

  it('creates placeholder for unknown JSX components (default behavior)', async () => {
    const result = await compileSafe(FIXTURES.mdxWithJsx, createConfig());

    expect(result.html).toContain('mdx-unknown-component-placeholder');
    expect(result.html).toContain('CustomComponent');
  });

  it('strips unknown components when unknownBehavior is "strip"', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithJsx,
      createConfig({ componentsUnknownBehavior: 'strip' })
    );

    expect(result.html).not.toContain('CustomComponent');
    expect(result.html).not.toContain('mdx-unknown-component');
  });

  it('replaces JSX expressions with placeholder', async () => {
    const result = await compileSafe(
      FIXTURES.mdxWithExpression,
      createConfig()
    );

    expect(result.html).toContain('mdx-expression-placeholder');
    expect(result.html).toContain('{...}');
    // should not evaluate the expression
    expect(result.html).not.toContain('42');
  });

  it('handles code blocks correctly', async () => {
    const result = await compileSafe(FIXTURES.mdxWithCodeBlock, createConfig());

    expect(result.html).toContain('<pre');
    expect(result.html).toContain('<code');
    expect(result.html).toContain('const');
  });

  it('adds data-source-line metadata for preview hover mapping', async () => {
    const result = await compileSafe(FIXTURES.basicMdx, createConfig());

    expect(result.html).toMatch(/<h1[^>]*data-source-line="1"[^>]*>/);
    expect(result.html).toMatch(/<p[^>]*data-source-line="3"[^>]*>/);
  });

  it('converts PlantUML code blocks into placeholders', async () => {
    const result = await compileSafe(
      `\`\`\`plantuml
@startuml
Alice -> Bob: Hi
@enduml
\`\`\``,
      createConfig()
    );

    expect(result.html).toContain('plantuml-container');
    expect(result.html).toContain('data-plantuml-code');
  });

  it('converts Graphviz code blocks into placeholders', async () => {
    const result = await compileSafe(
      `\`\`\`dot
digraph G { A -> B }
\`\`\``,
      createConfig()
    );

    expect(result.html).toContain('graphviz-container');
    expect(result.html).toContain('data-graphviz-code');
  });

  it('returns empty frontmatter when none present', async () => {
    const result = await compileSafe(FIXTURES.basicMdx, createConfig());

    expect(result.frontmatter).toEqual({});
  });

  it('renders raw HTML table tags as HTML elements', async () => {
    const result = await compileSafe(FIXTURES.mdxWithHtmlTable, createConfig());

    expect(result.html).toMatch(/<table[\s>]/);
    expect(result.html).toMatch(/<td[\s>]/);
    expect(result.html).toContain('Cell 1');
    expect(result.html).toContain('Cell 2');
    expect(result.html).not.toContain('&lt;table&gt;');
  });

  it('escapes HTML in callout titles to prevent XSS', async () => {
    const mdx = `<Callout type="note" title="<script>alert('xss')</script>">
  Content here
</Callout>`;

    const result = await compileSafe(mdx, createConfig());

    expect(result.html).not.toContain('<script>');
    expect(result.html).not.toContain('</script>');
  });
});
