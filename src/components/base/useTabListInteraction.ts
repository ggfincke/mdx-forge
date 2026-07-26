// src/components/base/useTabListInteraction.ts
// shared tab-list interaction: button refs, keyboard nav & ARIA id wiring

import { useCallback, useId, useRef, KeyboardEvent } from 'react'
import { resolveTabNavIndex } from './useTabState'

// options for useTabListInteraction hook
export interface TabListInteractionOptions
{
  count: number
  onSelect: (index: number) => void
  isDisabled?: (index: number) => boolean
}

// common props applied to every tab button
// aria-controls omitted when the panel is absent (lazy mode) to avoid dangling ids
export interface TabButtonBaseProps
{
  ref: (el: HTMLButtonElement | null) => void
  type: 'button'
  id: string
  role: 'tab'
  'aria-controls'?: string
  'aria-selected': boolean
  tabIndex: number
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
}

// result from useTabListInteraction hook
export interface TabListInteraction
{
  tabId: (index: number) => string
  panelId: (index: number) => string
  tabButtonProps: (
    index: number,
    selected: boolean,
    panelPresent?: boolean
  ) => TabButtonBaseProps
}

// hook for the interaction machinery shared by every tab implementation
// state models stay w/ each caller; selection flows through onSelect(index)
export function useTabListInteraction({
  count,
  onSelect,
  isDisabled,
}: TabListInteractionOptions): TabListInteraction
{
  // refs for tab buttons to enable focus management
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // reciprocal tab/panel ids for aria-controls & aria-labelledby
  const baseId = useId()
  const tabId = useCallback(
    (index: number) => `${baseId}-tab-${index}`,
    [baseId]
  )
  const panelId = useCallback(
    (index: number) => `${baseId}-panel-${index}`,
    [baseId]
  )

  // handle Arrow/Home/End keyboard navigation (disabled-aware)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) =>
    {
      const newIndex = resolveTabNavIndex(
        event.key,
        currentIndex,
        count,
        isDisabled
      )
      if (newIndex === undefined)
      {
        return
      }

      event.preventDefault()
      onSelect(newIndex)
      tabRefs.current[newIndex]?.focus()
    },
    [count, onSelect, isDisabled]
  )

  // shared button scaffolding: ref, ARIA wiring, roving tabindex & handlers
  // aria-controls only when the panel exists (lazy mode drops non-selected panels)
  const tabButtonProps = useCallback(
    (
      index: number,
      selected: boolean,
      panelPresent: boolean = true
    ): TabButtonBaseProps => ({
      ref: (el: HTMLButtonElement | null) =>
      {
        tabRefs.current[index] = el
      },
      type: 'button',
      id: tabId(index),
      role: 'tab',
      ...(panelPresent ? { 'aria-controls': panelId(index) } : {}),
      'aria-selected': selected,
      tabIndex: selected ? 0 : -1,
      onClick: () => onSelect(index),
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) =>
        handleKeyDown(event, index),
    }),
    [tabId, panelId, onSelect, handleKeyDown]
  )

  return { tabId, panelId, tabButtonProps }
}
