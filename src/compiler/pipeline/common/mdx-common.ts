// src/compiler/pipeline/common/mdx-common.ts
// shared utilities for MDX compilation (trusted & safe modes)

import type { FrontmatterResult, NextraPageMeta } from '../../types/compiler';
import { safeMatter } from '../../../internal/frontmatter';

// extract frontmatter from MDX text w/ gray-matter (returns content & parsed data)
export function extractFrontmatter(mdxText: string): FrontmatterResult {
  const { content, data } = safeMatter(mdxText);
  return {
    content,
    frontmatter: data as Record<string, unknown>,
  };
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
