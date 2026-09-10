// src/components/starlight/Icon.tsx
// render bundled Starlight icons without executing Astro

import type { ReactElement, SVGProps } from 'react'
import { STARLIGHT_SVG_ICONS } from './icons.generated'

/** Props for a preview-compatible Starlight icon. */
export interface StarlightIconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'name'
>
{
  name: string
  label?: string
  size?: string
  color?: string
  class?: string
}

const UNKNOWN_ICON =
  '<path d="M11 17h2v2h-2zm1-15a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 3 1.73c-1.3.75-2 1.65-2 3.27h2c0-.88.26-1.15 1-1.58A4 4 0 0 0 12 6z"/>'

export function Icon({
  name,
  label,
  size = '1em',
  color = 'currentColor',
  class: astroClass,
  className,
  style,
  ...props
}: StarlightIconProps): ReactElement
{
  const svg = Object.hasOwn(STARLIGHT_SVG_ICONS, name)
    ? STARLIGHT_SVG_ICONS[name]
    : UNKNOWN_ICON

  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={[astroClass, className].filter(Boolean).join(' ') || undefined}
      style={{ color, flexShrink: 0, verticalAlign: 'middle', ...style }}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default Icon
