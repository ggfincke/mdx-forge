// src/compiler/pipeline/rehype/fence-meta.ts
// preserve fence meta across rehype-raw (parse5 drops hast data fields)

import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

// copy code.data.meta into a data-meta property before rehype-raw runs
// rehype-shiki consumes data.meta or this property & replaces the block
export default function rehypeFenceMeta() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'code') {
        return;
      }
      const meta = (node.data as { meta?: unknown } | undefined)?.meta;
      if (typeof meta === 'string' && meta.length > 0) {
        // camelCase hast property name (serializes as the data-meta attribute)
        node.properties = { ...node.properties, dataMeta: meta };
      }
    });
  };
}
