// src/components/starlight/Card.tsx
// Starlight Card component shim for MDX Preview
// provide preview-compatible version of @astrojs/starlight/components Card

import React, { ReactNode, ReactElement } from 'react';
import { BaseCard } from '../base';

// map Starlight icon names to emoji equivalents
const ICON_MAP: Record<string, string> = {
  star: '⭐',
  rocket: '🚀',
  document: '📄',
  pencil: '✏️',
  puzzle: '🧩',
  setting: '⚙️',
  information: 'ℹ️',
  'open-book': '📖',
  warning: '⚠️',
  error: '❌',
  check: '✅',
  heart: '❤️',
  lightning: '⚡',
  sun: '☀️',
  moon: '🌙',
  external: '🔗',
  seti: '📁',
};

// card props (compatible w/ Starlight)
export interface CardProps {
  children: ReactNode;
  title: string;
  icon?: string;
}

// card component
export function Card({ children, title, icon }: CardProps): ReactElement {
  const iconEmoji = icon ? (ICON_MAP[icon] ?? icon) : undefined;

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
