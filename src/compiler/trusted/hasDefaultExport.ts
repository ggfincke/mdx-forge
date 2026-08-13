// src/compiler/trusted/hasDefaultExport.ts
// authored default-export detection for trusted MDX

import type { ExportSpecifier, Program } from 'estree'
import type { Root } from 'mdast'

interface MdxjsEsmNode
{
  type: string
  data?: {
    estree?: Program
  }
}

interface CompileFile
{
  data: Record<string, unknown>
}

// true for `export { x as default }` & `export { default } from '...'` forms
const exportsDefaultName = (spec: ExportSpecifier): boolean =>
{
  const exported = spec.exported
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
    for (const statement of node.data?.estree?.body ?? [])
    {
      if (statement.type === 'ExportDefaultDeclaration')
      {
        return true
      }
      if (
        statement.type === 'ExportNamedDeclaration' &&
        statement.specifiers.some(exportsDefaultName)
      )
      {
        return true
      }
    }
  }
  return false
}

// record whether authored MDX already owns the page layout
export default function remarkDetectDefaultExport()
{
  return (tree: Root, file: CompileFile) =>
  {
    file.data.hasAuthoredDefaultExport = hasDefaultExport(tree)
  }
}
