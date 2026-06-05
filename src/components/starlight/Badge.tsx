// src/components/starlight/Badge.tsx
// Starlight Badge component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components Badge

import React, { ReactNode, ReactElement } from 'react';

// badge variants
export type BadgeVariant =
  | 'note'
  | 'tip'
  | 'caution'
  | 'danger'
  | 'success'
  | 'default';

// badge sizes
export type BadgeSize = 'small' | 'medium' | 'large';

// canonical badge variant list - single source for metadata
export const BADGE_VARIANTS: readonly BadgeVariant[] = [
  'note',
  'tip',
  'caution',
  'danger',
  'success',
  'default',
] as const;

// canonical badge size list - single source for metadata
export const BADGE_SIZES: readonly BadgeSize[] = [
  'small',
  'medium',
  'large',
] as const;

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
