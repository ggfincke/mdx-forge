// src/components/starlight/Steps.tsx
// preview-compatible @astrojs/starlight Steps shim

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react'
import { cn } from '../internal/cn'

// steps props (compatible w/ Starlight)
export interface StepsProps extends HTMLAttributes<HTMLDivElement>
{
  children: ReactNode
}

// steps component - render numbered steps from ordered list children
export function Steps({
  children,
  className,
  ...props
}: StepsProps): ReactElement
{
  return (
    <div {...props} className={cn('mdx-preview-starlight-steps', className)}>
      {children}
    </div>
  )
}

export default Steps
