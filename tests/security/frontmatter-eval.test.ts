// tests/security/frontmatter-eval.test.ts
// regression: ---js / ---javascript frontmatter must not be eval'd (CWE-94 RCE)

import { describe, it, expect } from 'vitest'
import { safeMatter } from '../../src/internal/frontmatter'
import { extractFrontmatter } from '../../src/compiler/pipeline/common/mdx-common'

const probe = globalThis as Record<string, unknown>
const PWNED = '__mdxForgeFrontmatterPwned'

describe('frontmatter eval hardening', () =>
{
  it('does not eval ---js frontmatter (safeMatter)', () =>
  {
    probe[PWNED] = undefined
    const malicious = `---js\n((globalThis['${PWNED}'] = true), {})\n---\n# body\n`
    const result = safeMatter(malicious)
    expect(probe[PWNED]).toBeUndefined()
    expect(result.data).toEqual({})
    expect(result.content).toContain('# body')
  })

  it('does not eval ---javascript frontmatter (safeMatter)', () =>
  {
    probe[PWNED] = undefined
    safeMatter(
      `---javascript\n((globalThis['${PWNED}'] = true), {})\n---\nbody`
    )
    expect(probe[PWNED]).toBeUndefined()
  })

  it('does not eval ---js frontmatter via extractFrontmatter (compileSafe path)', () =>
  {
    probe[PWNED] = undefined
    const { frontmatter } = extractFrontmatter(
      `---js\n((globalThis['${PWNED}'] = true), {})\n---\nhi`
    )
    expect(probe[PWNED]).toBeUndefined()
    expect(frontmatter).toEqual({})
  })

  it('still parses normal YAML frontmatter', () =>
  {
    const { frontmatter, content } = extractFrontmatter(
      '---\ntitle: Hello\ncount: 3\n---\n# Body\n'
    )
    expect(frontmatter).toEqual({ title: 'Hello', count: 3 })
    expect(content).toContain('# Body')
  })
})
