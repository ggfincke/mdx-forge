// tests/components/framework-shims-smoke.test.tsx
// smoke test: all 4 framework shim packages render w/o errors

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';

// docusaurus
import {
  Tabs as DocuTabs,
  TabItem as DocuTabItem,
  CodeBlock as DocuCodeBlock,
  Details as DocuDetails,
} from '../../src/components/docusaurus/index';

// starlight
import {
  Card as StarlightCard,
  CardGrid as StarlightCardGrid,
  Badge as StarlightBadge,
  Aside as StarlightAside,
  Steps as StarlightSteps,
  Tabs as StarlightTabs,
  TabItem as StarlightTabItem,
} from '../../src/components/starlight/index';

// nextra
import {
  Callout as NextraCallout,
  Tabs as NextraTabs,
  Cards as NextraCards,
} from '../../src/components/nextra/index';

describe('Docusaurus shims [smoke]', () => {
  it('Tabs w/ TabItem renders', () => {
    const { container } = render(
      React.createElement(
        DocuTabs,
        null,
        React.createElement(
          DocuTabItem,
          { value: 'a', label: 'A' },
          'Content A'
        )
      )
    );
    expect(container.textContent).toContain('A');
  });

  it('CodeBlock renders & copies child whitespace exactly', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const { container } = render(
      React.createElement(
        DocuCodeBlock,
        { language: 'js', id: 'example-code' },
        '\n  const x = 1;\n'
      )
    );
    expect(container.textContent).toContain('const x = 1;');
    expect(container.querySelector('pre')?.id).toBe('example-code');

    fireEvent.click(container.querySelector('button')!);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('\n  const x = 1;\n');
    });
  });

  it('Details renders', () => {
    const { container } = render(
      React.createElement(
        DocuDetails,
        {
          summary: React.createElement('span', null, 'Click me'),
          id: 'docu-details',
        },
        'Hidden content'
      )
    );
    expect(container.textContent).toContain('Click me');
    expect(container.querySelector('details')?.id).toBe('docu-details');
  });
});

describe('Starlight shims [smoke]', () => {
  it('Card renders', () => {
    const { container } = render(
      React.createElement(
        StarlightCard,
        { title: 'Guide', id: 'starlight-card' },
        'Card body'
      )
    );
    expect(container.textContent).toContain('Guide');
    expect(container.querySelector('.mdx-preview-starlight-card')?.id).toBe(
      'starlight-card'
    );
  });

  it('CardGrid renders', () => {
    const { container } = render(
      React.createElement(
        StarlightCardGrid,
        { id: 'starlight-grid' },
        React.createElement(StarlightCard, { title: 'A' }, 'Content')
      )
    );
    expect(container.textContent).toContain('A');
    expect(
      container.querySelector('.mdx-preview-starlight-card-grid')?.id
    ).toBe('starlight-grid');
  });

  it('Badge renders', () => {
    const { container } = render(
      React.createElement(StarlightBadge, {
        text: 'New',
        id: 'starlight-badge',
      })
    );
    expect(container.textContent).toContain('New');
    expect(container.querySelector('span')?.id).toBe('starlight-badge');
  });

  it('Aside renders', () => {
    const { container } = render(
      React.createElement(
        StarlightAside,
        { type: 'tip', id: 'starlight-aside' },
        'Tip text'
      )
    );
    expect(container.textContent).toContain('Tip text');
    expect(container.querySelector('aside')?.id).toBe('starlight-aside');
  });

  it('Steps renders', () => {
    const { container } = render(
      React.createElement(
        StarlightSteps,
        { id: 'starlight-steps' },
        React.createElement(
          'ol',
          null,
          React.createElement('li', null, 'Step 1')
        )
      )
    );
    expect(container.textContent).toContain('Step 1');
    expect(container.querySelector('.mdx-preview-starlight-steps')?.id).toBe(
      'starlight-steps'
    );
  });

  it('Tabs w/ TabItem renders', () => {
    const { container } = render(
      React.createElement(
        StarlightTabs,
        null,
        React.createElement(StarlightTabItem, { label: 'Tab1' }, 'Tab content')
      )
    );
    expect(container.textContent).toContain('Tab1');
  });
});

describe('Nextra shims [smoke]', () => {
  it('Callout renders', () => {
    const { container } = render(
      React.createElement(NextraCallout, { type: 'info' }, 'Info text')
    );
    expect(container.textContent).toContain('Info text');
  });

  it('Tabs w/ compound Tab pattern renders', () => {
    const listClassName = vi.fn(
      ({ selectedIndex }: { selectedIndex: number }) =>
        `selected-${selectedIndex}`
    );
    const tabClassName = vi.fn(({ selected }: { selected: boolean }) =>
      selected ? 'selected-tab' : 'idle-tab'
    );
    const { container } = render(
      React.createElement(
        NextraTabs,
        {
          items: [
            React.createElement('strong', { key: 'first' }, 'First'),
            { label: 'Second', disabled: true },
          ],
          className: listClassName,
          tabClassName,
        },
        React.createElement(
          NextraTabs.Tab,
          {
            className: ({ selected }: { selected: boolean }) =>
              selected ? 'selected-panel' : 'idle-panel',
          },
          ({ selected }: { selected: boolean }) =>
            selected ? 'First selected' : 'First hidden'
        ),
        React.createElement(NextraTabs.Tab, null, 'Second content')
      )
    );
    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('First selected');
    expect(container.querySelector('strong')?.textContent).toBe('First');
    expect(
      container
        .querySelector('.mdx-preview-nextra-tabs')
        ?.classList.contains('selected-0')
    ).toBe(true);
    expect(
      container
        .querySelector('[role="tab"]')
        ?.classList.contains('selected-tab')
    ).toBe(true);
    expect(
      container
        .querySelector('[role="tabpanel"]')
        ?.classList.contains('selected-panel')
    ).toBe(true);
    expect(listClassName).toHaveBeenCalledWith({ selectedIndex: 0 });
    expect(tabClassName).toHaveBeenCalledWith(
      expect.objectContaining({ selected: true, disabled: false })
    );
    const tabs = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs[1]?.disabled).toBe(true);
    expect(tabs[1]?.getAttribute('aria-disabled')).toBe('true');
    expect(
      tabs[1]?.classList.contains('mdx-preview-nextra-tabs-button-disabled')
    ).toBe(true);
    expect(tabClassName).toHaveBeenCalledWith(
      expect.objectContaining({ selected: false, disabled: true })
    );
    fireEvent.click(tabs[1]!);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(container.textContent).not.toContain('Second content');
  });

  it('Cards.Card w/ external href sets target=_blank rel=noopener', () => {
    const { container } = render(
      React.createElement(
        NextraCards,
        null,
        React.createElement(NextraCards.Card, {
          title: 'External',
          href: 'https://example.com',
        })
      )
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('https://example.com');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
