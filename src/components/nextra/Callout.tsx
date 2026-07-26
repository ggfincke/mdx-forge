// src/components/nextra/Callout.tsx
// preview-compatible nextra/components Callout shim

import React, { ReactNode, ReactElement, HTMLAttributes } from 'react'
import { cn } from '../internal/cn'
import { createCallout } from '../base/BaseCallout'
import { NEXTRA_CALLOUT_ICONS, type NextraCalloutType } from '../base/icons'

// callout type variants (matching Nextra's official API)
export type CalloutType = NextraCalloutType | null

// callout props (compatible w/ Nextra)
export interface CalloutProps extends HTMLAttributes<HTMLDivElement>
{
  children: ReactNode
  type?: CalloutType
  emoji?: ReactNode
}

// default (empty) titles - Nextra callouts don't have titles
const NEXTRA_CALLOUT_TITLES: Record<NextraCalloutType, string> = {
  default: '',
  info: '',
  warning: '',
  error: '',
  important: '',
}

// create the base Callout using factory
const BaseCallout = createCallout<NextraCalloutType>({
  classPrefix: 'mdx-preview-nextra-callout',
  defaultType: 'default',
  icons: { type: 'component', icons: NEXTRA_CALLOUT_ICONS },
  defaultTitles: NEXTRA_CALLOUT_TITLES,
  layout: 'inline',
})

// nextra Callout component
// wrap the base callout to support Nextra-specific props (emoji, className, spread props)
export function Callout({
  children,
  type = 'default',
  emoji,
  className,
  ...props
}: CalloutProps): ReactElement
{
  // use emoji as custom icon if provided
  const icon = emoji ?? undefined
  const callout =
    type === null ? (
      <aside className="mdx-preview-nextra-callout">
        {emoji !== undefined && emoji !== null && (
          <span className="mdx-preview-nextra-callout-icon">{emoji}</span>
        )}
        <div className="mdx-preview-nextra-callout-content">{children}</div>
      </aside>
    ) : (
      <BaseCallout type={type} icon={icon}>
        {children}
      </BaseCallout>
    )

  return (
    <div
      className={cn('mdx-preview-nextra-callout-wrapper', className)}
      {...props}
    >
      {callout}
    </div>
  )
}

export default Callout
