// tests/components/tabs-hydration.test.tsx
// t5: index tabs hydrate deterministically w/ stored state (F13)

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { act } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot, type Root } from 'react-dom/client'
import { Tabs } from '../../src/components/nextra/Tabs'

// mark this file as an act() environment for manual hydrateRoot usage
;(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

function fixture(): React.ReactElement
{
  return (
    <Tabs items={['A', 'B']} storageKey="hydration">
      <Tabs.Tab>content-a</Tabs.Tab>
      <Tabs.Tab>content-b</Tabs.Tab>
    </Tabs>
  )
}

function selectedStates(scope: ParentNode): string[]
{
  return Array.from(scope.querySelectorAll('[role="tab"]')).map(
    (el) => el.getAttribute('aria-selected') ?? ''
  )
}

describe('index tabs SSR + hydration (F13)', () =>
{
  let container: HTMLDivElement
  let root: Root | undefined

  beforeEach(() =>
  {
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() =>
  {
    if (root)
    {
      act(() => root!.unmount())
      root = undefined
    }
    container.remove()
  })

  it('server render ignores storage & hydration matches, then restores', () =>
  {
    window.localStorage.setItem('nextra-tabs-hydration', '1')

    // server snapshot selects the default (index 0) deterministically
    const html = renderToString(fixture())
    expect(html).toContain('content-a')
    container.innerHTML = html
    expect(selectedStates(container)).toEqual(['true', 'false'])

    // hydration produces no mismatch errors
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() =>
    {})
    act(() =>
    {
      root = hydrateRoot(container, fixture())
    })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()

    // stored index applies after hydration effects
    expect(selectedStates(container)).toEqual(['false', 'true'])
    expect(container.textContent).toContain('content-b')
  })
})
