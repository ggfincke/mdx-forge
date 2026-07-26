// tests/compiler/format-detect.test.ts
// tests for .md (lenient CommonMark) vs .mdx (strict MDX) format handling

import { describe, it, expect } from 'vitest'
import { compileSafe, compileTrusted } from '../../src/compiler/index'
import type { CompilerConfig } from '../../src/compiler/index'

function config(overrides: Partial<CompilerConfig> = {}): CompilerConfig
{
  return {
    documentPath: '/workspace/doc.mdx',
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  }
}

// content that is valid prose but illegal MDX (`<1` reads as a JSX tag)
const PROSE_WITH_LT = 'Onboard a new tester in <1 day.\n'

describe('format detection (.md vs .mdx)', () =>
{
  describe('Safe Mode', () =>
  {
    it('.md treats `<1` as literal prose (no error)', async () =>
    {
      const result = await compileSafe(
        PROSE_WITH_LT,
        config({ documentPath: '/workspace/notes.md' })
      )
      expect(result.html).toContain('1 day')
    })

    it('.mdx still rejects `<1` (strict MDX preserved)', async () =>
    {
      await expect(
        compileSafe(
          PROSE_WITH_LT,
          config({ documentPath: '/workspace/doc.mdx' })
        )
      ).rejects.toThrow()
    })

    it('explicit format:"md" overrides a .mdx extension', async () =>
    {
      const result = await compileSafe(
        PROSE_WITH_LT,
        config({ documentPath: '/workspace/doc.mdx', format: 'md' })
      )
      expect(result.html).toContain('1 day')
    })
  })

  describe('Trusted Mode', () =>
  {
    it('.md compiles `<1` prose to a module (no error)', async () =>
    {
      const result = await compileTrusted(
        PROSE_WITH_LT,
        true,
        config({ documentPath: '/workspace/notes.md' })
      )
      expect(result.code).toContain('MDXContent')
    })

    it('.mdx still rejects `<1`', async () =>
    {
      await expect(
        compileTrusted(
          PROSE_WITH_LT,
          true,
          config({ documentPath: '/workspace/doc.mdx' })
        )
      ).rejects.toThrow()
    })
  })
})
