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
  CodeGroup,
  Collapsible,
  Accordion,
} from '../../src/components/generic/index';

describe('generic components [smoke]', () => {
  it('Callout renders w/ children', () => {
    const { container } = render(
      React.createElement(Callout, null, 'Hello')
    );
    expect(container.textContent).toContain('Hello');
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
        null,
        React.createElement(TabItem, { value: 'a', label: 'A' }, 'Content A'),
        React.createElement(TabItem, { value: 'b', label: 'B' }, 'Content B')
      )
    );
    expect(container.textContent).toContain('A');
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

  it('CodeGroup renders w/ code block children', () => {
    const { container } = render(
      React.createElement(
        CodeGroup,
        null,
        React.createElement('pre', { title: 'JavaScript' },
          React.createElement('code', null, 'const x = 1;')
        ),
        React.createElement('pre', { title: 'Python' },
          React.createElement('code', null, 'x = 1')
        )
      )
    );
    expect(container.textContent).toContain('const x = 1;');
  });

  it('Collapsible renders w/ title & children', () => {
    const { container } = render(
      React.createElement(Collapsible, { title: 'Details' }, 'Hidden content')
    );
    expect(container.textContent).toContain('Details');
  });

  it('Accordion alias renders (same as Collapsible)', () => {
    const { container } = render(
      React.createElement(Accordion, { title: 'More info' }, 'Extra content')
    );
    expect(container.textContent).toContain('More info');
  });
});
