// src/internal/frontmatter.ts
// gray-matter wrapper that disables executable JS frontmatter (eval) to prevent RCE

import matter from 'gray-matter';

// neutralize gray-matter's default `javascript` engine (runs eval) w/ a no-op
// covers `---js` & `---javascript` fences (engine aliases js -> javascript)
export function safeMatter(input: string) {
  return matter(input, {
    engines: {
      javascript: () => ({}),
    },
  });
}
