// tests/components/generic-smoke.test.tsx
// smoke test: all generic components render w/o errors

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  Callout,
  Alert,
  Admonition,
  Tabs,
  TabItem,
  Tab,
  Accordion,
} from '../../src/components/generic/index';

describe('generic components [smoke]', () => {
  it('Callout renders w/ children', () => {
    const { container } = render(
      React.createElement(
        Callout,
        { id: 'generic-callout', 'data-probe': 'callout' },
        'Hello'
      )
    );
    expect(container.textContent).toContain('Hello');
    expect(container.querySelector('aside')?.id).toBe('generic-callout');
  });

  it('Alert alias renders (same as Callout)', () => {
    const { container } = render(
      React.createElement(Alert, { type: 'warning' }, 'Warning text')
    );
    expect(container.textContent).toContain('Warning text');
  });

  it('Admonition alias renders (same as Callout)', () => {
    const { container } = render(
      React.createElement(Admonition, { type: 'tip' }, 'Tip text')
    );
    expect(container.textContent).toContain('Tip text');
  });

  it('Tabs w/ TabItem children renders', () => {
    const { container } = render(
      React.createElement(
        Tabs,
        { id: 'generic-tabs' },
        React.createElement(
          TabItem,
          { value: 'a', label: 'A', 'data-panel': 'first' },
          'Content A'
        ),
        React.createElement(TabItem, { value: 'b', label: 'B' }, 'Content B')
      )
    );
    expect(container.textContent).toContain('A');
    expect(container.querySelector('[data-component="tabs"]')?.id).toBe(
      'generic-tabs'
    );
    expect(
      container.querySelector('[role="tabpanel"]')?.getAttribute('data-panel')
    ).toBe('first');
  });

  it('Tab alias renders (same as TabItem)', () => {
    const { container } = render(
      React.createElement(
        Tabs,
        null,
        React.createElement(Tab, { value: 'x', label: 'X' }, 'X content')
      )
    );
    expect(container.textContent).toContain('X');
  });

  it('Accordion alias renders (same as Collapsible)', () => {
    const { container } = render(
      React.createElement(Accordion, { title: 'More info' }, 'Extra content')
    );
    expect(container.textContent).toContain('More info');
  });
});
