// src/components/starlight/LinkCard.tsx
// Starlight LinkCard component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components LinkCard

import React, { ReactElement, AnchorHTMLAttributes } from 'react';
import { cn } from '../internal/cn';
import { ArrowIcon } from '../base/icons';

// linkCard props derive from native anchor attributes (all forwarded)
export interface LinkCardProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  title: string;
  description?: string;
  href: string;
}

// external URLs (scheme or protocol-relative) open a new tab by default
function isExternalHref(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

// append safe rel tokens only when a blank target is actually used
function relForTarget(
  target: string | undefined,
  rel: string | undefined
): string | undefined {
  if (target !== '_blank') {
    return rel;
  }
  const tokens = new Set((rel ?? '').split(/\s+/).filter(Boolean));
  tokens.add('noopener');
  tokens.add('noreferrer');
  return Array.from(tokens).join(' ');
}

// link card component; internal links keep same-tab navigation
export function LinkCard({
  title,
  description,
  href,
  target,
  rel,
  className,
  ...anchorProps
}: LinkCardProps): ReactElement {
  const effectiveTarget =
    target ?? (isExternalHref(href) ? '_blank' : undefined);

  return (
    <a
      href={href}
      className={cn('mdx-preview-starlight-link-card', className)}
      target={effectiveTarget}
      rel={relForTarget(effectiveTarget, rel)}
      {...anchorProps}
    >
      <div className="mdx-preview-starlight-link-card-content">
        <span className="mdx-preview-starlight-link-card-title">{title}</span>
        {description && (
          <span className="mdx-preview-starlight-link-card-description">
            {description}
          </span>
        )}
      </div>
      <span className="mdx-preview-starlight-link-card-arrow">
        <ArrowIcon />
      </span>
    </a>
  );
}

export default LinkCard;
