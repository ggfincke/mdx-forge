// src/components/generic/CodeGroup.tsx
// provide tabbed code blocks w/o framework dependency

import React, { ReactElement, ReactNode, Children, isValidElement } from 'react'
import { CodeGroupProps } from './types'
import { cn } from '../internal/cn'
import { useIndexTabs } from '../base/useTabState'
import {
  TabScaffold,
  type TabScaffoldButton,
  type TabScaffoldPanel,
} from '../base/TabScaffold'

// extract label from code block element
function extractLabelFromCodeBlock(child: ReactElement): string
{
  const props = child.props as Record<string, unknown>

  // try various prop names used by different frameworks
  if (typeof props.title === 'string')
  {
    return props.title
  }
  if (typeof props.label === 'string')
  {
    return props.label
  }
  if (typeof props.filename === 'string')
  {
    return props.filename
  }
  // compiled fences expose their title="..." meta as data-title
  if (typeof props['data-title'] === 'string')
  {
    return props['data-title'] as string
  }
  if (typeof props.language === 'string')
  {
    return props.language
  }
  if (typeof props.lang === 'string')
  {
    return props.lang
  }

  // try to get from className (e.g., "language-javascript")
  if (typeof props.className === 'string')
  {
    const match = props.className.match(/language-(\w+)/)
    if (match)
    {
      return match[1]
    }
  }

  return 'Code'
}

// single code-block tab (label + rendered content)
interface CodeGroupTab
{
  label: string
  content: ReactNode
}

// render tabbed code blocks from children
export function CodeGroup({
  children,
  labels,
  className,
  ...props
}: CodeGroupProps): ReactElement
{
  const childArray = Children.toArray(children).filter(isValidElement)

  // extract tabs from children
  const tabs: CodeGroupTab[] = childArray.map((child, index) =>
  {
    const label =
      labels?.[index] || extractLabelFromCodeBlock(child as ReactElement)
    return { label, content: child }
  })

  // shared index-based tab state (matches base tabs factory)
  const { activeIndex, setActiveIndex } = useIndexTabs({ items: tabs })

  if (tabs.length === 0)
  {
    return (
      <div
        {...props}
        className={cn('mdx-preview-generic-code-group-empty', className)}
      >
        {children}
      </div>
    )
  }

  // if only one code block, just render it directly
  if (tabs.length === 1)
  {
    return (
      <div
        {...props}
        className={cn('mdx-preview-generic-code-group', className)}
      >
        {tabs[0].content}
      </div>
    )
  }

  const scaffoldButtons: TabScaffoldButton[] = tabs.map((tab, index) => ({
    key: index,
    content: tab.label,
    selected: index === activeIndex,
    className: cn(
      'mdx-preview-generic-code-group-button',
      index === activeIndex && 'active'
    ),
  }))
  const scaffoldPanels: TabScaffoldPanel[] = tabs.map((tab, index) => ({
    key: index,
    index,
    content: tab.content,
    className: cn(
      'mdx-preview-generic-code-group-panel',
      index === activeIndex && 'active'
    ),
    hidden: index !== activeIndex,
  }))

  return (
    <div {...props} className={cn('mdx-preview-generic-code-group', className)}>
      <TabScaffold
        buttons={scaffoldButtons}
        panels={scaffoldPanels}
        headerClassName="mdx-preview-generic-code-group-header"
        contentClassName="mdx-preview-generic-code-group-content"
        onSelect={setActiveIndex}
      />
    </div>
  )
}

export default CodeGroup
