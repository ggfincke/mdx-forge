// src/compiler/pipeline/common/mdx-common.ts
// shared utilities for MDX compilation (trusted & safe modes)

import type { FrontmatterResult, NextraPageMeta } from '../../types/compiler';
import { safeMatter } from '../../../internal/frontmatter';

// extract frontmatter from MDX text w/ gray-matter (returns content & parsed data)
export function extractFrontmatter(mdxText: string): FrontmatterResult {
  const parsed = safeMatter(mdxText);
  return {
    content: parsed.content,
    frontmatter: parsed.data as Record<string, unknown>,
    bodyStartLine: computeBodyStartLine(mdxText, parsed.content),
  };
}

// 1-based original-doc line where the body begins; 1 w/o frontmatter
// derived from gray-matter's actual stripped prefix so empty & trailing-ws fences
// stay correct (a trim-based --- scan diverges from gray-matter's stripping rule)
function computeBodyStartLine(mdxText: string, content: string): number {
  if (content === mdxText || !mdxText.endsWith(content)) {
    return 1;
  }
  const stripped = mdxText.slice(0, mdxText.length - content.length);
  return (stripped.match(/\n/g)?.length ?? 0) + 1;
}

// Nextra-specific frontmatter keys (sidebarTitle takes precedence over title)
export const NEXTRA_FRONTMATTER_KEYS = [
  'title',
  'sidebarTitle',
  'description',
  'layout',
] as const;

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
