// src/components/starlight/Card.tsx
// preview-compatible @astrojs/starlight Card shim

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react'
import { BaseCard } from '../base'
import { cn } from '../internal/cn'
import { STARLIGHT_ICON_MAP } from './icon-map'

// card props (compatible w/ Starlight)
export interface CardProps extends HTMLAttributes<HTMLDivElement>
{
  children: ReactNode
  title: string
  icon?: string
}

// card component
export function Card({
  children,
  title,
  icon,
  className,
  ...props
}: CardProps): ReactElement
{
  const iconEmoji = icon ? (STARLIGHT_ICON_MAP[icon] ?? icon) : undefined

  return (
    <BaseCard
      className={cn('mdx-preview-starlight-card', className)}
      containerProps={props}
    >
      <div className="mdx-preview-starlight-card-header">
        {iconEmoji && (
          <span className="mdx-preview-starlight-card-icon">{iconEmoji}</span>
        )}
        <span className="mdx-preview-starlight-card-title">{title}</span>
      </div>
      <div className="mdx-preview-starlight-card-content">{children}</div>
    </BaseCard>
  )
}

export default Card
