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

  it('preserves rich inline markdown inside GitHub alerts', async () => {
    const result = await compileSafe(
      `> [!NOTE]
> Visit [docs](https://example.com) with \`code\`, **strong**, and _emphasis_.`,
      createConfig()
    );

    expect(result.html).toContain('class="github-alert github-alert-note"');
    expect(result.html).toMatch(
      /<a href="https:\/\/example\.com"[^>]*>docs<\/a>/
    );
    expect(result.html).toMatch(/<code[^>]*>code<\/code>/);
    expect(result.html).toMatch(/<strong[^>]*>strong<\/strong>/);
    expect(result.html).toMatch(/<em[^>]*>emphasis<\/em>/);
    expect(result.html).not.toContain('[!NOTE]');
  });

  it('keeps same-line GitHub alert text in the alert body', async () => {
    const result = await compileSafe(
      `> [!WARNING] Same-line **warning** message.`,
      createConfig()
    );

    expect(result.html).toContain('class="github-alert github-alert-warning"');
    expect(result.html).toMatch(/<p[^>]*>Same-line/);
    expect(result.html).toMatch(/<strong[^>]*>warning<\/strong>/);
    expect(result.html).not.toContain('[!WARNING]');
  });

  it('preserves multiple paragraphs inside GitHub alerts', async () => {
    const result = await compileSafe(
      `> [!TIP]
> First paragraph.
>
> Second paragraph with [link](https://example.com/two).`,
      createConfig()
    );

    expect(result.html).toContain('class="github-alert github-alert-tip"');
    expect(result.html).toMatch(/<p[^>]*>First paragraph\.<\/p>/);
    expect(result.html).toMatch(
      /<p[^>]*>Second paragraph with <a href="https:\/\/example\.com\/two"[^>]*>link<\/a>\.<\/p>/
    );
  });

  it('preserves block content inside GitHub alerts', async () => {
    const result = await compileSafe(
      `> [!CAUTION]
> - item **one**
> - item two
>
> \`\`\`ts
> const ok = true;
> \`\`\``,
      createConfig()
    );

    expect(result.html).toContain('class="github-alert github-alert-caution"');
    expect(result.html).toMatch(/<ul[^>]*>/);
    expect(result.html).toMatch(
      /<li[^>]*>item <strong[^>]*>one<\/strong><\/li>/
    );
    expect(result.html).toContain('<pre');
    expect(result.html).toContain('const');
    expect(result.html).toContain('ok');
  });

  it('preserves nested blockquotes inside GitHub alerts', async () => {
    const result = await compileSafe(
      `> [!IMPORTANT]
> Parent content.
>
> > Nested quote with [link](https://example.com/nested).`,
      createConfig()
    );

    expect(result.html).toContain(
      'class="github-alert github-alert-important"'
    );
    expect(result.html).toMatch(/<blockquote[^>]*>/);
    expect(result.html).toMatch(
      /Nested quote with <a href="https:\/\/example\.com\/nested"[^>]*>link<\/a>\./
    );
  });
});

// pins: structural scaffolds are largely untested; lock the divergent shapes
describe('callout/admonition/alert scaffold pins (Safe Mode)', () => {
  it('Callout scaffold: aside outer, div header w/ icon span + escaped text, div content', async () => {
    const result = await compileSafe(
      `<Callout type="note" title="My Title">
Body text
</Callout>`,
      createConfig()
    );

    // outer aside w/ prefix + prefix-{type} classes & data-callout-type
    expect(result.html).toMatch(
      /<aside class="mdx-safe-callout mdx-safe-callout-note" data-callout-type="note">/
    );
    // header is a div w/ icon span + plain text title
    expect(result.html).toMatch(
      /<div class="mdx-safe-callout-header"><span class="mdx-safe-callout-icon"[^>]*><svg[\s\S]*?<\/svg><\/span>My Title<\/div>/
    );
    // content is a div
    expect(result.html).toContain('<div class="mdx-safe-callout-content">');
    expect(result.html).toContain('</aside>');
  });

  it('Callout title is escaped exactly once at the HTML sink', async () => {
    const result = await compileSafe(
      `<Callout type="note" title="a<b>&'c">
Body
</Callout>`,
      createConfig()
    );

    // the title is a hast text node escaped only by the serializer, so the
    // rendered text reads back as the authored characters (no double escape)
    expect(result.html).toContain("a&#x3C;b>&#x26;'c");
    expect(result.html).not.toContain('&#x26;lt;');
    expect(result.html).not.toContain('&amp;amp;');
  });

  it('admonition scaffold: div outer, div header w/ icon span + text, div content', async () => {
    const result = await compileSafe(
      `:::note
Body text
:::`,
      createConfig()
    );

    // outer div w/ prefix + prefix-{type} classes & data-admonition-type
    expect(result.html).toMatch(
      /<div class="mdx-preview-admonition mdx-preview-admonition-note" data-admonition-type="note">/
    );
    // header is a div w/ icon span + plain text label (default "Note")
    expect(result.html).toMatch(
      /<div class="mdx-preview-admonition-header"><span class="mdx-preview-admonition-icon"[^>]*><svg[\s\S]*?<\/svg><\/span>Note<\/div>/
    );
    // content is a div
    expect(result.html).toContain(
      '<div class="mdx-preview-admonition-content">'
    );
  });

  it('github-alert scaffold: div outer, p title w/ combined icon+label HTML, div content', async () => {
    const result = await compileSafe(`> [!TIP]\n> tip body`, createConfig());

    expect(result.html).toMatch(
      /<div class="github-alert github-alert-tip" role="note">/
    );
    // title is a <p>, header children are one combined-HTML string: icon then <span>label</span>
    expect(result.html).toMatch(
      /<p class="github-alert-title"><svg[\s\S]*?<\/svg><span[^>]*>Tip<\/span><\/p>/
    );
    expect(result.html).toContain('<div class="github-alert-content">');
  });

  it('github-alert classes + title + content for all 5 alert types', async () => {
    const cases: Array<[string, string, string]> = [
      ['NOTE', 'note', 'Note'],
      ['TIP', 'tip', 'Tip'],
      ['IMPORTANT', 'important', 'Important'],
      ['WARNING', 'warning', 'Warning'],
      ['CAUTION', 'caution', 'Caution'],
    ];
    for (const [type, cls, label] of cases) {
      const result = await compileSafe(`> [!${type}]\n> body`, createConfig());
      expect(result.html).toContain(`class="github-alert github-alert-${cls}"`);
      expect(result.html).toContain('class="github-alert-title"');
      expect(result.html).toContain('class="github-alert-content"');
      expect(result.html).toContain(
        `<span data-source-line="1">${label}</span>`
      );
    }
  });
});
