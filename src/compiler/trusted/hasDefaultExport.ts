// src/compiler/trusted/hasDefaultExport.ts
// single-pass authored-default detection & layout ESM injection

import { visit } from 'unist-util-visit'
import type { Root } from 'mdast'
import type { Node } from 'unist'

// resolved layout source shared by trusted compile paths
export type LayoutResolution =
  | { kind: 'custom'; specifier: string }
  | { kind: 'host'; options: string }
  | null

// minimal estree shapes needed for default-export detection
interface EstreeExportSpecifier
{
  type: string
  exported?: { type: string; name?: string; value?: unknown }
  [key: string]: unknown
}

interface EstreeStatement
{
  type: string
  specifiers?: EstreeExportSpecifier[]
  [key: string]: unknown
}

interface MdxjsEsmNode
{
  type: string
  value?: string
  data?: {
    estree?: {
      body?: EstreeStatement[]
      [key: string]: unknown
    }
  }
}

interface RemarkInjectLayoutOptions
{
  insertionOffset?: number
  resolveLayout: () => LayoutResolution
}

interface CompileFile
{
  data: Record<string, unknown>
  value: unknown
}

interface LayoutInjection
{
  source: string
  nodes: Root['children']
}

// true for `export { x as default }` & `export { default } from '...'` forms
const exportsDefaultName = (spec: EstreeExportSpecifier): boolean =>
{
  const exported = spec.exported
  if (!exported)
  {
    return false
  }
  if (exported.type === 'Identifier')
  {
    return exported.name === 'default'
  }
  return exported.value === 'default'
}

// inspect parsed ESM nodes so fenced/prose `export default` never matches
const hasDefaultExport = (tree: Root): boolean =>
{
  for (const node of tree.children as MdxjsEsmNode[])
  {
    if (node.type !== 'mdxjsEsm')
    {
      continue
    }
    for (const stmt of node.data?.estree?.body ?? [])
    {
      if (stmt.type === 'ExportDefaultDeclaration')
      {
        return true
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        (stmt.specifiers ?? []).some(exportsDefaultName)
      )
      {
        return true
      }
    }
  }
  return false
}

// create a positioned mdxjsEsm node backed by the supplied estree statement
const createEsmNode = (
  value: string,
  statement: EstreeStatement,
  line: number,
  offset: number
): Root['children'][number] =>
  ({
    type: 'mdxjsEsm',
    value,
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [statement],
      },
    },
    position: {
      start: { line, column: 1, offset },
      end: {
        line,
        column: value.length + 1,
        offset: offset + value.length,
      },
    },
  }) as unknown as Root['children'][number]

// build the same import/default-export prefix formerly parsed w/ the document
const createLayoutInjection = (
  layout: Exclude<LayoutResolution, null>,
  line: number,
  offset: number
): LayoutInjection =>
{
  const importValue =
    layout.kind === 'custom'
      ? `import Layout from ${layout.specifier};`
      : `import { createLayout } from 'vscode-markdown-layout';`
  const exportValue =
    layout.kind === 'custom'
      ? 'export default Layout;'
      : `export default createLayout(${layout.options});`
  const importStatement: EstreeStatement =
    layout.kind === 'custom'
      ? {
          type: 'ImportDeclaration',
          specifiers: [
            {
              type: 'ImportDefaultSpecifier',
              local: { type: 'Identifier', name: 'Layout' },
            },
          ],
          source: {
            type: 'Literal',
            value: JSON.parse(layout.specifier) as string,
          },
        }
      : {
          type: 'ImportDeclaration',
          specifiers: [
            {
              type: 'ImportSpecifier',
              imported: { type: 'Identifier', name: 'createLayout' },
              local: { type: 'Identifier', name: 'createLayout' },
            },
          ],
          source: {
            type: 'Literal',
            value: 'vscode-markdown-layout',
          },
        }
  const exportStatement: EstreeStatement = {
    type: 'ExportDefaultDeclaration',
    declaration:
      layout.kind === 'custom'
        ? { type: 'Identifier', name: 'Layout' }
        : {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'createLayout' },
            arguments:
              layout.options === '{}'
                ? [
                    {
                      type: 'ObjectExpression',
                      properties: [],
                    },
                  ]
                : [
                    {
                      type: 'ObjectExpression',
                      properties: [
                        {
                          type: 'Property',
                          method: false,
                          shorthand: false,
                          computed: false,
                          kind: 'init',
                          key: {
                            type: 'Identifier',
                            name: 'forceLightTheme',
                          },
                          value: { type: 'Literal', value: true },
                        },
                      ],
                    },
                  ],
            optional: false,
          },
  }
  const exportOffset = offset + importValue.length + 2

  return {
    source: `${importValue}\n\n${exportValue}\n\n`,
    nodes: [
      createEsmNode(importValue, importStatement, line, offset),
      createEsmNode(exportValue, exportStatement, line + 2, exportOffset),
    ],
  }
}

// shift parsed source positions to match the virtual layout prefix
const shiftTreePositions = (
  tree: Root,
  insertionOffset: number,
  insertionLine: number,
  lineDelta: number,
  offsetDelta: number
): void =>
{
  for (const child of tree.children)
  {
    visit(child, (node: Node) =>
    {
      const position = node.position
      if (!position)
      {
        return
      }
      const followsInsertion =
        position.start.offset === undefined
          ? position.start.line >= insertionLine
          : position.start.offset >= insertionOffset
      if (!followsInsertion)
      {
        return
      }
      for (const point of [position.start, position.end])
      {
        point.line += lineDelta
        if (point.offset !== undefined)
        {
          point.offset += offsetDelta
        }
      }
    })
  }

  const rootEnd = tree.position?.end
  if (rootEnd)
  {
    rootEnd.line += lineDelta
    if (rootEnd.offset !== undefined)
    {
      rootEnd.offset += offsetDelta
    }
  }
}

// inject a configured layout during the one @mdx-js/mdx parse pipeline
export default function remarkInjectLayout(options: RemarkInjectLayoutOptions)
{
  return (tree: Root, file: CompileFile) =>
  {
    const authoredDefault = hasDefaultExport(tree)
    file.data.hasAuthoredDefaultExport = authoredDefault
    if (authoredDefault)
    {
      return
    }

    const layout = options.resolveLayout()
    if (!layout)
    {
      return
    }

    const source = String(file.value)
    const insertionOffset = options.insertionOffset ?? 0
    const insertionLine = source.slice(0, insertionOffset).split('\n').length
    const insertionIndex = tree.children.findIndex(
      (node) =>
        ((node as Node).position?.start.offset ?? insertionOffset) >=
        insertionOffset
    )
    const layoutInjection = createLayoutInjection(
      layout,
      insertionLine,
      insertionOffset
    )
    const lineDelta = layoutInjection.source.split('\n').length - 1

    shiftTreePositions(
      tree,
      insertionOffset,
      insertionLine,
      lineDelta,
      layoutInjection.source.length
    )
    tree.children.splice(
      insertionIndex < 0 ? tree.children.length : insertionIndex,
      0,
      ...layoutInjection.nodes
    )
    file.value =
      source.slice(0, insertionOffset) +
      layoutInjection.source +
      source.slice(insertionOffset)

    const sourceLineOffset = file.data.sourceLineOffset
    if (typeof sourceLineOffset === 'number')
    {
      file.data.sourceLineOffset = sourceLineOffset - lineDelta
    }
  }
}
