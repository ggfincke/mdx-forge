// src/components/starlight/Card.tsx
// Starlight Card component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components Card

import React, { ReactNode, ReactElement } from 'react';
import { BaseCard } from '../base';
import { STARLIGHT_ICON_MAP } from './icon-map';

// card props (compatible w/ Starlight)
export interface CardProps {
  children: ReactNode;
  title: string;
  icon?: string;
}

// card component
export function Card({ children, title, icon }: CardProps): ReactElement {
  const iconEmoji = icon ? (STARLIGHT_ICON_MAP[icon] ?? icon) : undefined;

  return (
    <BaseCard className="mdx-preview-starlight-card">
      <div className="mdx-preview-starlight-card-header">
        {iconEmoji && (
          <span className="mdx-preview-starlight-card-icon">{iconEmoji}</span>
        )}
        <span className="mdx-preview-starlight-card-title">{title}</span>
      </div>
      <div className="mdx-preview-starlight-card-content">{children}</div>
    </BaseCard>
  );
}

export default Card;
