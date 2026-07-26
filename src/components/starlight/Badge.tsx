// src/components/starlight/Badge.tsx
// preview-compatible @astrojs/starlight Badge shim

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react';
import { cn } from '../internal/cn';
import type { BadgeSize, BadgeVariant } from '../internal/metadata';

export {
  BADGE_SIZES,
  BADGE_VARIANTS,
  type BadgeSize,
  type BadgeVariant,
} from '../internal/metadata';

// badge props (compatible w/ Starlight)
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  text: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

// badge component
export function Badge({
  text,
  variant = 'default',
  size = 'small',
  className,
  ...props
}: BadgeProps): ReactElement {
  return (
    <span
      {...props}
      className={cn(
        'mdx-preview-starlight-badge',
        `mdx-preview-starlight-badge-${variant}`,
        `mdx-preview-starlight-badge-${size}`,
        className
      )}
    >
      {text}
    </span>
  );
}

export default Badge;
