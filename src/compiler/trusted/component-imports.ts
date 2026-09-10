// src/compiler/trusted/component-imports.ts
// inject component imports after parsing w/ authored binding ownership

import type { Root } from 'mdast'
import type { ImportDeclaration } from 'estree'
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm'
import type { Transformer } from 'unified'
import { collectMdxBindings } from '../../internal/esm-bindings'
import { createUniqueIdentifier } from './identifier'
import type { ComponentImportsResult } from './component-mapper'

export function remarkComponentImports(
  options: ComponentImportsResult
): Transformer<Root>
{
  return (tree) =>
  {
    if (!options.hasComponents)
    {
      return
    }
    const reserved = new Set<string>()
    for (const node of tree.children)
    {
      if (node.type !== 'mdxjsEsm')
      {
        continue
      }
      const program = (node as MdxjsEsm).data?.estree
      if (!program)
      {
        continue
      }
      const bindings = collectMdxBindings(program)
      for (const name of [...bindings.imports, ...bindings.locals])
      {
        reserved.add(name)
      }
    }

    const entries: string[] = []
    const imports: MdxjsEsm[] = options.imports.map((component) =>
    {
      const name = createUniqueIdentifier(reserved, component.identifierBase)
      const declaration: ImportDeclaration = {
        type: 'ImportDeclaration',
        attributes: [],
        specifiers: [
          {
            type: 'ImportDefaultSpecifier',
            local: { type: 'Identifier', name },
          },
        ],
        source: { type: 'Literal', value: component.source },
      }
      entries.push(`  ${JSON.stringify(component.componentName)}: ${name}`)
      return {
        type: 'mdxjsEsm',
        value: `import ${name} from ${JSON.stringify(component.source)};`,
        data: {
          estree: {
            type: 'Program',
            sourceType: 'module',
            body: [declaration],
          },
        },
      }
    })
    tree.children.unshift(...imports)
    options.componentsObject = `{\n${entries.join(',\n')}\n}`
  }
}
