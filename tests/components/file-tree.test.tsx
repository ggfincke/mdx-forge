// tests/components/file-tree.test.tsx
// starlight FileTree — recursive JSX parsing & rendering

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { FileTree } from '../../src/components/starlight/FileTree'

// helper: create <ul><li>...</li></ul> structure for FileTree children
function makeList(...items: React.ReactNode[]): React.ReactElement
{
  return React.createElement('ul', null, ...items)
}

function makeLi(...children: React.ReactNode[]): React.ReactElement
{
  return React.createElement('li', null, ...children)
}

describe('Starlight FileTree', () =>
{
  it('renders a basic file entry', () =>
  {
    const { container } = render(
      React.createElement(FileTree, null, makeList(makeLi('README.md')))
    )
    expect(container.textContent).toContain('README.md')
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-file')
    ).toBeTruthy()
  })

  it('renders a directory entry (trailing slash)', () =>
  {
    const { container } = render(
      React.createElement(FileTree, null, makeList(makeLi('src/')))
    )
    expect(container.textContent).toContain('src')
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-directory')
    ).toBeTruthy()
  })

  it('renders nested structure (directory w/ children)', () =>
  {
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
    )
    expect(container.textContent).toContain('src')
    expect(container.textContent).toContain('index.ts')
    expect(container.textContent).toContain('utils.ts')
  })

  it('renders highlighted (bold) entries', () =>
  {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi(React.createElement('strong', null, 'important.ts')))
      )
    )
    expect(container.textContent).toContain('important.ts')
    expect(container.querySelector('.highlighted')).toBeTruthy()
  })

  it('renders placeholder (...) entries', () =>
  {
    const { container } = render(
      React.createElement(FileTree, null, makeList(makeLi('...')))
    )
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-placeholder')
    ).toBeTruthy()
  })

  it('renders comments after file name', () =>
  {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi('config.json this is important'))
      )
    )
    expect(container.textContent).toContain('config.json')
    expect(container.querySelector('.comment')).toBeTruthy()
  })

  it('handles sibling pattern (<li>dir/</li> + <ul>...</ul>)', () =>
  {
    // sibling pattern: <li>dir/</li> followed by <ul>children</ul>
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi('lib/'),
          React.createElement('ul', null, makeLi('helper.ts'))
        )
      )
    )
    expect(container.textContent).toContain('lib')
    expect(container.textContent).toContain('helper.ts')
    // the directory should contain the child
    const dir = container.querySelector(
      '.mdx-preview-starlight-file-tree-directory'
    )
    expect(dir).toBeTruthy()
    expect(dir?.textContent).toContain('helper.ts')
  })

  // formatted first-node filenames & structural comments (F16)

  it('accepts a code-wrapped filename', () =>
  {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(makeLi(React.createElement('code', null, '__init__.py')))
      )
    )
    const name = container.querySelector('.name')
    expect(name?.textContent).toBe('__init__.py')
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-file')
    ).toBeTruthy()
  })

  it('keeps spaces inside a bold filename', () =>
  {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi(React.createElement('strong', null, 'READ ME FIRST.md'))
        )
      )
    )
    const name = container.querySelector('.name')
    expect(name?.textContent).toBe('READ ME FIRST.md')
    expect(container.querySelector('.highlighted')).toBeTruthy()
    expect(container.querySelector('.comment')).toBeNull()
  })

  it('keeps later bold text as comment content, never as the filename', () =>
  {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi(
            'Header.astro an ',
            React.createElement('strong', null, 'important'),
            ' file'
          )
        )
      )
    )
    const name = container.querySelector('.name')
    expect(name?.textContent).toBe('Header.astro')
    // entry is not highlighted; bold formatting survives inside the comment
    expect(container.querySelector('li.highlighted')).toBeNull()
    const comment = container.querySelector('.comment')
    expect(comment?.textContent).toBe('an important file')
    expect(comment?.querySelector('strong')?.textContent).toBe('important')
  })

  it('keeps comments on formatted filenames', () =>
  {
    const { container } = render(
      React.createElement(
        FileTree,
        null,
        makeList(
          makeLi(
            React.createElement('code', null, 'config.json'),
            ' this is important'
          )
        )
      )
    )
    expect(container.querySelector('.name')?.textContent).toBe('config.json')
    expect(container.querySelector('.comment')?.textContent).toContain(
      'this is important'
    )
  })

  it('nested directories & ellipsis still parse alongside formatted names', () =>
  {
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
              makeLi(React.createElement('code', null, 'main.rs')),
              makeLi('...')
            )
          )
        )
      )
    )
    const dir = container.querySelector(
      '.mdx-preview-starlight-file-tree-directory'
    )
    expect(dir?.textContent).toContain('main.rs')
    expect(
      container.querySelector('.mdx-preview-starlight-file-tree-placeholder')
    ).toBeTruthy()
  })
})
