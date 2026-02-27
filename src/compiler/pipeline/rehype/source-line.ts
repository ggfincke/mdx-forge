// src/compiler/pipeline/rehype/source-line.ts
// annotate rendered elements with source line metadata for preview interactions

import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

const SOURCE_LINE_ATTR = 'data-source-line';

// elements that should never receive source-line metadata
const SKIPPED_TAGS = new Set([
  'html',
  'head',
  'body',
  'script',
  'style',
  'meta',
  'link',
  'title',
]);

function getNodeStartLine(node: Element): number | null {
  const line = node.position?.start?.line;
  if (typeof line !== 'number' || !Number.isFinite(line) || line <= 0) {
    return null;
  }
  return line;
}

// rehype plugin that adds data-source-line to elements using source positions
export default function rehypeSourceLine() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (SKIPPED_TAGS.has(node.tagName)) {
        return;
      }

      const line = getNodeStartLine(node);
      if (!line) {
        return;
      }

      if (!node.properties) {
        node.properties = {};
      }

      // preserve pre-existing data-source-line when provided by earlier transforms
      if (node.properties[SOURCE_LINE_ATTR] === undefined) {
        node.properties[SOURCE_LINE_ATTR] = String(line);
      }
    });
  };
}
