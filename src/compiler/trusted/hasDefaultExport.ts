// src/compiler/trusted/hasDefaultExport.ts
// check for default export in MDX content using regex patterns

import { safeMatter } from '../../internal/frontmatter';

// check if MDX source has default export (using regex patterns)
const hasDefaultExport = (source: string): boolean => {
  // strip frontmatter first
  const { content } = safeMatter(source);

  // common default export patterns in MDX/JSX
  const patterns = [
    /^export\s+default\s+/m,
    /^export\s*{\s*\w+\s+as\s+default\s*}/m,
  ];

  return patterns.some((pattern) => pattern.test(content));
};

export default hasDefaultExport;
