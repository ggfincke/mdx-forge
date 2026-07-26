// tests/compiler/collapsible-string-parity.test.tsx
// verify static string boolean parity between Safe Mode & React collapsibles

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Collapsible } from '../../src/components/generic/Collapsible';
import { compileSafe } from '../../src/compiler/index';
import type { CompilerConfig } from '../../src/compiler/index';

function createConfig(): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
  };
}

function reactOpen(props: Record<string, unknown>): boolean {
  const { container } = render(
    React.createElement(Collapsible, props as never, 'body')
  );
  return container.querySelector('details')!.hasAttribute('open');
}

async function safeOpen(attrs: string): Promise<boolean> {
  const result = await compileSafe(
    `<Collapsible ${attrs}>body</Collapsible>`,
    createConfig()
  );
  const doc = new DOMParser().parseFromString(result.html, 'text/html');
  return doc.querySelector('details')!.hasAttribute('open');
}

const CASES: Array<{
  name: string;
  attrs: string;
  props: Record<string, unknown>;
  open: boolean;
}> = [
  {
    name: 'open="true"',
    attrs: 'open="true"',
    props: { open: 'true' },
    open: true,
  },
  {
    name: 'open="false"',
    attrs: 'open="false"',
    props: { open: 'false' },
    open: true,
  },
  {
    name: 'open=""',
    attrs: 'open=""',
    props: { open: '' },
    open: false,
  },
  {
    name: 'defaultOpen="true"',
    attrs: 'defaultOpen="true"',
    props: { defaultOpen: 'true' },
    open: true,
  },
  {
    name: 'defaultOpen="false"',
    attrs: 'defaultOpen="false"',
    props: { defaultOpen: 'false' },
    open: true,
  },
  {
    name: 'defaultOpen=""',
    attrs: 'defaultOpen=""',
    props: { defaultOpen: '' },
    open: false,
  },
  {
    name: 'empty open wins over truthy defaultOpen',
    attrs: 'open="" defaultOpen="true"',
    props: { open: '', defaultOpen: 'true' },
    open: false,
  },
];

describe('Collapsible static string Safe/React parity', () => {
  for (const testCase of CASES) {
    it(testCase.name, async () => {
      expect(reactOpen(testCase.props)).toBe(testCase.open);
      expect(await safeOpen(testCase.attrs)).toBe(testCase.open);
    });
  }
});
