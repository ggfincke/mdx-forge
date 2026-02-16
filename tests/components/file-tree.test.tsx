// tests/components/file-tree.test.tsx
// Starlight FileTree — recursive JSX parsing & rendering

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { FileTree } from '../../src/components/starlight/FileTree';

// helper: create <ul><li>...</li></ul> structure for FileTree children
function makeList(...items: React.ReactNode[]): React.ReactElement {
  return React.createElement(
    'ul',
    null,
    ...items
  );
}

function makeLi(...children: React.ReactNode[]): React.ReactElement {
  return React.createElement('li', null, ...children);
}

describe('Starlight FileTree', () => {
  it('renders a basic file entry', () => {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi('README.md'))
      )
    );
    expect(container.textContent).toContain('README.md');
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-file')
    ).toBeTruthy();
  });

  it('renders a directory entry (trailing slash)', () => {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi('src/'))
      )
    );
    expect(container.textContent).toContain('src');
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-directory')
    ).toBeTruthy();
  });

  it('renders nested structure (directory w/ children)', () => {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi(
            'src/',
            React.createElement(
              'ul',
              null,
              makeLi('index.ts'),
              makeLi('utils.ts')
            )
          )
        )
      )
    );
    expect(container.textContent).toContain('src');
    expect(container.textContent).toContain('index.ts');
    expect(container.textContent).toContain('utils.ts');
  });

  it('renders highlighted (bold) entries', () => {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi(React.createElement('strong', null, 'important.ts'))
        )
      )
    );
    expect(container.textContent).toContain('important.ts');
    expect(container.querySelector('.highlighted')).toBeTruthy();
  });

  it('renders placeholder (...) entries', () => {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi('...'))
      )
    );
    expect(
      container.querySelector(
        '.mdx-preview-starlight-file-tree-placeholder'
      )
    ).toBeTruthy();
  });

  it('renders comments after file name', () => {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi('config.json this is important'))
      )
    );
    expect(container.textContent).toContain('config.json');
    expect(container.querySelector('.comment')).toBeTruthy();
  });

  it('handles sibling pattern (<li>dir/</li> + <ul>...</ul>)', () => {
    // sibling pattern: <li>dir/</li> followed by <ul>children</ul>
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi('lib/'),
          React.createElement(
            'ul',
            null,
            makeLi('helper.ts')
          )
        )
      )
    );
    expect(container.textContent).toContain('lib');
    expect(container.textContent).toContain('helper.ts');
    // the directory should contain the child
    const dir = container.querySelector(
      '.mdx-preview-starlight-file-tree-directory'
    );
    expect(dir).toBeTruthy();
    expect(dir?.textContent).toContain('helper.ts');
  });
});
