// tests/diagnostics/analyze.test.ts
// analyzeMdx integration: parse + safe frontmatter + file-relative positions

import { describe, expect, it } from 'vitest';
import { analyzeMdx } from '../../src/diagnostics/analyze/index';
import { DIAGNOSTIC_CODES } from '../../src/diagnostics/index';

const probe = globalThis as Record<string, unknown>;
const PWNED = '__mdxForgeAnalyzePwned';

describe('analyzeMdx', () => {
  it('flags an unknown component with a body-relative range (no frontmatter)', () => {
    const src = '# Heading\n\n<Frobnicate />\n';
    const diags = analyzeMdx(src, { framework: 'generic' });
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe(DIAGNOSTIC_CODES.UNKNOWN_COMPONENT);
    // <Frobnicate /> is on line 3 of the original document
    expect(diags[0].range?.start.line).toBe(3);
  });

  it('shifts ranges past stripped frontmatter to original-file lines', () => {
    const src = '---\ntitle: Test\n---\n\n# Heading\n\n<Frobnicate />\n';
    const [diag] = analyzeMdx(src, { framework: 'generic' });
    // original line 7 (frontmatter occupies lines 1-3)
    expect(diag.range?.start.line).toBe(7);
  });

  it('does not evaluate ---js frontmatter while still analyzing the body', () => {
    probe[PWNED] = undefined;
    const src = `---js\n((globalThis['${PWNED}'] = true), {})\n---\n<Frobnicate />\n`;
    const diags = analyzeMdx(src, { framework: 'generic' });
    expect(probe[PWNED]).toBeUndefined();
    expect(diags).toHaveLength(1);
    // <Frobnicate /> is on original line 4
    expect(diags[0].range?.start.line).toBe(4);
  });

  it('treats imported components as known', () => {
    const src = "import Foo from './foo';\n\n<Foo />\n";
    expect(analyzeMdx(src, { framework: 'generic' })).toEqual([]);
  });

  it('treats doc-local exported components as known', () => {
    expect(
      analyzeMdx('export const Fancy = () => null;\n\n<Fancy />\n', {
        framework: 'generic',
      })
    ).toEqual([]);
    expect(
      analyzeMdx('export function Widget() { return null; }\n\n<Widget />\n', {
        framework: 'generic',
      })
    ).toEqual([]);
  });

  it('treats config-declared components as known', () => {
    const src = '<MyWidget />\n';
    expect(
      analyzeMdx(src, { framework: 'generic', configComponents: ['MyWidget'] })
    ).toEqual([]);
  });

  it('is framework-accurate: a docusaurus component is known under docusaurus', () => {
    const src = '<CodeBlock>code</CodeBlock>\n';
    expect(analyzeMdx(src, { framework: 'docusaurus' })).toEqual([]);
    // ...but unknown under a generic document
    expect(analyzeMdx(src, { framework: 'generic' })).toHaveLength(1);
  });

  it('ignores html elements and lowercase tags', () => {
    const src = '<div>hi</div>\n\n<Button />\n\n<Table />\n\nplain text\n';
    expect(analyzeMdx(src, { framework: 'generic' })).toEqual([]);
  });

  it('handles unknown framework strings without throwing', () => {
    const src = '<Frobnicate />\n';
    expect(() => analyzeMdx(src, { framework: 'next' as never })).not.toThrow();
    expect(analyzeMdx(src, { framework: 'next' as never })).toHaveLength(1);
  });

  it('positions correctly past empty & trailing-whitespace frontmatter fences', () => {
    // empty frontmatter is stripped even though gray-matter reports no data
    expect(
      analyzeMdx('---\n---\n<Frobnicate />\n', { framework: 'generic' })[0]
        ?.range?.start.line
    ).toBe(3);
    // a closing fence w/ trailing whitespace is still stripped by gray-matter
    expect(
      analyzeMdx('---\ntitle: x\n---   \n<Frobnicate />\n', {
        framework: 'generic',
      })[0]?.range?.start.line
    ).toBe(4);
  });

  it('positions correctly past CRLF and lone-CR frontmatter fences', () => {
    expect(
      analyzeMdx('---\r\ntitle: x\r\n---\r\n<Frobnicate />\r\n', {
        framework: 'generic',
      })[0]?.range?.start.line
    ).toBe(4);
    expect(
      analyzeMdx('---\ntitle: x\n---\r<Frobnicate />\r', {
        framework: 'generic',
      })[0]?.range?.start.line
    ).toBe(4);
  });

  it('keeps same-line frontmatter body columns file-relative', () => {
    const [diag] = analyzeMdx('---\ntitle: x\n--- <Frobnicate />\n', {
      framework: 'generic',
    });
    expect(diag.range?.start).toEqual({ line: 3, column: 5 });
  });

  it('does not treat a stripped BOM as frontmatter', () => {
    const [diag] = analyzeMdx('\uFEFFintro\n\n---\n\n<Frobnicate />\n', {
      framework: 'generic',
    });
    expect(diag.range?.start.line).toBe(5);
  });

  it('coerces buffer input from untyped callers', () => {
    const src = Buffer.from('<Frobnicate />\n') as unknown as string;
    expect(analyzeMdx(src, { framework: 'generic' })).toHaveLength(1);
  });

  it('returns no diagnostics for unparseable MDX rather than throwing', () => {
    // unterminated expression & ts type-only imports both throw; swallowed for v1
    // (a deferred Source-A / MDXF100 concern; these inputs do not compile either)
    for (const src of [
      '# Title\n\n<Foo {...\n',
      'import type { T } from "./a";\n\n<Frobnicate />\n',
    ]) {
      expect(() => analyzeMdx(src, { framework: 'generic' })).not.toThrow();
      expect(analyzeMdx(src, { framework: 'generic' })).toEqual([]);
    }
  });
});
