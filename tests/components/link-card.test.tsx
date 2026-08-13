// tests/components/link-card.test.tsx
// t5: LinkCard preserves navigation & forwards anchor props (F18)

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { LinkCard } from '../../src/components/starlight/LinkCard'

function anchorFor(element: React.ReactElement): HTMLAnchorElement
{
  const { container } = render(element)
  const anchor = container.querySelector('a')
  if (!anchor)
  {
    throw new Error('anchor not rendered')
  }
  return anchor
}

describe('Starlight LinkCard (F18)', () =>
{
  it('internal links navigate in the same tab w/o rel', () =>
  {
    const anchor = anchorFor(<LinkCard title="Docs" href="/docs" />)

    expect(anchor.getAttribute('href')).toBe('/docs')
    expect(anchor.getAttribute('target')).toBeNull()
    expect(anchor.getAttribute('rel')).toBeNull()
  })

  it('external links open a new tab w/ safe rel', () =>
  {
    for (const href of [
      'https://example.com/a b?q=x y',
      '//cdn.example.com/a b?q=x y',
    ])
    {
      const anchor = anchorFor(<LinkCard title="Site" href={href} />)

      expect(anchor.getAttribute('target')).toBe('_blank')
      const rel = anchor.getAttribute('rel') ?? ''
      expect(rel).toContain('noopener')
      expect(rel).toContain('noreferrer')
    }
  })

  it('treats non-HTTP URL schemes as external', () =>
  {
    for (const href of [
      'mailto:docs team@example.com?subject=hello world',
      'tel:+1 212 555 0100',
    ])
    {
      const anchor = anchorFor(<LinkCard title="Contact" href={href} />)

      expect(anchor.getAttribute('target')).toBe('_blank')
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('keeps repaired or control-bearing URLs in the current tab', () =>
  {
    for (const href of [
      'HTTPS:example.com',
      'https:/example.com',
      'https:\\example.com',
      'http:////example.com',
      'https://example.com\\@evil.test/path',
      'https://example.com/path\\child',
      '//example.com\\path',
      '//\t/path',
      'mailto:docs\u001f@example.com',
      'tel:+1\u007f212',
    ])
    {
      const anchor = anchorFor(<LinkCard title="Invalid" href={href} />)

      expect(anchor.getAttribute('target')).toBeNull()
      expect(anchor.getAttribute('rel')).toBeNull()
    }
  })

  it('explicit target wins & rel stays untouched w/o _blank', () =>
  {
    const anchor = anchorFor(
      <LinkCard title="Site" href="https://example.com" target="_self" />
    )

    expect(anchor.getAttribute('target')).toBe('_self')
    expect(anchor.getAttribute('rel')).toBeNull()
  })

  it('explicit _blank on internal links applies safe rel & merges tokens', () =>
  {
    const anchor = anchorFor(
      <LinkCard title="Docs" href="/docs" target="_blank" rel="external" />
    )

    expect(anchor.getAttribute('target')).toBe('_blank')
    const rel = anchor.getAttribute('rel') ?? ''
    expect(rel).toContain('external')
    expect(rel).toContain('noopener')
    expect(rel).toContain('noreferrer')
  })

  it('forwards native anchor props (aria-label, download, id)', () =>
  {
    const anchor = anchorFor(
      <LinkCard
        title="Report"
        href="/report.pdf"
        aria-label="Download report"
        download
        id="report-card"
      />
    )

    expect(anchor.getAttribute('aria-label')).toBe('Download report')
    expect(anchor.hasAttribute('download')).toBe(true)
    expect(anchor.id).toBe('report-card')
  })

  it('renders title & description content', () =>
  {
    const { container } = render(
      <LinkCard title="Docs" href="/docs" description="Get started" />
    )

    expect(container.textContent).toContain('Docs')
    expect(container.textContent).toContain('Get started')
  })
})
