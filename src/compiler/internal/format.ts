// src/compiler/internal/format.ts
// resolve whether a document compiles as lenient markdown or strict MDX

import * as path from 'path';
import type { CompilerConfig, DocumentFormat } from '../types';

// file extensions treated as plain (CommonMark) markdown
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd']);

// resolve the effective format ('md' | 'mdx') for a document
// explicit config.format wins; 'detect' (the default) derives from the
// documentPath extension so .md is lenient & .mdx is strict
export function resolveDocumentFormat(config: CompilerConfig): 'md' | 'mdx' {
  const format: DocumentFormat = config.format ?? 'detect';
  if (format === 'md' || format === 'mdx') {
    return format;
  }
  const ext = path.extname(config.documentPath ?? '').toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext) ? 'md' : 'mdx';
}
