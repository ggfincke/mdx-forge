// tests/diagnostics/parse-count.test.ts
// one MDX parse feeds every rule class (F11 single-engine integration)

import { describe, expect, it, vi } from 'vitest'
import { analyzeMdxDocument } from '../../src/diagnostics/analyze/index'
import { parseMdxForAnalysis } from '../../src/diagnostics/analyze/parse'
import { DIAGNOSTIC_CODES } from '../../src/diagnostics/index'

vi.mock('../../src/diagnostics/analyze/parse', async (importOriginal) =>
{
  const actual =
    await importOriginal<typeof import('../../src/diagnostics/analyze/parse')>()
  return { ...actual, parseMdxForAnalysis: vi.fn(actual.parseMdxForAnalysis) }
})

describe('analyzeMdxDocument parse count', () =>
{
  it('parses once while emitting component, member & prop diagnostics', () =>
  {
    const src = [
      '---',
      'title: Demo',
      '---',
      '',
      '<Frobnicate />',
      '',
      '<FileTree.Nope />',
      '',
      '<Collapsible open="false">x</Collapsible>',
      '',
    ].join('\n')
    const result = analyzeMdxDocument(src, { framework: 'nextra' })

    expect(result.parseError).toBeUndefined()
    expect(result.diagnostics.map((d) => d.code)).toEqual([
      DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
      DIAGNOSTIC_CODES.UNKNOWN_COMPOUND_MEMBER,
      DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
    ])
    // every rule class above came from a single MDX parse
    expect(vi.mocked(parseMdxForAnalysis).mock.calls).toHaveLength(1)
  })
})
