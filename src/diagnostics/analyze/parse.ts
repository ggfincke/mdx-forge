// src/diagnostics/analyze/parse.ts
// remark/remark-mdx parse + import & JSX-element collection (positions file-relative)

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Position } from 'unist'
import type { Expression, Program } from 'estree'
import { collectMdxBindings } from '../../internal/esm-bindings'
import {
  rebasePosition,
  type SourceOrigin,
} from '../../internal/source-position'
import type { DiagnosticRange } from '../types'

export type DetectedAttributeKind =
  'shorthand' | 'string' | 'expression' | 'spread'

export interface DetectedAttribute
{
  kind: DetectedAttributeKind
  // absent for spread attributes ({...rest})
  name?: string
  // literal string value or raw expression source
  value?: string
  // statically-resolved string expression value
  staticValue?: string
  // true only when syntax guarantees a non-boolean result
  knownNonBoolean?: boolean
}

export interface DetectedComponent
{
  // full name as written (e.g. Tabs.Tab)
  name: string
  // root identifier of the reference (Tabs for Tabs.Tab)
  root: string
  // member path segments after the root (['Tab'] for Tabs.Tab)
  members: string[]
  range: DiagnosticRange
  attributes: DetectedAttribute[]
}

export interface ParsedMdx
{
  imports: Set<string>
  components: DetectedComponent[]
}

const parser = unified().use(remarkParse).use(remarkMdx)

interface MdxEsmNode
{
  data?: { estree?: Program }
}

interface MdxJsxAttributeValueExpression
{
  type: string
  value?: string
  data?: { estree?: Program }
}

interface MdxJsxAttributeNode
{
  type: 'mdxJsxAttribute' | 'mdxJsxExpressionAttribute'
  name?: string
  value?: string | null | MdxJsxAttributeValueExpression
}

interface MdxJsxNode
{
  name: string | null
  attributes?: MdxJsxAttributeNode[]
  position?: Position
}

function staticStringExpression(
  value: MdxJsxAttributeValueExpression
): string | undefined
{
  const expression = getAttributeExpression(value)
  if (!expression)
  {
    return undefined
  }
  if (expression.type === 'Literal' && typeof expression.value === 'string')
  {
    return expression.value
  }
  if (
    expression.type === 'TemplateLiteral' &&
    expression.expressions.length === 0 &&
    expression.quasis.length === 1
  )
  {
    return expression.quasis[0].value.cooked ?? expression.quasis[0].value.raw
  }
  return undefined
}

// recover the parsed expression instead of inferring syntax from raw text
function getAttributeExpression(
  value: MdxJsxAttributeValueExpression
): Expression | undefined
{
  const statements = value.data?.estree?.body
  if (
    statements?.length !== 1 ||
    statements[0].type !== 'ExpressionStatement'
  )
  {
    return undefined
  }
  return statements[0].expression
}

// keep diagnostics conservative when the runtime result could be boolean
function isKnownNonBooleanExpression(
  value: MdxJsxAttributeValueExpression
): boolean
{
  const expression = getAttributeExpression(value)
  if (!expression)
  {
    return false
  }
  if (expression.type === 'Literal')
  {
    return typeof expression.value !== 'boolean'
  }
  return (
    expression.type === 'TemplateLiteral' ||
    expression.type === 'ArrayExpression' ||
    expression.type === 'ObjectExpression' ||
    expression.type === 'FunctionExpression' ||
    expression.type === 'ArrowFunctionExpression' ||
    expression.type === 'ClassExpression' ||
    (expression.type === 'UnaryExpression' &&
      ['typeof', 'void', '+', '-', '~'].includes(expression.operator)) ||
    expression.type === 'UpdateExpression'
  )
}

// JSX name semantics: lowercase-start & dashed single identifiers are
// intrinsic tags, namespace names (svg:path) compile to literal tags &
// everything else (capitalized/_/$ roots & member expressions) is a component
export function getComponentNameInfo(
  name: string
): { root: string; members: string[] } | null
{
  if (name.includes(':'))
  {
    return null
  }
  const segments = name.split('.')
  const root = segments[0]
  if (segments.length === 1 && (/^[a-z]/.test(root) || root.includes('-')))
  {
    return null
  }
  return { root, members: segments.slice(1) }
}

function collectAttributes(node: MdxJsxNode): DetectedAttribute[]
{
  const out: DetectedAttribute[] = []
  for (const attr of node.attributes ?? [])
  {
    if (attr.type !== 'mdxJsxAttribute' || typeof attr.name !== 'string')
    {
      out.push({ kind: 'spread' })
      continue
    }
    if (attr.value === null || attr.value === undefined)
    {
      out.push({ kind: 'shorthand', name: attr.name })
      continue
    }
    if (typeof attr.value === 'string')
    {
      out.push({ kind: 'string', name: attr.name, value: attr.value })
      continue
    }
    out.push({
      kind: 'expression',
      name: attr.name,
      value: attr.value.value,
      staticValue: staticStringExpression(attr.value),
      knownNonBoolean: isKnownNonBooleanExpression(attr.value),
    })
  }
  return out
}

export function parseMdxForAnalysis(
  content: string,
  bodyOrigin: SourceOrigin
): ParsedMdx
{
  const tree = parser.parse(content) as Root

  const imports = new Set<string>()
  visit(tree, 'mdxjsEsm', (node) =>
  {
    const estree = (node as MdxEsmNode).data?.estree
    if (!estree)
    {
      return
    }
    const bindings = collectMdxBindings(estree)
    for (const name of [...bindings.imports, ...bindings.locals])
    {
      imports.add(name)
    }
  })

  const components: DetectedComponent[] = []
  visit(tree, (node) =>
  {
    if (
      node.type !== 'mdxJsxFlowElement' &&
      node.type !== 'mdxJsxTextElement'
    )
    {
      return
    }
    const jsx = node as MdxJsxNode
    if (!jsx.name || !jsx.position)
    {
      return
    }
    const info = getComponentNameInfo(jsx.name)
    if (!info)
    {
      return
    }
    components.push({
      name: jsx.name,
      root: info.root,
      members: info.members,
      range: toRange(jsx.position, bodyOrigin),
      attributes: collectAttributes(jsx),
    })
  })

  return { imports, components }
}

function toRange(
  position: Position,
  bodyOrigin: SourceOrigin
): DiagnosticRange
{
  const rebased = rebasePosition(position, bodyOrigin)
  return {
    start: {
      line: rebased.start.line,
      column: rebased.start.column,
    },
    end: {
      line: rebased.end.line,
      column: rebased.end.column,
    },
  }
}
