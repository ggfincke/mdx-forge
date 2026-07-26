// tests/components/link-card.test.tsx
// T5: LinkCard preserves navigation & forwards anchor props (F18)

// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { LinkCard } from '../../src/components/starlight/LinkCard';

function anchorFor(element: React.ReactElement): HTMLAnchorElement {
  const { container } = render(element);
  const anchor = container.querySelector('a');
  if (!anchor) {
    throw new Error('anchor not rendered');
  }
  return anchor;
}

describe('Starlight LinkCard (F18)', () => {
  it('internal links navigate in the same tab w/o rel', () => {
    const anchor = anchorFor(<LinkCard title="Docs" href="/docs" />);

    expect(anchor.getAttribute('href')).toBe('/docs');
    expect(anchor.getAttribute('target')).toBeNull();
    expect(anchor.getAttribute('rel')).toBeNull();
  });

  it('external links open a new tab w/ safe rel', () => {
    const anchor = anchorFor(
      <LinkCard title="Site" href="https://example.com" />
    );

    expect(anchor.getAttribute('target')).toBe('_blank');
    const rel = anchor.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('treats non-HTTP URL schemes as external', () => {
    const anchor = anchorFor(
      <LinkCard title="Email" href="mailto:docs@example.com" />
    );

    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('explicit target wins & rel stays untouched w/o _blank', () => {
    const anchor = anchorFor(
      <LinkCard title="Site" href="https://example.com" target="_self" />
    );

    expect(anchor.getAttribute('target')).toBe('_self');
    expect(anchor.getAttribute('rel')).toBeNull();
  });

  it('explicit _blank on internal links applies safe rel & merges tokens', () => {
    const anchor = anchorFor(
      <LinkCard title="Docs" href="/docs" target="_blank" rel="external" />
    );

    expect(anchor.getAttribute('target')).toBe('_blank');
    const rel = anchor.getAttribute('rel') ?? '';
    expect(rel).toContain('external');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('forwards native anchor props (aria-label, download, id)', () => {
    const anchor = anchorFor(
      <LinkCard
        title="Report"
        href="/report.pdf"
        aria-label="Download report"
        download
        id="report-card"
      />
    );

    expect(anchor.getAttribute('aria-label')).toBe('Download report');
    expect(anchor.hasAttribute('download')).toBe(true);
    expect(anchor.id).toBe('report-card');
  });

  it('renders title & description content', () => {
    const { container } = render(
      <LinkCard title="Docs" href="/docs" description="Get started" />
    );

    expect(container.textContent).toContain('Docs');
    expect(container.textContent).toContain('Get started');
  });
});
