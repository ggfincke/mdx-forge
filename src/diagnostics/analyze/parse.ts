// src/diagnostics/analyze/parse.ts
// remark/remark-mdx parse + import & JSX-element collection (positions file-relative)

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Position } from 'unist'
import type {
  ClassDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  Pattern,
  Program,
  VariableDeclaration,
} from 'estree'
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
  const statements = value.data?.estree?.body
  if (
    statements?.length !== 1 ||
    statements[0].type !== 'ExpressionStatement'
  )
  {
    return undefined
  }

  const expression = statements[0].expression
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

// JSX name semantics: lowercase-start & dashed single identifiers are
// intrinsic tags, namespace names (svg:path) compile to literal tags &
// everything else (capitalized/_/$ roots & member expressions) is a component
function componentNameInfo(
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
    collectLocalBindings(estree, imports)
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
    const info = componentNameInfo(jsx.name)
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

function collectLocalBindings(program: Program, bindings: Set<string>): void
{
  for (const stmt of program.body)
  {
    if (stmt.type === 'ImportDeclaration')
    {
      collectImportBindings(stmt, bindings)
      continue
    }
    if (stmt.type === 'ExportNamedDeclaration')
    {
      collectExportBindings(stmt, bindings)
      continue
    }
    if (stmt.type === 'ExportDefaultDeclaration')
    {
      collectDefaultExportBinding(stmt, bindings)
    }
  }
}

function collectImportBindings(
  stmt: ImportDeclaration,
  bindings: Set<string>
): void
{
  for (const spec of stmt.specifiers)
  {
    bindings.add(spec.local.name)
  }
}

function collectExportBindings(
  stmt: ExportNamedDeclaration,
  bindings: Set<string>
): void
{
  if (stmt.declaration)
  {
    collectDeclarationBindings(stmt.declaration, bindings)
    return
  }
  if (stmt.source)
  {
    return
  }
  for (const spec of stmt.specifiers)
  {
    if (isIdentifier(spec.local))
    {
      bindings.add(spec.local.name)
    }
  }
}

function collectDefaultExportBinding(
  stmt: ExportDefaultDeclaration,
  bindings: Set<string>
): void
{
  const declaration = stmt.declaration
  if (
    (declaration.type === 'FunctionDeclaration' ||
      declaration.type === 'ClassDeclaration') &&
    isIdentifier(declaration.id)
  )
  {
    bindings.add(declaration.id.name)
  }
}

function collectDeclarationBindings(
  declaration: ExportNamedDeclaration['declaration'],
  bindings: Set<string>
): void
{
  if (!declaration)
  {
    return
  }
  if (declaration.type === 'VariableDeclaration')
  {
    collectVariableBindings(declaration, bindings)
    return
  }
  if (isNamedDeclaration(declaration))
  {
    bindings.add(declaration.id.name)
  }
}

function collectVariableBindings(
  declaration: VariableDeclaration,
  bindings: Set<string>
): void
{
  for (const variable of declaration.declarations)
  {
    collectPatternBindings(variable.id, bindings)
  }
}

function collectPatternBindings(pattern: Pattern, bindings: Set<string>): void
{
  switch (pattern.type)
  {
    case 'Identifier':
      bindings.add(pattern.name)
      break
    case 'ObjectPattern':
      for (const property of pattern.properties)
      {
        collectPatternBindings(
          property.type === 'RestElement' ? property.argument : property.value,
          bindings
        )
      }
      break
    case 'ArrayPattern':
      for (const element of pattern.elements)
      {
        if (element)
        {
          collectPatternBindings(element, bindings)
        }
      }
      break
    case 'RestElement':
      collectPatternBindings(pattern.argument, bindings)
      break
    case 'AssignmentPattern':
      collectPatternBindings(pattern.left, bindings)
      break
  }
}

function isNamedDeclaration(
  declaration: ExportNamedDeclaration['declaration']
): declaration is FunctionDeclaration | ClassDeclaration
{
  return (
    (declaration?.type === 'FunctionDeclaration' ||
      declaration?.type === 'ClassDeclaration') &&
    isIdentifier(declaration.id)
  )
}

function isIdentifier(node: unknown): node is Identifier
{
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'Identifier' &&
    'name' in node &&
    typeof node.name === 'string'
  )
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
