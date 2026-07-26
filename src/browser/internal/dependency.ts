// src/browser/internal/dependency.ts
// normalize legacy & structured module dependency identities

import type { ModuleDependency, ModuleDependencyInput } from '../types'

const IMPORT_RUNTIME_PREFIX = '\0mdx-forge:import\0'

export interface NormalizedModuleDependency extends ModuleDependency
{
  legacy: boolean
}

const normalizedDependencyInstances = new WeakSet<NormalizedModuleDependency>()

export function createImportRuntimeRequest(specifier: string): string
{
  return `${IMPORT_RUNTIME_PREFIX}${specifier}`
}

export function normalizeModuleDependency(
  dependency: ModuleDependencyInput
): NormalizedModuleDependency
{
  if (
    typeof dependency !== 'string' &&
    normalizedDependencyInstances.has(dependency as NormalizedModuleDependency)
  )
  {
    return dependency as NormalizedModuleDependency
  }

  if (typeof dependency === 'string')
  {
    if (dependency.includes('\0'))
    {
      throw new TypeError('Legacy module dependency contains a NUL byte')
    }
    const normalized = {
      specifier: dependency,
      kind: 'require',
      runtimeRequest: dependency,
      legacy: true,
    } satisfies NormalizedModuleDependency
    normalizedDependencyInstances.add(normalized)
    return normalized
  }

  if (
    !dependency ||
    typeof dependency.specifier !== 'string' ||
    !dependency.specifier ||
    dependency.specifier.includes('\0')
  )
  {
    throw new TypeError('Structured module dependency has an invalid specifier')
  }
  if (dependency.kind !== 'import' && dependency.kind !== 'require')
  {
    throw new TypeError('Structured module dependency has an invalid kind')
  }

  const runtimeRequest =
    dependency.kind === 'import'
      ? createImportRuntimeRequest(dependency.specifier)
      : dependency.specifier
  if (dependency.runtimeRequest !== runtimeRequest)
  {
    throw new TypeError(
      'Structured module dependency has a non-canonical runtime request'
    )
  }
  const normalized = {
    ...dependency,
    runtimeRequest,
    legacy: false,
  } satisfies NormalizedModuleDependency
  normalizedDependencyInstances.add(normalized)
  return normalized
}

export function normalizeModuleDependencies(
  dependencies: ModuleDependencyInput[]
): NormalizedModuleDependency[]
{
  const normalized: NormalizedModuleDependency[] = []
  const indexes = new Map<string, number>()

  for (const input of dependencies)
  {
    const dependency = normalizeModuleDependency(input)
    const key = JSON.stringify([dependency.specifier, dependency.kind])
    const existingIndex = indexes.get(key)
    if (existingIndex === undefined)
    {
      indexes.set(key, normalized.length)
      normalized.push(dependency)
      continue
    }
    if (normalized[existingIndex].legacy && !dependency.legacy)
    {
      normalized[existingIndex] = dependency
    }
  }

  return normalized
}
