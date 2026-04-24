// skills/mdx-forge/examples/safe-compile.ts
// minimal compileSafe end-to-end: MDX text -> sanitized HTML

import { compileSafe } from 'mdx-forge/compiler';

const source = `---
title: Hello
---

# Hello, world

This is **MDX**, rendered via \`compileSafe()\`.

> [!NOTE]
> Unknown JSX components & expressions become inert placeholders in Safe Mode.
`;

const { html, frontmatter } = await compileSafe(source, {
  // documentPath anchors any relative-import resolution
  documentPath: '/preview.mdx',

  // optional: 'placeholder' (default), 'strip', or 'raw'
  componentsUnknownBehavior: 'placeholder',

  // optional: enable transformation of known generic components (default true)
  componentsBuiltins: true,
});

console.log('frontmatter:', frontmatter);
console.log('html length:', html.length);
console.log(html);
