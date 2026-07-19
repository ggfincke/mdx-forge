// tests/diagnostics/prop-validation.test.ts
// prop rules (MDXF002-MDXF007) through the analyze engine + file positions

import { describe, expect, it } from 'vitest';
import {
  analyzeComponentProps,
  analyzeMdx,
  type DetectedComponent,
} from '../../src/diagnostics/analyze/index';
import { DIAGNOSTIC_CODES } from '../../src/diagnostics/index';

describe('prop validation via analyzeMdx', () => {
  it('flags boolean props given string values (open="false")', () => {
    const [diag] = analyzeMdx('<Collapsible open="false">x</Collapsible>\n', {
      framework: 'generic',
    });
    expect(diag.code).toBe(DIAGNOSTIC_CODES.INVALID_PROP_VALUE);
    expect(diag.data).toMatchObject({
      propName: 'open',
      expectedType: 'boolean',
    });
    expect(diag.message).toContain('open={false}');
  });

  it('flags "only" as unknown instead of accepting every on* name', () => {
    const [diag] = analyzeMdx('<Collapsible only="x">x</Collapsible>\n', {
      framework: 'generic',
    });
    expect(diag.code).toBe(DIAGNOSTIC_CODES.UNKNOWN_PROP);
    expect(diag.data).toMatchObject({ propName: 'only' });
  });

  it('accepts event props & universal DOM escape hatches', () => {
    const src =
      '<Collapsible onClick={fn} data-id="y" aria-label="z" className="c">x</Collapsible>\n';
    expect(analyzeMdx(src, { framework: 'generic' })).toEqual([]);
  });

  it('flags invalid enum values with the allowed set', () => {
    const [diag] = analyzeMdx('<Callout type="bogus">x</Callout>\n', {
      framework: 'generic',
    });
    expect(diag.code).toBe(DIAGNOSTIC_CODES.INVALID_ENUM_VALUE);
    expect((diag.data as { values: string[] }).values.includes('warning')).toBe(
      true
    );
  });

  it('flags deprecated enum aliases with their canonical value', () => {
    const [diag] = analyzeMdx('<Callout type="warn">x</Callout>\n', {
      framework: 'generic',
    });
    expect(diag.code).toBe(DIAGNOSTIC_CODES.DEPRECATED_ALIAS);
    expect(diag.data).toMatchObject({ canonical: 'warning' });
  });

  it('flags missing required props for framework components', () => {
    const [diag] = analyzeMdx('<LinkCard href="/docs" />\n', {
      framework: 'starlight',
    });
    expect(diag.code).toBe(DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP);
    expect(diag.data).toMatchObject({ propName: 'title' });
  });

  it('reports original-file positions for prop diagnostics after frontmatter', () => {
    const src =
      '---\ntitle: Demo\n---\n\n# Heading\n\n<Collapsible open="false">x</Collapsible>\n';
    const [diag] = analyzeMdx(src, { framework: 'generic' });
    // frontmatter occupies lines 1-3; the element is on original line 7
    expect(diag.range?.start.line).toBe(7);
  });
});

describe('analyzeComponentProps rule', () => {
  const component: DetectedComponent = {
    name: 'Widget',
    root: 'Widget',
    members: [],
    range: { start: { line: 1, column: 1 }, end: { line: 1, column: 10 } },
    attributes: [{ kind: 'string', name: 'legacy', value: 'x' }],
  };

  it('flags deprecated props (MDXF004)', () => {
    const [diag] = analyzeComponentProps(component, [
      { name: 'legacy', type: 'string', deprecated: true, deprecatedIn: '2.0' },
    ]);
    expect(diag.code).toBe(DIAGNOSTIC_CODES.DEPRECATED_PROP);
    expect(diag.message).toContain('2.0');
  });
});
