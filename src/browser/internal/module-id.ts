// src/browser/internal/module-id.ts
// mIT browser import classifier; shared behavior mirrors vsc runtime-utils

// ! cross-repo duplicate: keep common behavior covered by parity tests

const NPM_MODULE_PREFIX = 'npm://'
const NODE_MODULE_PREFIX = 'node:'
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/

export function isBareImport(specifier: string): boolean
{
  return (
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !WINDOWS_ABSOLUTE_PATH_PATTERN.test(specifier) &&
    !hasDisallowedUrlScheme(specifier) &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  )
}

function hasDisallowedUrlScheme(str: string): boolean
{
  if (!URL_SCHEME_PATTERN.test(str))
  {
    return false
  }

  return (
    !str.startsWith(NODE_MODULE_PREFIX) && !str.startsWith(NPM_MODULE_PREFIX)
  )
}
