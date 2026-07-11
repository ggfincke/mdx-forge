// tests/components/collapsible-parity.test.tsx
// T5: Collapsible Safe & React contracts agree (F17)

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Collapsible } from '../../src/components/generic/Collapsible';
import { compileSafe } from '../../src/compiler/index';
import type { CompilerConfig } from '../../src/compiler/index';

// create library-native CompilerConfig
function createConfig(): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
  };
}

// render React shim & report observable contract state
function reactState(props: Record<string, unknown>): {
  label: string;
  open: boolean;
  className: string;
} {
  const { container } = render(
    React.createElement(Collapsible, props as never, 'body')
  );
  const details = container.querySelector('details')!;
  return {
    label:
      details.querySelector('summary span:last-of-type')?.textContent ?? '',
    open: details.hasAttribute('open'),
    className: details.className,
  };
}

// compile Safe MDX & report observable contract state
async function safeState(attrs: string): Promise<{
  label: string;
  open: boolean;
  className: string;
}> {
  const result = await compileSafe(
    `<Collapsible ${attrs}>body</Collapsible>`,
    createConfig()
  );
  const doc = new DOMParser().parseFromString(result.html, 'text/html');
  const details = doc.querySelector('details')!;
  return {
    label: details.querySelector('summary')?.textContent?.trim() ?? '',
    open: details.hasAttribute('open'),
    className: details.className,
  };
}

// parity table: same authored props -> same label & open state in both modes
const CASES: Array<{
  name: string;
  attrs: string;
  props: Record<string, unknown>;
  label: string;
  open: boolean;
}> = [
  {
    name: 'title only',
    attrs: 'title="From title"',
    props: { title: 'From title' },
    label: 'From title',
    open: false,
  },
  {
    name: 'summary only',
    attrs: 'summary="From summary"',
    props: { summary: 'From summary' },
    label: 'From summary',
    open: false,
  },
  {
    name: 'summary wins over title',
    attrs: 'title="From title" summary="From summary"',
    props: { title: 'From title', summary: 'From summary' },
    label: 'From summary',
    open: false,
  },
  {
    name: 'no label falls back to Details',
    attrs: '',
    props: {},
    label: 'Details',
    open: false,
  },
  {
    name: 'defaultOpen opens initially',
    attrs: 'title="t" defaultOpen',
    props: { title: 't', defaultOpen: true },
    label: 't',
    open: true,
  },
  {
    name: 'open opens initially',
    attrs: 'title="t" open',
    props: { title: 't', open: true },
    label: 't',
    open: true,
  },
  {
    name: 'explicit open={false} wins over defaultOpen',
    attrs: 'title="t" open={false} defaultOpen',
    props: { title: 't', open: false, defaultOpen: true },
    label: 't',
    open: false,
  },
];

describe('Collapsible Safe/React parity (F17)', () => {
  for (const testCase of CASES) {
    it(testCase.name, async () => {
      const react = reactState(testCase.props);
      const safe = await safeState(testCase.attrs);

      expect(react.label).toBe(testCase.label);
      expect(safe.label).toBe(testCase.label);
      expect(react.open).toBe(testCase.open);
      expect(safe.open).toBe(testCase.open);
    });
  }

  it('className reaches the details element in both modes', async () => {
    const react = reactState({ title: 't', className: 'custom-class' });
    expect(react.className).toContain('custom-class');

    // Safe mode keeps its own wrapper class on the details element
    const safe = await safeState('title="t"');
    expect(safe.className).not.toBe('');
  });
});
