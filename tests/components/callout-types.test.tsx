// tests/components/callout-types.test.tsx
// callout component type rendering — verifies normalization integrates w/ render output

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Callout } from '../../src/components/generic/index';

describe('Callout type rendering', () => {
  it('renders known types w/ correct data attribute', () => {
    const types = ['note', 'warning', 'danger', 'tip'] as const;

    for (const type of types) {
      const { container } = render(
        React.createElement(Callout, { type }, `${type} content`)
      );

      const calloutEl = container.querySelector(`[data-callout-type="${type}"]`);
      expect(calloutEl).not.toBeNull();
    }
  });

  it('resolves alias types in rendered output', () => {
    // 'caution' & 'important' are standalone valid types
    // 'success' -> 'tip', 'error' -> 'danger', 'warn' -> 'warning', 'hint' -> 'tip'
    const aliases: [string, string][] = [
      ['success', 'tip'],
      ['error', 'danger'],
      ['warn', 'warning'],
      ['hint', 'tip'],
    ];

    for (const [alias, expected] of aliases) {
      const { container } = render(
        React.createElement(Callout, { type: alias as any }, 'Content')
      );

      const calloutEl = container.querySelector(`[data-callout-type="${expected}"]`);
      expect(calloutEl, `alias "${alias}" should resolve to "${expected}"`).not.toBeNull();
    }
  });

  it('displays custom title when provided', () => {
    const { container } = render(
      React.createElement(Callout, { type: 'note', title: 'Custom Title' }, 'Body')
    );

    expect(container.textContent).toContain('Custom Title');
  });

  it('displays default title when no custom title', () => {
    const { container } = render(
      React.createElement(Callout, { type: 'warning' }, 'Body')
    );

    expect(container.textContent).toContain('Warning');
  });

  it('defaults to note type when no type provided', () => {
    const { container } = render(
      React.createElement(Callout, null, 'Default callout')
    );

    const calloutEl = container.querySelector('[data-callout-type="note"]');
    expect(calloutEl).not.toBeNull();
  });
});
