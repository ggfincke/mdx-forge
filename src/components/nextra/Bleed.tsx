// src/components/nextra/Bleed.tsx
// nextra Bleed shim for overflow layout previews

import { ReactNode, ReactElement, HTMLAttributes } from 'react'
import { cn } from '../internal/cn'

// bleed props (compatible w/ Nextra): `full` is a boolean layout mode
export interface BleedProps extends HTMLAttributes<HTMLDivElement>
{
  children: ReactNode
  full?: boolean
}

// bleed component; `full` stretches edge-to-edge & never reaches the DOM
export function Bleed({
  children,
  full = false,
  className,
  ...props
}: BleedProps): ReactElement
{
  const classes = cn(
    'mdx-preview-nextra-bleed',
    full && 'mdx-preview-nextra-bleed-full',
    className
  )

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

export default Bleed
