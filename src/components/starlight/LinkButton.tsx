// src/components/starlight/LinkButton.tsx
// render Starlight call-to-action links with shared navigation policy

import type { AnchorHTMLAttributes, ReactElement } from 'react'
import { cn } from '../internal/cn'
import { classifyExternalHref, mergeBlankTargetRel } from '../internal/link'
import { Icon } from './Icon'

/** Props for a preview-compatible Starlight link button. */
export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement>
{
  href: string
  variant?: 'primary' | 'secondary' | 'minimal'
  icon?: string
  iconPlacement?: 'start' | 'end'
  class?: string
}

export function LinkButton({
  href,
  variant = 'primary',
  icon,
  iconPlacement = 'end',
  children,
  class: astroClass,
  className,
  target,
  rel,
  ...props
}: LinkButtonProps): ReactElement
{
  const effectiveTarget =
    target ?? (classifyExternalHref(href) !== 'internal' ? '_blank' : undefined)
  const iconElement = icon ? <Icon name={icon} /> : null

  return (
    <a
      {...props}
      href={href}
      target={effectiveTarget}
      rel={mergeBlankTargetRel(effectiveTarget, rel)}
      className={cn(
        'mdx-preview-starlight-link-button',
        `mdx-preview-starlight-link-button-${variant}`,
        astroClass,
        className
      )}
    >
      {iconPlacement === 'start' && iconElement}
      {children}
      {iconPlacement === 'end' && iconElement}
    </a>
  )
}

export default LinkButton
