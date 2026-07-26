// tests/components/useIndexTabs.test.ts
// index-based tab hook — Nextra-style tab state management

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIndexTabs } from '../../src/components/base/useTabState'

function createStorageMock(): Storage
{
  const store = new Map<string, string>()

  return {
    get length()
    {
      return store.size
    },
    clear()
    {
      store.clear()
    },
    getItem(key: string)
    {
      return store.has(key) ? (store.get(key) ?? null) : null
    },
    key(index: number)
    {
      const keys = Array.from(store.keys())
      return keys[index] ?? null
    },
    removeItem(key: string)
    {
      store.delete(key)
    },
    setItem(key: string, value: string)
    {
      store.set(key, String(value))
    },
  }
}

describe('useIndexTabs', () =>
{
  const storage = createStorageMock()

  beforeEach(() =>
  {
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    })
    storage.clear()
  })

  it('defaults to first item (index 0)', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B', 'C'] })
    )
    expect(result.current.activeIndex).toBe(0)
  })

  it('respects explicit defaultIndex', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B', 'C'], defaultIndex: 2 })
    )
    expect(result.current.activeIndex).toBe(2)
  })

  it('controlledIndex overrides internal state', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        defaultIndex: 0,
        controlledIndex: 1,
      })
    )
    expect(result.current.activeIndex).toBe(1)
  })

  it('skips disabled items', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        isDisabled: (item) => item === 'B',
      })
    )

    act(() =>
    {
      result.current.setActiveIndex(1)
    })

    // should remain at 0 since index 1 is disabled
    expect(result.current.activeIndex).toBe(0)
  })

  it('calls onChange callback', () =>
  {
    const onChange = vi.fn()
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B', 'C'], onChange })
    )

    act(() =>
    {
      result.current.setActiveIndex(2)
    })

    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('persists to localStorage w/ storageKey', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
      })
    )

    act(() =>
    {
      result.current.setActiveIndex(2)
    })

    expect(storage.getItem('nextra-tabs-test-tabs')).toBe('2')
  })

  it('restores from localStorage on init', () =>
  {
    storage.setItem('nextra-tabs-test-tabs', '1')

    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
      })
    )

    expect(result.current.activeIndex).toBe(1)
  })

  it('restores again when the storage key changes', () =>
  {
    storage.setItem('nextra-tabs-first', '1')
    storage.setItem('nextra-tabs-second', '2')
    const { result, rerender } = renderHook(
      ({ storageKey }: { storageKey: string }) =>
        useIndexTabs({
          items: ['A', 'B', 'C'],
          storageKey,
        }),
      { initialProps: { storageKey: 'first' } }
    )

    expect(result.current.activeIndex).toBe(1)
    rerender({ storageKey: 'second' })
    expect(result.current.activeIndex).toBe(2)
  })

  it('retries a stored index when the item set changes', () =>
  {
    storage.setItem('nextra-tabs-test-tabs', '2')
    const { result, rerender } = renderHook(
      ({ items }: { items: string[] }) =>
        useIndexTabs({ items, storageKey: 'test-tabs' }),
      { initialProps: { items: ['A', 'B'] } }
    )

    expect(result.current.activeIndex).toBe(0)
    rerender({ items: ['A', 'B', 'C'] })
    expect(result.current.activeIndex).toBe(2)
  })

  it('ignores invalid localStorage value', () =>
  {
    storage.setItem('nextra-tabs-test-tabs', 'garbage')

    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
        defaultIndex: 0,
      })
    )

    expect(result.current.activeIndex).toBe(0)
  })

  // impossible-state normalization (F13) — distinct entry points only

  it('normalizes an out-of-range defaultIndex to the first enabled item', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B'], defaultIndex: 9 })
    )
    expect(result.current.activeIndex).toBe(0)
  })

  it('normalizes a stored index that exceeds the shrunken item list', () =>
  {
    storage.setItem('nextra-tabs-test-tabs', '4')

    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B'], storageKey: 'test-tabs' })
    )

    expect(result.current.activeIndex).toBe(0)
  })

  it('skips a disabled default & lands on the first enabled item', () =>
  {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        defaultIndex: 0,
        isDisabled: (item) => item === 'A',
      })
    )
    expect(result.current.activeIndex).toBe(1)
  })

  it('returns 0 for an empty item list', () =>
  {
    const { result } = renderHook(() => useIndexTabs({ items: [] }))
    expect(result.current.activeIndex).toBe(0)
  })

  it('survives storage read & write errors', () =>
  {
    const throwingStorage = {
      ...storage,
      getItem()
      {
        throw new Error('blocked')
      },
      setItem()
      {
        throw new Error('blocked')
      },
    }
    Object.defineProperty(window, 'localStorage', {
      value: throwingStorage,
      configurable: true,
    })

    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B'], storageKey: 'test-tabs' })
    )
    expect(result.current.activeIndex).toBe(0)

    act(() =>
    {
      result.current.setActiveIndex(1)
    })
    expect(result.current.activeIndex).toBe(1)
  })
})
