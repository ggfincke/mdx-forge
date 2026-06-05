// src/components/starlight/Badge.tsx
// Starlight Badge component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components Badge

import React, { ReactNode, ReactElement } from 'react';
import type { BadgeSize, BadgeVariant } from '../internal/metadata';

export {
  BADGE_SIZES,
  BADGE_VARIANTS,
  type BadgeSize,
  type BadgeVariant,
} from '../internal/metadata';

// badge props (compatible w/ Starlight)
export interface BadgeProps {
  text: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

// badge component
export function Badge({
  text,
  variant = 'default',
  size = 'small',
}: BadgeProps): ReactElement {
  return (
    <span
      className={`mdx-preview-starlight-badge mdx-preview-starlight-badge-${variant} mdx-preview-starlight-badge-${size}`}
    >
      {text}
    </span>
  );
}

export default Badge;
