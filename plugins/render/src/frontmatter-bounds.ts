// plugins/render/src/frontmatter-bounds.ts
// local defense-in-depth bounds for frontmatter graphs

// ! duplicates core src/internal/frontmatter.ts; plugin uses published 0.6.2 & can't import it - consolidate in Group B/E

// bounds mirror the core normalizer; keep them in sync until consolidation
export const MAX_FRONTMATTER_DEPTH = 8
export const MAX_FRONTMATTER_NODES = 5000
export const MAX_FRONTMATTER_SERIALIZED_BYTES = 256 * 1024

export class FrontmatterBoundsError extends Error
{
  constructor(message: string)
  {
    super(message)
    this.name = 'FrontmatterBoundsError'
  }
}

interface NormalizeState
{
  nodes: number
  bytes: number
}

function scalarBytes(value: unknown): number
{
  if (typeof value === 'string')
  {
    return value.length + 2
  }
  return String(value).length
}

function cloneBounded(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
  state: NormalizeState
): unknown
{
  if (value === null || typeof value !== 'object')
  {
    state.nodes++
    state.bytes += scalarBytes(value)
    if (state.nodes > MAX_FRONTMATTER_NODES)
    {
      throw new FrontmatterBoundsError(
        `frontmatter exceeds ${MAX_FRONTMATTER_NODES} nodes`
      )
    }
    if (state.bytes > MAX_FRONTMATTER_SERIALIZED_BYTES)
    {
      throw new FrontmatterBoundsError(
        `frontmatter projected size exceeds ${MAX_FRONTMATTER_SERIALIZED_BYTES} bytes`
      )
    }
    return value
  }

  if (value instanceof Date)
  {
    state.nodes++
    state.bytes += 24
    return value
  }

  if (depth > MAX_FRONTMATTER_DEPTH)
  {
    throw new FrontmatterBoundsError(
      `frontmatter nesting exceeds depth ${MAX_FRONTMATTER_DEPTH}`
    )
  }

  const container = value as object
  if (ancestors.has(container))
  {
    throw new FrontmatterBoundsError(
      'frontmatter contains a cyclic reference (YAML alias loop)'
    )
  }
  ancestors.add(container)
  state.nodes++
  if (state.nodes > MAX_FRONTMATTER_NODES)
  {
    throw new FrontmatterBoundsError(
      `frontmatter exceeds ${MAX_FRONTMATTER_NODES} nodes`
    )
  }

  let result: unknown
  if (Array.isArray(value))
  {
    result = value.map((entry) =>
      cloneBounded(entry, depth + 1, ancestors, state)
    )
  }
  else
  {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value))
    {
      state.bytes += key.length + 4
      out[key] = cloneBounded(entry, depth + 1, ancestors, state)
    }
    result = out
  }

  ancestors.delete(container)
  return result
}

// normalize gray-matter data into bounded acyclic plain data
export function normalizeFrontmatterData(
  data: Record<string, unknown>
): Record<string, unknown>
{
  const state: NormalizeState = { nodes: 0, bytes: 0 }
  return cloneBounded(data, 0, new Set(), state) as Record<string, unknown>
}

// guarded JSON.stringify; normalizes first so cyclic/oversized data can't throw
// deep inside the MCP response path
export function boundedStringify(
  data: Record<string, unknown>,
  space?: number
): string
{
  return JSON.stringify(normalizeFrontmatterData(data), null, space)
}
