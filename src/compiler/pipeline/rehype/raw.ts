// src/compiler/pipeline/rehype/raw.ts
// normalize trusted HTML w/o repeated full-source root location scans

import rehypeRaw, { type Options } from 'rehype-raw'
import type { Root, RootContent } from 'hast'
import type { Point } from 'unist'
import type { VFile } from 'vfile'
import { pointAtOffset, SOURCE_START } from '../../../internal/source-position'

function isSyntheticStart(point: Point): boolean
{
  return point.line === 1 && point.column === 1 && point.offset === 0
}

export default function rehypeRawWithSourceView(options?: Options)
{
  const transform = rehypeRaw(options)
  return (tree: Root, file: VFile): Root =>
  {
    const positionFile: VFile = Object.create(file, {
      toString: { value: () => '' },
    })
    const result = transform(tree, positionFile)
    let sourceEnd: Point | undefined
    const roots = [result]

    for (const root of roots)
    {
      const position = root.position
      if (
        position &&
        isSyntheticStart(position.start) &&
        isSyntheticStart(position.end)
      )
      {
        if (!sourceEnd)
        {
          const source = String(file)
          sourceEnd = pointAtOffset(source, source.length)
        }
        if (sourceEnd.offset !== 0)
        {
          root.position = { start: { ...SOURCE_START }, end: { ...sourceEnd } }
        }
      }

      // template content roots are outside children; MDX data is never traversed
      const nodes: RootContent[] = [...root.children]
      while (nodes.length > 0)
      {
        const node = nodes.pop()!
        if (
          node.type === 'element' &&
          node.tagName === 'template' &&
          node.content
        )
        {
          roots.push(node.content)
        }
        if ('children' in node)
        {
          nodes.push(...node.children)
        }
      }
    }
    return result
  }
}
