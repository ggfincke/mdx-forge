// src/compiler/pipeline/common/mdx-common.ts
// shared utilities for MDX compilation (trusted & safe modes)

import type { FrontmatterResult, NextraPageMeta } from '../../types/compiler';
import { parseRawFrontmatter, safeMatter } from '../../../internal/frontmatter';

// extract frontmatter from MDX text w/ gray-matter (returns content & parsed data)
export function extractFrontmatter(mdxText: string): FrontmatterResult {
  const source = typeof mdxText === 'string' ? mdxText : String(mdxText);
  return toFrontmatterResult(source, safeMatter(source));
}

// preserve raw YAML keys for structured JSON validation
export function extractRawFrontmatter(mdxText: string): FrontmatterResult {
  const source = typeof mdxText === 'string' ? mdxText : String(mdxText);
  return toFrontmatterResult(source, parseRawFrontmatter(source));
}

function toFrontmatterResult(
  source: string,
  parsed: ReturnType<typeof safeMatter>
): FrontmatterResult {
  const bodyStart = computeBodyStartPosition(source, parsed.content);
  return {
    content: parsed.content,
    frontmatter: parsed.data as Record<string, unknown>,
    bodyStartLine: bodyStart.line,
    bodyStartColumn: bodyStart.column,
  };
}

interface BodyStartPosition {
  line: number;
  column: number;
}

// calc original-doc body start from gray-matter's stripped prefix
function computeBodyStartPosition(
  mdxText: string,
  content: string
): BodyStartPosition {
  if (!mdxText.endsWith(content)) {
    return { line: 1, column: 1 };
  }
  const stripped = mdxText.slice(0, mdxText.length - content.length);
  let line = 1;
  let column = 1;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === '\r') {
      line++;
      column = 1;
      if (stripped[i + 1] === '\n') {
        i++;
      }
      continue;
    }
    if (stripped[i] === '\n') {
      line++;
      column = 1;
      continue;
    }
    column++;
  }
  return { line, column };
}

// extract Nextra-specific frontmatter fields for page metadata
export function extractNextraFrontmatter(
  frontmatter: Record<string, unknown>
): Partial<NextraPageMeta> {
  const result: Partial<NextraPageMeta> = {};

  // sidebarTitle takes precedence over title
  if (typeof frontmatter.sidebarTitle === 'string') {
    result.title = frontmatter.sidebarTitle;
  } else if (typeof frontmatter.title === 'string') {
    result.title = frontmatter.title;
  }

  if (typeof frontmatter.description === 'string') {
    result.description = frontmatter.description;
  }

  if (
    typeof frontmatter.layout === 'string' &&
    ['default', 'full', 'raw'].includes(frontmatter.layout)
  ) {
    result.layout = frontmatter.layout as 'default' | 'full' | 'raw';
  }

  return result;
}
