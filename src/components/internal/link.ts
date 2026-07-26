// src/components/internal/link.ts
// classify link destinations & merge blank-target safety tokens

export type ExternalHrefKind =
  'internal' | 'http' | 'protocol-relative' | 'other-scheme'

export function classifyExternalHref(href: string): ExternalHrefKind
{
  if (href.startsWith('//'))
  {
    return 'protocol-relative'
  }
  if (/^https?:\/\//.test(href))
  {
    return 'http'
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href))
  {
    return 'other-scheme'
  }
  return 'internal'
}

export function mergeBlankTargetRel(
  target: string | undefined,
  rel: string | undefined
): string | undefined
{
  if (target !== '_blank')
  {
    return rel
  }
  const tokens = new Set((rel ?? '').split(/\s+/).filter(Boolean))
  tokens.add('noopener')
  tokens.add('noreferrer')
  return Array.from(tokens).join(' ')
}
