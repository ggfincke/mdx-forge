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

  it('does not claim required props are missing behind an unresolved spread', () => {
    const diagnostics = analyzeMdx(
      '<LinkCard {...props} bogus href="/docs" />\n',
      {
        framework: 'starlight',
      }
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: DIAGNOSTIC_CODES.UNKNOWN_PROP,
      data: { propName: 'bogus' },
    });
  });

  it('checks only literal strings and no-substitution templates as enums', () => {
    for (const value of ["{'bogus'}", '{"bogus"}', '{`bogus`}']) {
      const [diag] = analyzeMdx(`<Callout type=${value}>x</Callout>\n`, {
        framework: 'generic',
      });
      expect(diag.code).toBe(DIAGNOSTIC_CODES.INVALID_ENUM_VALUE);
    }

    expect(
      analyzeMdx('<Callout type={`bogus${variant}`}>x</Callout>\n', {
        framework: 'generic',
      })
    ).toEqual([]);
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
