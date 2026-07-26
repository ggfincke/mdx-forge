// tests/diagnostics-exports.test.ts
// verify diagnostics contract + analyze engine public API surface

import { describe, expect, it } from 'vitest'
import * as contract from '../src/diagnostics/index'
import * as analyze from '../src/diagnostics/analyze/index'

describe('diagnostics contract exports', () =>
{
  it('locks the full MDXF code set', () =>
  {
    expect(contract.DIAGNOSTIC_CODES).toMatchObject({
      UNKNOWN_COMPONENT: 'MDXF001',
      UNKNOWN_PROP: 'MDXF002',
      INVALID_ENUM_VALUE: 'MDXF003',
      DEPRECATED_PROP: 'MDXF004',
      DEPRECATED_ALIAS: 'MDXF005',
      MISSING_REQUIRED_PROP: 'MDXF006',
      INVALID_PROP_VALUE: 'MDXF007',
      UNKNOWN_COMPOUND_MEMBER: 'MDXF008',
      INVALID_FRONTMATTER: 'MDXF020',
      DUPLICATE_HEADING_ID: 'MDXF021',
      BROKEN_LINK: 'MDXF030',
      BROKEN_ANCHOR: 'MDXF031',
      MISSING_ASSET: 'MDXF032',
      MDX_PARSE_ERROR: 'MDXF100',
      PLUGIN_LOAD_ERROR: 'MDXF101',
      UNSUPPORTED_IN_SAFE_MODE: 'MDXF110',
      UNSAFE_URL: 'MDXF111',
      UNSUPPORTED_ELEMENT: 'MDXF112',
      UNSUPPORTED_ATTRIBUTE: 'MDXF113',
      UNSUPPORTED_RAW_HTML: 'MDXF114',
    })
  })
})

describe('diagnostics analyze exports', () =>
{
  it('exposes the engine entry & reusable pure rules', () =>
  {
    expect(typeof analyze.analyzeMdx).toBe('function')
    expect(typeof analyze.analyzeMdxDocument).toBe('function')
    expect(typeof analyze.classifyComponentSource).toBe('function')
    expect(typeof analyze.analyzeUnknownComponents).toBe('function')
    expect(typeof analyze.analyzeCompoundMember).toBe('function')
    expect(typeof analyze.analyzeComponentProps).toBe('function')
    expect('parseMdxForAnalysis' in analyze).toBe(false)
    expect('ParsedMdx' in analyze).toBe(false)
  })
})
