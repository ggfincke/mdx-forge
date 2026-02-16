// tests/components/nextjs-shims.test.tsx
// Next.js Link & Image shim behavior

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { Link, Image } from '../../src/components/nextjs/index';

describe('Next.js Link shim', () => {
  it('renders string href directly', () => {
    const { container } = render(
      React.createElement(Link, { href: '/about' }, 'About')
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/about');
    expect(anchor?.textContent).toBe('About');
  });

  it('resolves object href w/ pathname, query, & hash', () => {
    const { container } = render(
      React.createElement(
        Link,
        {
          href: {
            pathname: '/search',
            query: { q: 'hello', page: '2' },
            hash: '#results',
          },
        },
        'Search'
      )
    );
    const anchor = container.querySelector('a');
    const href = anchor?.getAttribute('href') ?? '';
    expect(href).toContain('/search');
    expect(href).toContain('q=hello');
    expect(href).toContain('page=2');
    expect(href).toContain('#results');
  });

  it('sets target=_blank for external https links', () => {
    const { container } = render(
      React.createElement(
        Link,
        { href: 'https://example.com' },
        'External'
      )
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('target')).toBe('_blank');
    expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not set target=_blank for internal links', () => {
    const { container } = render(
      React.createElement(Link, { href: '/internal' }, 'Internal')
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('target')).toBeNull();
  });

  it('sets target=_blank for protocol-relative links', () => {
    const { container } = render(
      React.createElement(
        Link,
        { href: '//cdn.example.com/file' },
        'CDN'
      )
    );
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('target')).toBe('_blank');
  });
});

describe('Next.js Image shim', () => {
  it('renders string src directly', () => {
    const { container } = render(
      React.createElement(Image, {
        src: '/photo.jpg',
        alt: 'Photo',
        width: 200,
        height: 100,
      })
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/photo.jpg');
    expect(img?.getAttribute('alt')).toBe('Photo');
  });

  it('extracts dimensions from object src', () => {
    const { container } = render(
      React.createElement(Image, {
        src: { src: '/photo.jpg', width: 800, height: 600 },
        alt: 'Photo',
      })
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/photo.jpg');
    expect(img?.getAttribute('width')).toBe('800');
    expect(img?.getAttribute('height')).toBe('600');
  });

  it('fill mode sets absolute positioning & omits dimensions', () => {
    const { container } = render(
      React.createElement(Image, {
        src: '/photo.jpg',
        alt: 'Photo',
        fill: true,
        width: 200,
        height: 100,
      })
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('width')).toBeNull();
    expect(img?.getAttribute('height')).toBeNull();
    expect(img?.style.position).toBe('absolute');
  });

  it('priority sets loading=eager', () => {
    const { container } = render(
      React.createElement(Image, {
        src: '/photo.jpg',
        alt: 'Photo',
        priority: true,
      })
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('eager');
  });

  it('defaults to loading=lazy', () => {
    const { container } = render(
      React.createElement(Image, {
        src: '/photo.jpg',
        alt: 'Photo',
      })
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });
});
