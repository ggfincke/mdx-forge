// src/compiler/pipeline/rehype/source-line.ts
// annotate rendered elements w/ source line metadata for preview interactions

import { visit } from 'unist-util-visit';
import type { Root, Element } from 'hast';

const SOURCE_LINE_ATTR = 'data-source-line';

interface SourceLineFile {
  data: object;
}

export interface RehypeSourceLineOptions {
  sourceLineOffset?: number;
}

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

export function getSourceLineOffset(file?: SourceLineFile): number {
  const offset = (file?.data as { sourceLineOffset?: unknown } | undefined)
    ?.sourceLineOffset;
  return typeof offset === 'number' && Number.isFinite(offset) ? offset : 0;
}

function getNodeStartLine(
  node: Element,
  sourceLineOffset: number
): number | null {
  const line = node.position?.start?.line;
  if (typeof line !== 'number' || !Number.isFinite(line) || line <= 0) {
    return null;
  }
  const originalLine = line + sourceLineOffset;
  return originalLine > 0 ? originalLine : null;
}

// rehype plugin that adds data-source-line to elements using source positions
export default function rehypeSourceLine(
  options: RehypeSourceLineOptions = {}
) {
  return (tree: Root, file?: SourceLineFile) => {
    const sourceLineOffset =
      options.sourceLineOffset ?? getSourceLineOffset(file);

    visit(tree, 'element', (node: Element) => {
      if (SKIPPED_TAGS.has(node.tagName)) {
        return;
      }

      const line = getNodeStartLine(node, sourceLineOffset);
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
