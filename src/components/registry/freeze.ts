// src/components/registry/freeze.ts
// freeze registry-owned object graphs at runtime

export function deepFreeze<T>(value: T): T
{
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null ||
    Object.isFrozen(value)
  )
  {
    return value
  }

  for (const key of Reflect.ownKeys(value))
  {
    deepFreeze((value as Record<PropertyKey, unknown>)[key])
  }

  return Object.freeze(value)
}
