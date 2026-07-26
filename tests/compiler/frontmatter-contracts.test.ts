// tests/compiler/frontmatter-contracts.test.ts
// regression coverage for frontmatter root shape, metadata & UTF-8 byte caps

import { describe, expect, it } from 'vitest'
import {
  compileSafe,
  compileSafeDocument,
  compileTrusted,
  extractFrontmatter,
  extractNextraFrontmatter,
} from '../../src/compiler'
import type { CompilerConfig } from '../../src/compiler'
import { analyzeMdxDocument } from '../../src/diagnostics/analyze'
import {
  FrontmatterBoundsError,
  MAX_FRONTMATTER_SERIALIZED_BYTES,
  safeMatter,
} from '../../src/internal/frontmatter'

const CHAR_CASES = [
  { label: 'ASCII', char: 'a', bytes: 1 },
  { label: 'astral', char: '😀', bytes: 4 },
] as const

function compilerConfig(): CompilerConfig
{
  return {
    documentPath: '/workspace/test.mdx',
    componentsBuiltins: false,
    useHostMarkdownStyles: false,
  }
}

function frontmatterSource(yaml: string): string
{
  return `---\n${yaml}\n---\n# Body`
}

function valueBoundarySource(
  char: string,
  bytes: number,
  over: boolean
): string
{
  const fixedBytes = new TextEncoder().encode('value').byteLength + 6
  const repeatCount =
    Math.floor((MAX_FRONTMATTER_SERIALIZED_BYTES - fixedBytes) / bytes) +
    (over ? 1 : 0)
  return frontmatterSource(`value: ${JSON.stringify(char.repeat(repeatCount))}`)
}

function keyBoundarySource(char: string, bytes: number, over: boolean): string
{
  const entryCount = 512
  const baseBytes = Array.from(
    { length: entryCount },
    (_, index) => String(index).length + 8
  ).reduce((total, entryBytes) => total + entryBytes, 0)
  let remainingChars = Math.floor(
    (MAX_FRONTMATTER_SERIALIZED_BYTES - baseBytes) / bytes
  )
  const keys = Array.from({ length: entryCount }, (_, index) =>
  {
    const entryChars = Math.floor(remainingChars / (entryCount - index))
    remainingChars -= entryChars
    return `${char.repeat(entryChars)}${index}`
  })
  if (over)
  {
    keys[0] = `${char}${keys[0]}`
  }
  return frontmatterSource(
    keys.map((key) => `${JSON.stringify(key)}: null`).join('\n')
  )
}

describe('frontmatter root shape', () =>
{
  it.each([
    { root: 'array', yaml: '- one\n- two', expected: {} },
    { root: 'mapping', yaml: 'title: Hello', expected: { title: 'Hello' } },
  ])('normalizes $root roots consistently', async ({ yaml, expected }) =>
  {
    const source = frontmatterSource(yaml)

    expect(extractFrontmatter(source).frontmatter).toEqual(expected)
    expect((await compileSafe(source, compilerConfig())).frontmatter).toEqual(
      expected
    )
    expect(
      (await compileTrusted(source, true, compilerConfig())).frontmatter
    ).toEqual(expected)
    expect((await compileSafeDocument(source)).frontmatter).toEqual(expected)
    expect(
      analyzeMdxDocument(source, { framework: 'generic' }).frontmatter
    ).toEqual(expected)
  })
})

describe('frontmatter UTF-8 byte limits', () =>
{
  it.each(CHAR_CASES)(
    'counts $label serialized values & keys in normalized frontmatter',
    ({ char, bytes }) =>
    {
      expect(() =>
        safeMatter(valueBoundarySource(char, bytes, false))
      ).not.toThrow()
      expect(() => safeMatter(valueBoundarySource(char, bytes, true))).toThrow(
        FrontmatterBoundsError
      )
      expect(() =>
        safeMatter(keyBoundarySource(char, bytes, false))
      ).not.toThrow()
      expect(() => safeMatter(keyBoundarySource(char, bytes, true))).toThrow(
        FrontmatterBoundsError
      )
    }
  )

  it.each(CHAR_CASES)(
    'counts $label serialized values & keys in safe documents',
    async ({ char, bytes }) =>
    {
      const acceptedValue = await compileSafeDocument(
        valueBoundarySource(char, bytes, false)
      )
      const rejectedValue = await compileSafeDocument(
        valueBoundarySource(char, bytes, true)
      )
      const acceptedKeys = await compileSafeDocument(
        keyBoundarySource(char, bytes, false)
      )
      const rejectedKeys = await compileSafeDocument(
        keyBoundarySource(char, bytes, true)
      )

      expect(acceptedValue.diagnostics).toEqual([])
      expect(rejectedValue.diagnostics[0]?.message).toMatch(/projected size/)
      expect(acceptedKeys.diagnostics).toEqual([])
      expect(rejectedKeys.diagnostics[0]?.message).toMatch(/projected size/)
    }
  )
})

describe('Nextra frontmatter extraction', () =>
{
  it('copies boolean toc values & rejects non-booleans', () =>
  {
    expect(extractNextraFrontmatter({ toc: true })).toEqual({ toc: true })
    expect(extractNextraFrontmatter({ toc: false })).toEqual({ toc: false })
    expect(extractNextraFrontmatter({ toc: 'false' })).toEqual({})
  })
})
