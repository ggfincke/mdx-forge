// src/compiler/internal/format.ts
// resolve whether a document compiles as lenient markdown or strict MDX

import * as path from 'path';
import type { CompilerConfig, DocumentFormat } from '../types';

// file extensions treated as plain (CommonMark) markdown
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd']);

// control chars (incl. NUL) that should never appear in a real document path
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f]/;

// resolve the effective format ('md' | 'mdx') for a document
// explicit config.format wins; 'detect' (the default) derives from the
// documentPath extension so .md is lenient & .mdx is strict
export function resolveDocumentFormat(config: CompilerConfig): 'md' | 'mdx' {
  const format: DocumentFormat = config.format ?? 'detect';
  if (format === 'md' || format === 'mdx') {
    return format;
  }
  const docPath = config.documentPath ?? '';
  // a path w/ control chars (e.g. embedded NUL) is suspect — fail closed to
  // strict MDX so extension confusion can't downgrade to the lenient parser
  if (CONTROL_CHARS.test(docPath)) {
    return 'mdx';
  }
  const ext = path.extname(docPath).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(ext) ? 'md' : 'mdx';
}
