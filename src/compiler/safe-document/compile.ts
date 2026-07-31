// src/compiler/safe-document/compile.ts
// compile MDX into a versioned JSON-only document tree

import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import type { Point, Position } from 'unist'
import { DIAGNOSTIC_CODES } from '../../diagnostics/types'
import {
  extractRawFrontmatter,
  MAX_FRONTMATTER_DEPTH,
  MAX_FRONTMATTER_NODES,
  MAX_FRONTMATTER_SERIALIZED_BYTES,
} from '../../internal/frontmatter'
import { isReservedObjectKey } from '../../internal/object-key'
import {
  pointAtLineColumn,
  pointAtOffset,
  SOURCE_START,
} from '../../internal/source-position'
import {
  collectSafeDocumentDefinitions,
  convertSafeDocumentChildren,
} from './convert'
import { addSafeDocumentDiagnostic, toSafeDocumentRange } from './internal'
import type {
  SafeDocumentCompileContext,
  SafeDocumentMdastNode,
} from './internal'
import { normalizeSafeDocumentOptions } from './schema'
import {
  SAFE_DOCUMENT_VERSION,
  type SafeDocument,
  type SafeDocumentCompileOptions,
  type SafeDocumentJsonValue,
} from './types'

const markdownParser = unified().use(remarkParse).use(remarkGfm)
const mdxParser = unified().use(remarkParse).use(remarkGfm).use(remarkMdx)
const UTF8_ENCODER = new TextEncoder()

export async function compileSafeDocument(
  source: string,
  options: SafeDocumentCompileOptions = {}
): Promise<SafeDocument>
{
  if (typeof source !== 'string')
  {
    throw new TypeError('source must be a string')
  }
  const normalizedOptions = normalizeSafeDocumentOptions(options)
  const context: SafeDocumentCompileContext = {
    options: normalizedOptions,
    diagnostics: [],
    definitions: new Map(),
    bodyOrigin: SOURCE_START,
  }

  let content: string
  let frontmatter: Record<string, SafeDocumentJsonValue> = {}
  try
  {
    const extracted = extractRawFrontmatter(source)
    content = extracted.content
    context.bodyOrigin = extracted.bodyOrigin
    const normalized = toSafeJson(extracted.frontmatter, new Set(), 0, {
      bytes: 0,
      nodes: 0,
    })
    if (normalized.ok && isJsonRecord(normalized.value))
    {
      frontmatter = normalized.value
    }
    else
    {
      invalidFrontmatter(
        context,
        normalized.ok ? 'frontmatter must be an object' : normalized.reason,
        frontmatterPosition(source, context.bodyOrigin.offset)
      )
    }
  }
  catch (error)
  {
    invalidFrontmatter(
      context,
      error instanceof Error ? error.message : String(error),
      frontmatterErrorPosition(error, source) ?? frontmatterPosition(source, 0)
    )
    content = ''
  }

  let tree: SafeDocumentMdastNode | null = null
  if (content)
  {
    try
    {
      const parser =
        normalizedOptions.format === 'md' ? markdownParser : mdxParser
      tree = parser.parse(content) as unknown as SafeDocumentMdastNode
    }
    catch (error)
    {
      addSafeDocumentDiagnostic(
        context,
        DIAGNOSTIC_CODES.MDX_PARSE_ERROR,
        'safe-document/parse-error',
        error instanceof Error ? error.message : String(error),
        parseErrorPosition(error),
        { phase: 'mdx' }
      )
    }
  }

  const withinDocumentLimits = tree
    ? collectSafeDocumentDefinitions(tree, context)
    : false
  const root = {
    type: 'root' as const,
    children:
      tree && withinDocumentLimits
        ? convertSafeDocumentChildren(tree.children ?? [], context)
        : [],
    ...(tree?.position
      ? { source: toSafeDocumentRange(tree.position, context) }
      : {}),
  }
  return {
    version: SAFE_DOCUMENT_VERSION,
    frontmatter,
    root,
    diagnostics: context.diagnostics,
  }
}

type JsonConversion =
  { ok: true; value: SafeDocumentJsonValue } | { ok: false; reason: string }

interface JsonConversionState
{
  bytes: number
  nodes: number
}

function toSafeJson(
  value: unknown,
  ancestors: Set<object>,
  depth: number,
  state: JsonConversionState
): JsonConversion
{
  state.nodes++
  if (state.nodes > MAX_FRONTMATTER_NODES)
  {
    return {
      ok: false,
      reason: `frontmatter exceeds ${MAX_FRONTMATTER_NODES} nodes`,
    }
  }
  if (depth > MAX_FRONTMATTER_DEPTH)
  {
    return {
      ok: false,
      reason: `frontmatter nesting exceeds depth ${MAX_FRONTMATTER_DEPTH}`,
    }
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
  {
    if (!addJsonBytes(state, value))
    {
      return frontmatterSizeError()
    }
    return { ok: true, value }
  }
  if (typeof value === 'number')
  {
    if (!Number.isFinite(value))
    {
      return { ok: false, reason: 'frontmatter numbers must be finite' }
    }
    if (!addJsonBytes(state, value))
    {
      return frontmatterSizeError()
    }
    return { ok: true, value }
  }
  if (value instanceof Date)
  {
    if (!Number.isFinite(value.getTime()))
    {
      return { ok: false, reason: 'frontmatter contains an invalid date' }
    }
    const normalized = value.toISOString()
    if (!addJsonBytes(state, normalized))
    {
      return frontmatterSizeError()
    }
    return { ok: true, value: normalized }
  }
  if (typeof value !== 'object' || value === undefined)
  {
    return {
      ok: false,
      reason: `frontmatter contains unsupported ${typeof value}`,
    }
  }
  if (ancestors.has(value))
  {
    return { ok: false, reason: 'frontmatter contains a cycle' }
  }
  ancestors.add(value)
  try
  {
    if (Array.isArray(value))
    {
      const output: SafeDocumentJsonValue[] = []
      for (const child of value)
      {
        const converted = toSafeJson(child, ancestors, depth + 1, state)
        if (!converted.ok)
        {
          return converted
        }
        output.push(converted.value)
      }
      return { ok: true, value: output }
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null)
    {
      return {
        ok: false,
        reason: 'frontmatter object has an unsupported prototype',
      }
    }
    const output: Record<string, SafeDocumentJsonValue> = {}
    for (const [key, child] of Object.entries(value))
    {
      if (isReservedObjectKey(key))
      {
        return { ok: false, reason: `frontmatter key ${key} is forbidden` }
      }
      state.bytes += UTF8_ENCODER.encode(key).byteLength + 4
      if (state.bytes > MAX_FRONTMATTER_SERIALIZED_BYTES)
      {
        return frontmatterSizeError()
      }
      const converted = toSafeJson(child, ancestors, depth + 1, state)
      if (!converted.ok)
      {
        return converted
      }
      output[key] = converted.value
    }
    return { ok: true, value: output }
  }
  finally
  {
    ancestors.delete(value)
  }
}

function addJsonBytes(state: JsonConversionState, value: unknown): boolean
{
  state.bytes +=
    typeof value === 'string'
      ? UTF8_ENCODER.encode(value).byteLength + 2
      : UTF8_ENCODER.encode(String(value)).byteLength
  return state.bytes <= MAX_FRONTMATTER_SERIALIZED_BYTES
}

function frontmatterSizeError(): JsonConversion
{
  return {
    ok: false,
    reason: `frontmatter projected size exceeds ${MAX_FRONTMATTER_SERIALIZED_BYTES} bytes`,
  }
}

function isJsonRecord(
  value: SafeDocumentJsonValue
): value is Record<string, SafeDocumentJsonValue>
{
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidFrontmatter(
  context: SafeDocumentCompileContext,
  reason: string,
  position: Position
): void
{
  context.diagnostics.push({
    code: DIAGNOSTIC_CODES.INVALID_FRONTMATTER,
    ruleId: 'safe-document/invalid-frontmatter',
    severity: 'error',
    message: `invalid frontmatter: ${reason}`,
    source: 'mdx-forge',
    range: position,
    data: { phase: 'frontmatter', reason },
  })
}

function frontmatterPosition(source: string, endOffset: number): Position
{
  const end = pointAtOffset(source, endOffset)
  return {
    start: { line: 1, column: 1, offset: 0 },
    end,
  }
}

function frontmatterErrorPosition(
  error: unknown,
  source: string
): Position | undefined
{
  if (!error || typeof error !== 'object')
  {
    return undefined
  }
  const mark = (error as { mark?: unknown }).mark
  if (!mark || typeof mark !== 'object')
  {
    return undefined
  }
  const candidate = mark as { line?: unknown; column?: unknown }
  if (
    typeof candidate.line !== 'number' ||
    typeof candidate.column !== 'number'
  )
  {
    return undefined
  }
  const line = candidate.line + 1
  const column = candidate.column + 1
  const point = pointAtLineColumn(source, line, column)
  return { start: point, end: point }
}

function parseErrorPosition(error: unknown): Position | undefined
{
  if (!error || typeof error !== 'object')
  {
    return undefined
  }
  const candidate = error as {
    line?: unknown
    column?: unknown
    offset?: unknown
    place?: unknown
    position?: unknown
  }
  const placed = asPosition(candidate.place) ?? asPosition(candidate.position)
  if (placed)
  {
    return placed
  }
  if (
    typeof candidate.line === 'number' &&
    typeof candidate.column === 'number'
  )
  {
    const point: Point = {
      line: candidate.line,
      column: candidate.column,
      ...(typeof candidate.offset === 'number'
        ? { offset: candidate.offset }
        : {}),
    }
    return { start: point, end: point }
  }
  return undefined
}

function asPosition(value: unknown): Position | undefined
{
  if (!value || typeof value !== 'object')
  {
    return undefined
  }
  const candidate = value as { start?: unknown; end?: unknown }
  const start = asPoint(candidate.start ?? value)
  const end = asPoint(candidate.end ?? value)
  return start && end ? { start, end } : undefined
}

function asPoint(value: unknown): Point | undefined
{
  if (!value || typeof value !== 'object')
  {
    return undefined
  }
  const candidate = value as {
    line?: unknown
    column?: unknown
    offset?: unknown
  }
  if (
    typeof candidate.line !== 'number' ||
    typeof candidate.column !== 'number'
  )
  {
    return undefined
  }
  return {
    line: candidate.line,
    column: candidate.column,
    ...(typeof candidate.offset === 'number'
      ? { offset: candidate.offset }
      : {}),
  }
}
