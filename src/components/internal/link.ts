// src/components/internal/link.ts
// classify link destinations & merge blank-target safety tokens

export type ExternalHrefKind =
  'internal' | 'http' | 'protocol-relative' | 'other-scheme'

export function classifyExternalHref(href: string): ExternalHrefKind
{
  if (hasAsciiControl(href))
  {
    return 'internal'
  }

  const value = href.trim()
  if (isProtocolRelativeHref(value))
  {
    return 'protocol-relative'
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value))
  {
    try
    {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:')
      {
        return isHttpHref(value, url) ? 'http' : 'internal'
      }
      return 'other-scheme'
    }
    catch
    {
      return 'internal'
    }
  }
  return 'internal'
}

// require an explicit authority before treating HTTP syntax as external
function isHttpHref(href: string, url: URL): boolean
{
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    /^https?:\/\/[^/\\\s?#]/i.test(href) &&
    !hasHierarchicalBackslash(href) &&
    Boolean(url.hostname)
  )
}

// validate network-path syntax without accepting repaired extra slashes
function isProtocolRelativeHref(href: string): boolean
{
  if (!/^\/\/[^/\\\s?#]/.test(href) || hasHierarchicalBackslash(href))
  {
    return false
  }
  try
  {
    return Boolean(new URL(`https:${href}`).hostname)
  }
  catch
  {
    return false
  }
}

// special URLs must not rely on backslash-to-slash parser repair
function hasHierarchicalBackslash(value: string): boolean
{
  return value.split(/[?#]/, 1)[0].includes('\\')
}

// reject characters the URL parser would silently trim or remove
function hasAsciiControl(value: string): boolean
{
  for (let index = 0; index < value.length; index++)
  {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f)
    {
      return true
    }
  }
  return false
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
