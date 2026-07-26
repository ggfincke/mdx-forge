// tests/internal/render-plugin-lint.test.ts
// core-diagnostic -> MCP schema adapter mapping (unified engine path)

import { describe, expect, it } from 'vitest'
import { fromCoreDiagnostic } from '../../plugins/render/src/core-engine'

const range = {
  start: { line: 7, column: 3 },
  end: { line: 7, column: 20 },
}

function coreDiag(
  code: string,
  data: Record<string, unknown>,
  message = 'core message'
)
{
  return {
    code,
    ruleId: 'rule',
    severity: 'warning',
    message,
    range,
    data,
  }
}

describe('fromCoreDiagnostic', () =>
{
  it('maps MDXF001 to unknown-component w/ legacy wording & error severity', () =>
  {
    const mapped = fromCoreDiagnostic(
      coreDiag('MDXF001', { componentName: 'Calout', suggestions: [] }),
      'generic'
    )
    expect(mapped).toMatchObject({
      kind: 'unknown-component',
      severity: 'error',
      component: 'Calout',
      line: 7,
      column: 3,
      suggestion: 'Callout',
    })
    expect(mapped?.message).toBe(
      'Component <Calout> is not in the "generic" shim registry.'
    )
  })

  it('prefers the core semantic-alias suggestion for MDXF001', () =>
  {
    const mapped = fromCoreDiagnostic(
      coreDiag('MDXF001', { componentName: 'Note', suggestions: ['Callout'] }),
      'generic'
    )
    expect(mapped?.suggestion).toBe('Callout')
  })

  it('maps prop rules to their legacy kinds w/ payload-driven suggestions', () =>
  {
    expect(
      fromCoreDiagnostic(
        coreDiag('MDXF002', {
          componentName: 'Callout',
          propName: 'titel',
          knownProps: ['type', 'title', 'icon'],
        }),
        'generic'
      )
    ).toMatchObject({
      kind: 'invalid-prop',
      prop: 'titel',
      suggestion: 'title',
    })
    expect(
      fromCoreDiagnostic(
        coreDiag('MDXF003', {
          componentName: 'Callout',
          propName: 'type',
          value: 'warnign',
          values: ['warning', 'tip'],
        }),
        'generic'
      )
    ).toMatchObject({ kind: 'invalid-prop-value', suggestion: 'warning' })
    expect(
      fromCoreDiagnostic(
        coreDiag('MDXF005', {
          componentName: 'Callout',
          propName: 'type',
          canonical: 'warning',
        }),
        'generic'
      )
    ).toMatchObject({ kind: 'deprecated-alias', suggestion: 'warning' })
    expect(
      fromCoreDiagnostic(
        coreDiag('MDXF006', { componentName: 'LinkCard', propName: 'title' }),
        'starlight'
      )
    ).toMatchObject({ kind: 'missing-required-prop', prop: 'title' })
    expect(
      fromCoreDiagnostic(
        coreDiag('MDXF007', { componentName: 'Collapsible', propName: 'open' }),
        'generic'
      )
    ).toMatchObject({ kind: 'invalid-prop-value', severity: 'warning' })
  })

  it('maps MDXF008 to unknown-component keeping the dotted name', () =>
  {
    const mapped = fromCoreDiagnostic(
      coreDiag('MDXF008', {
        componentName: 'FileTree.Nope',
        rootName: 'FileTree',
        memberName: 'Nope',
        allowedMembers: ['Folder', 'File'],
      }),
      'nextra'
    )
    expect(mapped).toMatchObject({
      kind: 'unknown-component',
      severity: 'error',
      component: 'FileTree.Nope',
    })
  })

  it('drops diagnostics from codes this schema predates', () =>
  {
    expect(fromCoreDiagnostic(coreDiag('MDXF999', {}), 'generic')).toBe(
      undefined
    )
  })
})
