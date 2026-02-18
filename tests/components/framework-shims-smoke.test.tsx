// tests/components/framework-shims-smoke.test.tsx
// smoke test: all 4 framework shim packages render w/o errors

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

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
  FileTree as StarlightFileTree,
} from '../../src/components/starlight/index';

// nextra
import {
  Callout as NextraCallout,
  Tabs as NextraTabs,
  Steps as NextraSteps,
  Bleed as NextraBleed,
} from '../../src/components/nextra/index';

// nextjs
import {
  Image as NextImage,
  Link as NextLink,
} from '../../src/components/nextjs/index';

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

  it('CodeBlock renders', () => {
    const { container } = render(
      React.createElement(DocuCodeBlock, { language: 'js' }, 'const x = 1;')
    );
    expect(container.textContent).toContain('const x = 1;');
  });

  it('Details renders', () => {
    const { container } = render(
      React.createElement(
        DocuDetails,
        { summary: React.createElement('span', null, 'Click me') },
        'Hidden content'
      )
    );
    expect(container.textContent).toContain('Click me');
  });
});

describe('Starlight shims [smoke]', () => {
  it('Card renders', () => {
    const { container } = render(
      React.createElement(StarlightCard, { title: 'Guide' }, 'Card body')
    );
    expect(container.textContent).toContain('Guide');
  });

  it('CardGrid renders', () => {
    const { container } = render(
      React.createElement(
        StarlightCardGrid,
        null,
        React.createElement(StarlightCard, { title: 'A' }, 'Content')
      )
    );
    expect(container.textContent).toContain('A');
  });

  it('Badge renders', () => {
    const { container } = render(
      React.createElement(StarlightBadge, { text: 'New' })
    );
    expect(container.textContent).toContain('New');
  });

  it('Aside renders', () => {
    const { container } = render(
      React.createElement(StarlightAside, { type: 'tip' }, 'Tip text')
    );
    expect(container.textContent).toContain('Tip text');
  });

  it('Steps renders', () => {
    const { container } = render(
      React.createElement(
        StarlightSteps,
        null,
        React.createElement('ol', null, React.createElement('li', null, 'Step 1'))
      )
    );
    expect(container.textContent).toContain('Step 1');
  });

  it('Tabs w/ TabItem renders', () => {
    const { container } = render(
      React.createElement(
        StarlightTabs,
        null,
        React.createElement(
          StarlightTabItem,
          { label: 'Tab1' },
          'Tab content'
        )
      )
    );
    expect(container.textContent).toContain('Tab1');
  });

  it('FileTree renders', () => {
    const { container } = render(
      React.createElement(
        StarlightFileTree,
        null,
        React.createElement(
          'ul',
          null,
          React.createElement('li', null, 'README.md')
        )
      )
    );
    expect(container.textContent).toContain('README.md');
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
    const { container } = render(
      React.createElement(
        NextraTabs,
        { items: ['First', 'Second'] },
        React.createElement(NextraTabs.Tab, null, 'First content'),
        React.createElement(NextraTabs.Tab, null, 'Second content')
      )
    );
    expect(container.textContent).toContain('First');
  });

  it('Steps renders', () => {
    const { container } = render(
      React.createElement(
        NextraSteps,
        null,
        React.createElement('p', null, 'Step one')
      )
    );
    expect(container.textContent).toContain('Step one');
  });

  it('Bleed renders', () => {
    const { container } = render(
      React.createElement(NextraBleed, null, 'Bleed content')
    );
    expect(container.textContent).toContain('Bleed content');
  });
});

describe('Next.js shims [smoke]', () => {
  it('Image renders', () => {
    const { container } = render(
      React.createElement(NextImage, {
        src: '/logo.png',
        alt: 'Logo',
      })
    );
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('/logo.png');
  });

  it('Link renders', () => {
    const { container } = render(
      React.createElement(NextLink, { href: '/docs' }, 'Docs')
    );
    const anchor = container.querySelector('a');
    expect(anchor).toBeTruthy();
    expect(anchor?.textContent).toBe('Docs');
  });
});
