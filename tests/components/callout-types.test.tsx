// tests/components/callout-types.test.tsx
// callout component type rendering — verifies normalization integrates w/ render output

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { Callout } from '../../src/components/generic/index'

describe('Callout type rendering', () =>
{
  it('renders a known type w/ correct data attribute', () =>
  {
    const { container } = render(
      React.createElement(Callout, { type: 'warning' }, 'warning content')
    )

    expect(
      container.querySelector('[data-callout-type="warning"]')
    ).not.toBeNull()
  })

  it('resolves alias types in rendered output', () =>
  {
    for (const [alias, expected] of [
      ['warn', 'warning'],
      ['abstract', 'summary'],
    ] as const)
    {
      const { container } = render(
        React.createElement(Callout, { type: alias }, 'Content')
      )

      expect(
        container.querySelector(`[data-callout-type="${expected}"]`),
        `alias "${alias}" should resolve to "${expected}"`
      ).not.toBeNull()
    }
  })

  it('displays custom title when provided', () =>
  {
    const { container } = render(
      React.createElement(
        Callout,
        { type: 'note', title: 'Custom Title' },
        'Body'
      )
    )

    expect(container.textContent).toContain('Custom Title')
  })

  it('displays default title when no custom title', () =>
  {
    const { container } = render(
      React.createElement(Callout, { type: 'warning' }, 'Body')
    )

    expect(container.textContent).toContain('Warning')
  })

  it('defaults to note type when no type provided', () =>
  {
    const { container } = render(
      React.createElement(Callout, null, 'Default callout')
    )

    expect(container.querySelector('[data-callout-type="note"]')).not.toBeNull()
  })
})
