// tests/components/useTabState.test.ts
// tab state hook — critical contract for all framework tabs implementations

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React, { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { useTabState, extractTabItems } from '../../src/components/base/useTabState';

// minimal TabItem-like component for test children
function TabItem(props: { value?: string; label?: string; default?: boolean; children: React.ReactNode }) {
  return createElement('div', null, props.children);
}

describe('extractTabItems()', () => {
  it('extracts value & label from children', () => {
    const children = [
      createElement(TabItem, { key: '1', value: 'tab1', label: 'Tab 1' }, 'Content 1'),
      createElement(TabItem, { key: '2', value: 'tab2', label: 'Tab 2' }, 'Content 2'),
    ];

    const items = extractTabItems(children);

    expect(items).toHaveLength(2);
    expect(items[0].value).toBe('tab1');
    expect(items[0].label).toBe('Tab 1');
    expect(items[1].value).toBe('tab2');
    expect(items[1].label).toBe('Tab 2');
  });

  it('uses label as value when value is not provided', () => {
    const children = [
      createElement(TabItem, { key: '1', label: 'First' }, 'Content'),
    ];

    const items = extractTabItems(children);

    expect(items[0].value).toBe('First');
    expect(items[0].label).toBe('First');
  });

  it('skips non-element children', () => {
    const children = [
      'plain text',
      null,
      createElement(TabItem, { key: '1', value: 'tab1' }, 'Content'),
    ];

    const items = extractTabItems(children);
    expect(items).toHaveLength(1);
  });
});

describe('useTabState()', () => {
  it('selects first tab by default', () => {
    const children = [
      createElement(TabItem, { key: '1', value: 'a', label: 'A' }, 'A'),
      createElement(TabItem, { key: '2', value: 'b', label: 'B' }, 'B'),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.activeValue).toBe('a');
    expect(result.current.tabs).toHaveLength(2);
  });

  it('respects explicit defaultValue prop', () => {
    const children = [
      createElement(TabItem, { key: '1', value: 'a' }, 'A'),
      createElement(TabItem, { key: '2', value: 'b' }, 'B'),
    ];

    const { result } = renderHook(() =>
      useTabState({ children, defaultValue: 'b' })
    );

    expect(result.current.activeValue).toBe('b');
  });

  it('respects default={true} on a child tab', () => {
    const children = [
      createElement(TabItem, { key: '1', value: 'a' }, 'A'),
      createElement(TabItem, { key: '2', value: 'b', default: true }, 'B'),
    ];

    const { result } = renderHook(() => useTabState({ children }));

    expect(result.current.activeValue).toBe('b');
  });

  it('uses provided values array over extracted children', () => {
    const children = [
      createElement(TabItem, { key: '1', value: 'a' }, 'A'),
    ];

    const customValues = [
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
    ];

    const { result } = renderHook(() =>
      useTabState({ children, values: customValues })
    );

    expect(result.current.tabs).toEqual(customValues);
    expect(result.current.activeValue).toBe('x');
  });
});
