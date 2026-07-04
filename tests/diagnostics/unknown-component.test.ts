// tests/diagnostics/unknown-component.test.ts
// pure rule: classifyComponentSource ladder + analyzeUnknownComponents (MDXF001)

import { describe, expect, it } from 'vitest';
import {
  analyzeUnknownComponents,
  classifyComponentSource,
  type ClassifyContext,
  type DetectedComponent,
} from '../../src/diagnostics/analyze/index';
import { DIAGNOSTIC_CODES } from '../../src/diagnostics/index';

const range = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 12 },
};

function ctx(overrides: Partial<ClassifyContext> = {}): ClassifyContext {
  return {
    imports: new Set<string>(),
    configComponents: new Set<string>(),
    framework: 'generic',
    ...overrides,
  };
}

function detected(name: string): DetectedComponent {
  return { name, range };
}

describe('classifyComponentSource', () => {
  it('classifies imported components as import', () => {
    expect(
      classifyComponentSource('Foo', ctx({ imports: new Set(['Foo']) }))
    ).toBe('import');
  });

  it('classifies config-declared components as config', () => {
    expect(
      classifyComponentSource(
        'MyWidget',
        ctx({ configComponents: new Set(['MyWidget']) })
      )
    ).toBe('config');
  });

  it('classifies generic builtins as builtin', () => {
    expect(classifyComponentSource('Callout', ctx())).toBe('builtin');
  });

  it('classifies generic aliases as builtin', () => {
    expect(classifyComponentSource('Alert', ctx())).toBe('builtin');
  });

  it('classifies framework-only components as framework under that framework', () => {
    expect(
      classifyComponentSource('CodeBlock', ctx({ framework: 'docusaurus' }))
    ).toBe('framework');
  });

  it('classifies a framework-only component as unknown under generic', () => {
    // CodeBlock is docusaurus-only & not generic -> framework accuracy in action
    expect(classifyComponentSource('CodeBlock', ctx())).toBe('unknown');
  });

  it('classifies unrecognized names as unknown', () => {
    expect(classifyComponentSource('Frobnicate', ctx())).toBe('unknown');
  });
});

describe('analyzeUnknownComponents', () => {
  it('emits MDXF001 only for unknown components', () => {
    const diags = analyzeUnknownComponents(
      [detected('Callout'), detected('Frobnicate')],
      ctx()
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
      ruleId: 'unknown-component',
      severity: 'warning',
      source: 'mdx-forge',
      range,
    });
    // value-lock the user-visible message (the prefix is a cross-repo contract)
    expect(diags[0].message).toBe(
      'Unknown component "Frobnicate". Add it to .mdx-previewrc.json or use a built-in shim.'
    );
  });

  it('attaches a semantic-alias suggestion when one exists', () => {
    const [diag] = analyzeUnknownComponents([detected('Note')], ctx());
    expect(diag.data).toEqual({
      componentName: 'Note',
      suggestions: ['Callout'],
    });
  });

  it('emits empty suggestions for a true unknown', () => {
    const [diag] = analyzeUnknownComponents([detected('Frobnicate')], ctx());
    expect(diag.data).toEqual({
      componentName: 'Frobnicate',
      suggestions: [],
    });
  });

  it('stays silent for a framework component under its framework', () => {
    expect(
      analyzeUnknownComponents(
        [detected('CodeBlock')],
        ctx({ framework: 'docusaurus' })
      )
    ).toEqual([]);
  });
});
