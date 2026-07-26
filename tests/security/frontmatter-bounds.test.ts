// tests/security/frontmatter-bounds.test.ts
// f22: frontmatter graphs are bounded acyclic plain data; aliases stay usable

import { describe, it, expect } from 'vitest'
import {
  FrontmatterBoundsError,
  normalizeFrontmatterData,
  safeMatter,
} from '../../src/internal/frontmatter'

describe('frontmatter bounds', () =>
{
  it('rejects exponentially amplified YAML aliases fast & bounded', () =>
  {
    // billion-laughs style fan-out; parsing is cheap (shared refs) but the
    // projected/expanded graph must be refused before it materializes
    const bomb = [
      'a: &a ["x","x","x","x","x","x","x","x","x"]',
      'b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]',
      'c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]',
      'd: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]',
      '---',
      '# body',
      '',
    ].join('\n')
    const start = Date.now()
    expect(() => safeMatter(`---\n${bomb}`)).toThrow(FrontmatterBoundsError)
    // bounded: bails at the node cap, not after full expansion
    expect(Date.now() - start).toBeLessThan(1000)
  })

  it('rejects cyclic YAML aliases with a deterministic diagnostic', () =>
  {
    const cyclic = ['a: &anchor', '  self: *anchor', '---', 'body', ''].join(
      '\n'
    )
    expect(() => safeMatter(`---\n${cyclic}`)).toThrow(/cyclic reference/i)
  })

  it('keeps ordinary in-bounds anchors/aliases working', () =>
  {
    const doc = [
      'defaults: &d',
      '  color: red',
      '  size: 3',
      'primary: *d',
      'secondary: *d',
      '---',
      'body',
      '',
    ].join('\n')
    const parsed = safeMatter(`---\n${doc}`)
    expect(parsed.data.primary).toEqual({ color: 'red', size: 3 })
    expect(parsed.data.secondary).toEqual({ color: 'red', size: 3 })
    // expanded to independent plain copies (acyclic), safe to JSON.stringify
    expect(() => JSON.stringify(parsed.data)).not.toThrow()
  })

  it('normalizes nested objects/arrays into plain copies', () =>
  {
    const src = { a: [{ b: 1 }], c: { d: [2, 3] } }
    const out = normalizeFrontmatterData(src)
    expect(out).toEqual(src)
    expect(out).not.toBe(src)
  })
})
