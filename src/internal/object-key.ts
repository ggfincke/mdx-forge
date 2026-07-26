// src/internal/object-key.ts
// identify object keys reserved against prototype mutation

const RESERVED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isReservedObjectKey(key: string): boolean
{
  return RESERVED_OBJECT_KEYS.has(key)
}
