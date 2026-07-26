// src/components/starlight/LinkCard.tsx
// provide a preview-compatible Starlight LinkCard shim

import React, { ReactElement, AnchorHTMLAttributes } from 'react';
import { cn } from '../internal/cn';
import { classifyExternalHref, mergeBlankTargetRel } from '../internal/link';
import { ArrowIcon } from '../base/icons';

// linkCard props derive from native anchor attributes (all forwarded)
export interface LinkCardProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  title: string;
  description?: string;
  href: string;
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
    target ??
    (classifyExternalHref(href) !== 'internal' ? '_blank' : undefined);

  return (
    <a
      href={href}
      className={cn('mdx-preview-starlight-link-card', className)}
      target={effectiveTarget}
      rel={mergeBlankTargetRel(effectiveTarget, rel)}
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
