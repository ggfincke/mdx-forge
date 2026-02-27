// tests/components/useIndexTabs.test.ts
// index-based tab hook — Nextra-style tab state management

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndexTabs } from '../../src/components/base/useTabState';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    key(index: number) {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('useIndexTabs', () => {
  const storage = createStorageMock();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
    });
    storage.clear();
  });

  it('defaults to first item (index 0)', () => {
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B', 'C'] })
    );
    expect(result.current.activeIndex).toBe(0);
  });

  it('respects explicit defaultIndex', () => {
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B', 'C'], defaultIndex: 2 })
    );
    expect(result.current.activeIndex).toBe(2);
  });

  it('controlledIndex overrides internal state', () => {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        defaultIndex: 0,
        controlledIndex: 1,
      })
    );
    expect(result.current.activeIndex).toBe(1);
  });

  it('skips disabled items', () => {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        isDisabled: (_item, index) => index === 1,
      })
    );

    act(() => {
      result.current.setActiveIndex(1);
    });

    // should remain at 0 since index 1 is disabled
    expect(result.current.activeIndex).toBe(0);
  });

  it('calls onChange callback', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useIndexTabs({ items: ['A', 'B', 'C'], onChange })
    );

    act(() => {
      result.current.setActiveIndex(2);
    });

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('persists to localStorage w/ storageKey', () => {
    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
      })
    );

    act(() => {
      result.current.setActiveIndex(2);
    });

    expect(storage.getItem('nextra-tabs-test-tabs')).toBe('2');
  });

  it('restores from localStorage on init', () => {
    storage.setItem('nextra-tabs-test-tabs', '1');

    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
      })
    );

    expect(result.current.activeIndex).toBe(1);
  });

  it('ignores invalid localStorage value', () => {
    storage.setItem('nextra-tabs-test-tabs', 'garbage');

    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
        defaultIndex: 0,
      })
    );

    expect(result.current.activeIndex).toBe(0);
  });
});
