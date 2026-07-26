// src/components/base/TabScaffold.tsx
// render shared tab headers & panels around caller-owned state

import React, {
  type HTMLAttributes,
  type Key,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useTabListInteraction } from './useTabListInteraction'

export interface TabScaffoldButton
{
  key: Key
  content: ReactNode
  selected: boolean
  className: string
  disabled?: boolean
  panelPresent?: boolean
}

export interface TabScaffoldPanel
{
  key: Key
  index: number
  content: ReactNode
  className: string
  hidden: boolean
  props?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className'>
}

export interface TabScaffoldProps
{
  buttons: TabScaffoldButton[]
  panels: TabScaffoldPanel[]
  headerClassName: string
  contentClassName: string
  onSelect: (index: number) => void
  isDisabled?: (index: number) => boolean
}

export function TabScaffold({
  buttons,
  panels,
  headerClassName,
  contentClassName,
  onSelect,
  isDisabled,
}: TabScaffoldProps): ReactElement
{
  const { tabId, panelId, tabButtonProps } = useTabListInteraction({
    count: buttons.length,
    onSelect,
    isDisabled,
  })

  return (
    <>
      <div className={headerClassName} role="tablist">
        {buttons.map((button, index) => (
          <button
            key={button.key}
            {...tabButtonProps(
              index,
              button.selected,
              button.panelPresent ?? true
            )}
            aria-disabled={button.disabled}
            className={button.className}
            disabled={button.disabled}
          >
            {button.content}
          </button>
        ))}
      </div>
      <div className={contentClassName}>
        {panels.map((panel) => (
          <div
            {...panel.props}
            key={panel.key}
            id={panel.index >= 0 ? panelId(panel.index) : undefined}
            role="tabpanel"
            aria-labelledby={panel.index >= 0 ? tabId(panel.index) : undefined}
            className={panel.className}
            hidden={panel.hidden}
          >
            {panel.content}
          </div>
        ))}
      </div>
    </>
  )
}
