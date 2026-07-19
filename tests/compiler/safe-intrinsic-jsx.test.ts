// tests/compiler/safe-intrinsic-jsx.test.ts
// T4: Safe intrinsic JSX crossing preserves Markdown semantics (F8)

import { describe, it, expect } from 'vitest';
import { compileSafe } from '../../src/compiler/index';
import type { CompilerConfig } from '../../src/compiler/index';

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

describe('Safe intrinsic JSX structural crossing (F8)', () => {
  it('preserves emphasis & links inside an intrinsic element', async () => {
    const result = await compileSafe(
      '<div>**bold** and [link](https://example.com)</div>',
      createConfig()
    );

    expect(result.html).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(result.html).toMatch(
      /<a href="https:\/\/example\.com"[^>]*>link<\/a>/
    );
    // no empty paragraph artifacts around the block element
    expect(result.html).not.toMatch(/<p[^>]*><\/p>/);
  });

  it('preserves inline code inside an intrinsic element', async () => {
    const result = await compileSafe(
      '<div>run `npm test` now</div>',
      createConfig()
    );

    expect(result.html).toMatch(/<code[^>]*>npm test<\/code>/);
    expect(result.html).not.toMatch(/<p[^>]*><\/p>/);
  });

  it('preserves structure for inline intrinsic elements in prose', async () => {
    const result = await compileSafe(
      'Text with <span title="hi">**inner**</span> here.',
      createConfig()
    );

    expect(result.html).toMatch(
      /<span title="hi"><strong[^>]*>inner<\/strong><\/span>/
    );
  });

  it('preserves nested intrinsic elements & block content', async () => {
    const result = await compileSafe(
      `<section>

<div>

- item **one**
- item two

</div>

</section>`,
      createConfig()
    );

    expect(result.html).toMatch(/<section[^>]*>/);
    expect(result.html).toMatch(/<ul[^>]*>/);
    expect(result.html).toMatch(
      /<li[^>]*>item <strong[^>]*>one<\/strong><\/li>/
    );
  });

  it('serializes static attributes exactly once at the HTML sink', async () => {
    const result = await compileSafe(
      '<div class="x" hidden data-thing="a&b">text</div>',
      createConfig()
    );

    expect(result.html).toMatch(/<div[^>]*class="x"/);
    expect(result.html).toMatch(/<div[^>]*hidden/);
    expect(result.html).toContain('data-thing="a&#x26;b"');
    expect(result.html).not.toContain('&#x26;amp;');
  });

  it('does not double-escape Tab labels', async () => {
    const result = await compileSafe(
      `<Tabs>
  <TabItem label="A & B">content</TabItem>
</Tabs>`,
      createConfig()
    );

    expect(result.html).toContain('A &#x26; B');
    expect(result.html).not.toContain('&#x26;amp;');
    expect(result.html).not.toContain('&amp;amp;');
  });

  it('does not double-escape Collapsible titles', async () => {
    const result = await compileSafe(
      `<Collapsible title="R&D <plans>">
content
</Collapsible>`,
      createConfig()
    );

    expect(result.html).toContain('R&#x26;D');
    // angle brackets escaped once, not rendered as a real element
    expect(result.html).not.toContain('<plans>');
    expect(result.html).not.toContain('&#x26;lt;');
  });
});
