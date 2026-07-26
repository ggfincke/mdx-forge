// tests/components/form-a11y.test.tsx
// t5: shared controls never submit forms & tabs expose reciprocal ARIA (F14)

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import {
  Tabs as DocuTabs,
  TabItem as DocuTabItem,
} from '../../src/components/docusaurus/Tabs'
import { Tabs as NextraTabs } from '../../src/components/nextra/Tabs'
import { CodeGroup } from '../../src/components/generic/CodeGroup'
import { CopyButton } from '../../src/components/base/CopyButton'
import { __resetTabGroupSync } from '../../src/components/base/tabGroupSync'

beforeEach(() =>
{
  __resetTabGroupSync()
  window.localStorage.clear()
})

describe('form non-submission (F14)', () =>
{
  it('tab, code-group & copy buttons do not submit an enclosing form', () =>
  {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault())

    const { container } = render(
      <form onSubmit={onSubmit}>
        <DocuTabs>
          <DocuTabItem value="a" label="A">
            a
          </DocuTabItem>
          <DocuTabItem value="b" label="B">
            b
          </DocuTabItem>
        </DocuTabs>
        <CodeGroup>
          <pre title="One">
            <code>1</code>
          </pre>
          <pre title="Two">
            <code>2</code>
          </pre>
        </CodeGroup>
        <CopyButton text="copy me" />
      </form>
    )

    for (const button of Array.from(container.querySelectorAll('button')))
    {
      expect(button.getAttribute('type')).toBe('button')
      fireEvent.click(button)
    }

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('reciprocal ARIA relationships (F14)', () =>
{
  it('value tabs link tabs & panels w/ unique ids across multiple groups', () =>
  {
    const { container } = render(
      <div>
        <DocuTabs>
          <DocuTabItem value="a" label="A">
            a
          </DocuTabItem>
          <DocuTabItem value="b" label="B">
            b
          </DocuTabItem>
        </DocuTabs>
        <DocuTabs>
          <DocuTabItem value="a" label="A">
            a2
          </DocuTabItem>
          <DocuTabItem value="b" label="B">
            b2
          </DocuTabItem>
        </DocuTabs>
      </div>
    )

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'))
    const panels = Array.from(container.querySelectorAll('[role="tabpanel"]'))
    expect(tabs.length).toBe(4)
    expect(panels.length).toBe(4)

    const ids = [...tabs, ...panels].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id) => expect(id).not.toBe(''))

    for (const tab of tabs)
    {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!)
      expect(panel).not.toBeNull()
      expect(panel?.getAttribute('role')).toBe('tabpanel')
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id)
    }
  })

  it('index tabs & code groups link tabs & panels reciprocally', () =>
  {
    const { container } = render(
      <div>
        <NextraTabs items={['X', 'Y']}>
          <NextraTabs.Tab>x</NextraTabs.Tab>
          <NextraTabs.Tab>y</NextraTabs.Tab>
        </NextraTabs>
        <CodeGroup>
          <pre title="One">
            <code>1</code>
          </pre>
          <pre title="Two">
            <code>2</code>
          </pre>
        </CodeGroup>
      </div>
    )

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'))
    expect(tabs.length).toBe(4)

    for (const tab of tabs)
    {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!)
      expect(panel).not.toBeNull()
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id)
    }
  })
})
