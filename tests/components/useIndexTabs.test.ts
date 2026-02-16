// tests/components/useIndexTabs.test.ts
// index-based tab hook — Nextra-style tab state management

// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndexTabs } from '../../src/components/base/useTabState';

describe('useIndexTabs', () => {
  beforeEach(() => {
    localStorage.clear();
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

    expect(localStorage.getItem('nextra-tabs-test-tabs')).toBe('2');
  });

  it('restores from localStorage on init', () => {
    localStorage.setItem('nextra-tabs-test-tabs', '1');

    const { result } = renderHook(() =>
      useIndexTabs({
        items: ['A', 'B', 'C'],
        storageKey: 'test-tabs',
      })
    );

    expect(result.current.activeIndex).toBe(1);
  });

  it('ignores invalid localStorage value', () => {
    localStorage.setItem('nextra-tabs-test-tabs', 'garbage');

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
