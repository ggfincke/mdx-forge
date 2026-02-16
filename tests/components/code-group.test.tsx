// tests/components/code-group.test.tsx
// CodeGroup — label extraction fallback chain & tab rendering

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { CodeGroup } from '../../src/components/generic/CodeGroup';

// helper: create a mock code block child w/ given props
function codeBlock(props: Record<string, unknown> = {}): React.ReactElement {
  return React.createElement('pre', props, React.createElement('code', null, 'x'));
}

describe('CodeGroup', () => {
  describe('label extraction', () => {
    it('uses title prop as label', () => {
      const { container } = render(
        React.createElement(
          CodeGroup,
          null,
          codeBlock({ title: 'JavaScript' }),
          codeBlock({ title: 'Python' })
        )
      );
      const buttons = container.querySelectorAll('[role="tab"]');
      expect(buttons[0]?.textContent).toBe('JavaScript');
      expect(buttons[1]?.textContent).toBe('Python');
    });

    it('fallback chain: label -> filename -> language -> lang -> className -> Code', () => {
      const { container } = render(
        React.createElement(
          CodeGroup,
          null,
          codeBlock({ label: 'From Label' }),
          codeBlock({ filename: 'app.tsx' })
        )
      );
      const buttons = container.querySelectorAll('[role="tab"]');
      expect(buttons[0]?.textContent).toBe('From Label');
      expect(buttons[1]?.textContent).toBe('app.tsx');
    });

    it('extracts language from className pattern', () => {
      const { container } = render(
        React.createElement(
          CodeGroup,
          null,
          codeBlock({ className: 'language-rust' }),
          codeBlock({})
        )
      );
      const buttons = container.querySelectorAll('[role="tab"]');
      expect(buttons[0]?.textContent).toBe('rust');
      expect(buttons[1]?.textContent).toBe('Code');
    });
  });

  describe('rendering', () => {
    it('renders empty wrapper for 0 children', () => {
      const { container } = render(
        React.createElement(CodeGroup, null)
      );
      expect(
        container.querySelector('.mdx-preview-generic-code-group-empty')
      ).toBeTruthy();
    });

    it('renders 1 child directly w/o tabs', () => {
      const { container } = render(
        React.createElement(CodeGroup, null, codeBlock({ title: 'JS' }))
      );
      expect(container.querySelectorAll('[role="tab"]').length).toBe(0);
      expect(container.textContent).toContain('x');
    });

    it('labels prop overrides extracted labels', () => {
      const { container } = render(
        React.createElement(
          CodeGroup,
          { labels: ['Tab A', 'Tab B'] },
          codeBlock({ title: 'Original' }),
          codeBlock({ title: 'Other' })
        )
      );
      const buttons = container.querySelectorAll('[role="tab"]');
      expect(buttons[0]?.textContent).toBe('Tab A');
      expect(buttons[1]?.textContent).toBe('Tab B');
    });

    it('tab click switches visible panel', () => {
      const { container } = render(
        React.createElement(
          CodeGroup,
          null,
          codeBlock({ title: 'First' }),
          codeBlock({ title: 'Second' })
        )
      );
      const buttons = container.querySelectorAll('[role="tab"]');
      const panels = container.querySelectorAll('[role="tabpanel"]');

      // first panel visible initially
      expect(panels[0]?.getAttribute('hidden')).toBeNull();
      expect(panels[1]?.getAttribute('hidden')).toBe('');

      // click second tab
      fireEvent.click(buttons[1]!);

      // second panel visible
      expect(panels[0]?.getAttribute('hidden')).toBe('');
      expect(panels[1]?.getAttribute('hidden')).toBeNull();
    });
  });
});
