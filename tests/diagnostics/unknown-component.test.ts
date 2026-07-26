// tests/diagnostics/unknown-component.test.ts
// pure rule: classifyComponentSource ladder + analyzeUnknownComponents (MDXF001)

import { describe, expect, it } from 'vitest'
import {
  analyzeUnknownComponents,
  classifyComponentSource,
  type ClassifyContext,
  type DetectedComponent,
} from '../../src/diagnostics/analyze/index'
import { DIAGNOSTIC_CODES } from '../../src/diagnostics/index'

const range = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 12 },
}

function ctx(overrides: Partial<ClassifyContext> = {}): ClassifyContext
{
  return {
    imports: new Set<string>(),
    configComponents: new Set<string>(),
    framework: 'generic',
    ...overrides,
  }
}

function detected(name: string): DetectedComponent
{
  const [root, ...members] = name.split('.')
  return { name, root, members, range, attributes: [] }
}

describe('classifyComponentSource', () =>
{
  it.each([
    {
      name: 'imported components as import',
      component: 'Foo',
      context: { imports: new Set(['Foo']) },
      expected: 'import',
    },
    {
      name: 'config-declared components as config',
      component: 'MyWidget',
      context: { configComponents: new Set(['MyWidget']) },
      expected: 'config',
    },
    {
      name: 'generic builtins as builtin',
      component: 'Callout',
      context: {},
      expected: 'builtin',
    },
    {
      name: 'generic aliases as builtin',
      component: 'Alert',
      context: {},
      expected: 'builtin',
    },
    {
      name: 'framework-only components as framework under that framework',
      component: 'CodeBlock',
      context: { framework: 'docusaurus' as const },
      expected: 'framework',
    },
    {
      name: 'a framework-only component as unknown under generic',
      component: 'CodeBlock',
      context: {},
      expected: 'unknown',
    },
    {
      name: 'unrecognized names as unknown',
      component: 'Frobnicate',
      context: {},
      expected: 'unknown',
    },
  ])('classifies $name', ({ component, context, expected }) =>
  {
    expect(classifyComponentSource(component, ctx(context))).toBe(expected)
  })
})

describe('analyzeUnknownComponents', () =>
{
  it('emits MDXF001 only for unknown components', () =>
  {
    const diags = analyzeUnknownComponents(
      [detected('Callout'), detected('Frobnicate')],
      ctx()
    )
    expect(diags).toHaveLength(1)
    expect(diags[0]).toMatchObject({
      code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
      ruleId: 'unknown-component',
      severity: 'warning',
      source: 'mdx-forge',
      range,
    })
    // value-lock the user-visible message (the prefix is a cross-repo contract)
    expect(diags[0].message).toBe(
      'Unknown component "Frobnicate". Add it to .mdx-previewrc.json or use a built-in shim.'
    )
  })

  it('attaches a semantic-alias suggestion when one exists', () =>
  {
    const [diag] = analyzeUnknownComponents([detected('Note')], ctx())
    expect(diag.data).toEqual({
      componentName: 'Note',
      suggestions: ['Callout'],
    })
  })

  it('emits empty suggestions for a true unknown', () =>
  {
    const [diag] = analyzeUnknownComponents([detected('Frobnicate')], ctx())
    expect(diag.data).toEqual({
      componentName: 'Frobnicate',
      suggestions: [],
    })
  })
})
