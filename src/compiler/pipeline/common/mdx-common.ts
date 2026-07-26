// src/compiler/pipeline/common/mdx-common.ts
// compiler frontmatter facade & Nextra page-metadata adapter

import type { FrontmatterResult, NextraPageMeta } from '../../types/compiler'
import {
  extractFrontmatter as extractNeutralFrontmatter,
  type ExtractedFrontmatter,
} from '../../../internal/frontmatter'

// expose neutral extraction through the public compiler contract
export function extractFrontmatter(mdxText: string): FrontmatterResult
{
  return toFrontmatterResult(extractNeutralFrontmatter(mdxText))
}

function toFrontmatterResult(
  extracted: ExtractedFrontmatter
): FrontmatterResult
{
  return {
    content: extracted.content,
    frontmatter: extracted.frontmatter,
    bodyStartLine: extracted.bodyOrigin.line,
    bodyStartColumn: extracted.bodyOrigin.column,
  }
}

// extract Nextra-specific frontmatter fields for page metadata
export function extractNextraFrontmatter(
  frontmatter: Record<string, unknown>
): Partial<NextraPageMeta>
{
  const result: Partial<NextraPageMeta> = {}

  // sidebarTitle takes precedence over title
  if (typeof frontmatter.sidebarTitle === 'string')
  {
    result.title = frontmatter.sidebarTitle
  }
  else if (typeof frontmatter.title === 'string')
  {
    result.title = frontmatter.title
  }

  if (typeof frontmatter.description === 'string')
  {
    result.description = frontmatter.description
  }

  if (typeof frontmatter.toc === 'boolean')
  {
    result.toc = frontmatter.toc
  }

  if (
    typeof frontmatter.layout === 'string' &&
    ['default', 'full', 'raw'].includes(frontmatter.layout)
  )
  {
    result.layout = frontmatter.layout as 'default' | 'full' | 'raw'
  }

  return result
}
