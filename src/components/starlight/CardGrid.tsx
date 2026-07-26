// src/components/starlight/CardGrid.tsx
// preview-compatible @astrojs/starlight CardGrid shim

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react'
import { cn } from '../internal/cn'

// cardGrid props (compatible w/ Starlight)
export interface CardGridProps extends HTMLAttributes<HTMLDivElement>
{
  children: ReactNode
  stagger?: boolean
}

// card grid component
export function CardGrid({
  children,
  stagger = false,
  className,
  ...props
}: CardGridProps): ReactElement
{
  return (
    <div
      {...props}
      className={cn(
        'mdx-preview-starlight-card-grid',
        stagger && 'stagger',
        className
      )}
    >
      {children}
    </div>
  )
}

export default CardGrid
