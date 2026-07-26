// tests/components/nextra-components.test.tsx
// T5: Nextra FileTree/Steps/Bleed implement their advertised APIs (F15)

// @vitest-environment jsdom

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { FileTree } from '../../src/components/nextra/FileTree';
import { Steps } from '../../src/components/nextra/Steps';
import { Bleed } from '../../src/components/nextra/Bleed';
import { Callout } from '../../src/components/nextra/Callout';

describe('Nextra FileTree compound statics (F15)', () => {
  it('renders the canonical registry example as a real tree', () => {
    // mirrors component-metadata example for nextra:FileTree
    const { container } = render(
      <FileTree id="project-tree" className="custom-tree" data-scope="project">
        <FileTree.Folder name="src" defaultOpen>
          <FileTree.File name="index.ts" />
        </FileTree.Folder>
      </FileTree>
    );

    expect(container.textContent).toContain('src');
    expect(container.textContent).toContain('index.ts');

    const details = container.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(true);
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-directory')
    ).toBeTruthy();
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-file')
    ).toBeTruthy();
    const tree = container.querySelector('ul#project-tree');
    expect(tree?.classList.contains('custom-tree')).toBe(true);
    expect(tree?.getAttribute('data-scope')).toBe('project');
    const nextraWrapper = container.firstElementChild;
    const sharedTree = nextraWrapper?.firstElementChild;
    expect(nextraWrapper?.className).toBe('mdx-preview-nextra-file-tree');
    expect(sharedTree?.className).toBe('mdx-preview-starlight-file-tree');
    expect(sharedTree?.firstElementChild).toBe(tree);
    expect(tree?.querySelector(':scope > li')?.className).toBe(
      'mdx-preview-starlight-file-tree-directory'
    );
    expect(
      details?.querySelector(':scope > summary')?.hasAttribute('class')
    ).toBe(false);
    expect(details?.querySelector(':scope > ul > li')?.className).toBe(
      'mdx-preview-starlight-file-tree-file'
    );
  });

  it('folders are collapsed unless defaultOpen is set', () => {
    const { container } = render(
      <FileTree>
        <FileTree.Folder name="closed">
          <FileTree.File name="hidden.ts" />
        </FileTree.Folder>
      </FileTree>
    );

    expect(container.querySelector('details')?.hasAttribute('open')).toBe(
      false
    );
  });

  it('still renders plain ul/li children via the list parser', () => {
    const { container } = render(
      <FileTree>
        <ul>
          <li>README.md</li>
        </ul>
      </FileTree>
    );

    expect(container.textContent).toContain('README.md');
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-file')
    ).toBeTruthy();
    const nextraWrapper = container.firstElementChild;
    const sharedTree = nextraWrapper?.firstElementChild;
    const outputList = sharedTree?.firstElementChild;
    expect(nextraWrapper?.className).toBe('mdx-preview-nextra-file-tree');
    expect(sharedTree?.className).toBe('mdx-preview-starlight-file-tree');
    expect(outputList?.tagName).toBe('UL');
    expect(outputList?.children).toHaveLength(1);
    expect(outputList?.firstElementChild?.className).toBe(
      'mdx-preview-starlight-file-tree-file'
    );
    expect(outputList?.querySelectorAll('ul')).toHaveLength(0);
  });
});

describe('Nextra Callout unstyled mode', () => {
  it('keeps type=null free of variant styling & default icons', () => {
    const { container } = render(
      <Callout type={null}>Unstyled content</Callout>
    );
    const callout = container.querySelector('.mdx-preview-nextra-callout');

    expect(callout?.className).toBe('mdx-preview-nextra-callout');
    expect(
      callout?.querySelector('.mdx-preview-nextra-callout-icon')
    ).toBeNull();
    expect(callout?.textContent).toContain('Unstyled content');
  });
});

describe('Nextra Steps (F15)', () => {
  it('wraps heading-delimited content in the steps rail', () => {
    const { container } = render(
      <Steps>
        <h3>Step 1</h3>
        <p>Do this</p>
        <h3>Step 2</h3>
        <p>Do that</p>
      </Steps>
    );

    const wrapper = container.querySelector('.mdx-preview-nextra-steps');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.querySelectorAll('h3').length).toBe(2);
    expect(wrapper?.textContent).toContain('Do this');
  });

  it('forwards className & div attributes', () => {
    const { container } = render(
      <Steps className="extra" id="steps-1">
        <h3>Only</h3>
      </Steps>
    );

    const wrapper = container.querySelector('.mdx-preview-nextra-steps');
    expect(wrapper?.classList.contains('extra')).toBe(true);
    expect(wrapper?.id).toBe('steps-1');
  });
});

describe('Nextra Bleed (F15)', () => {
  it('applies the full layout class w/o leaking the prop to the DOM', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<Bleed full>Full-bleed content</Bleed>);

    const bleed = container.querySelector('.mdx-preview-nextra-bleed');
    expect(bleed).toBeTruthy();
    expect(bleed?.classList.contains('mdx-preview-nextra-bleed-full')).toBe(
      true
    );
    // no DOM leakage of the boolean prop & no React attribute warning
    expect(container.querySelector('[full]')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('omits the full class by default', () => {
    const { container } = render(<Bleed>Plain bleed</Bleed>);

    const bleed = container.querySelector('.mdx-preview-nextra-bleed');
    expect(bleed?.classList.contains('mdx-preview-nextra-bleed-full')).toBe(
      false
    );
  });
});
