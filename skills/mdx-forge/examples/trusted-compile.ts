// skills/mdx-forge/examples/trusted-compile.ts
// minimal compileTrusted end-to-end: MDX text -> executable JavaScript
//
// the resulting code runs in a browser via mdx-forge/browser
// (see browser-setup.ts for the browser side)

import { compileTrusted } from 'mdx-forge/compiler';

const source = `---
title: Hello
---

import { Callout } from 'mdx-forge/components/generic';

# Hello, Trusted Mode

<Callout type="info">
  This component is real React because the browser will evaluate the compiled JS.
</Callout>
`;

// signature: compileTrusted(mdxText, _isEntry, config)
// the middle boolean is currently unused but required positionally
const { code, frontmatter } = await compileTrusted(source, true, {
  documentPath: '/preview.mdx',
  componentsBuiltins: true,
});

console.log('frontmatter:', frontmatter);
console.log('code length:', code.length);

// the host is now responsible for:
// 1. shipping `code` to a browser context
// 2. computing the dependency list (typically by walking imports in `code`)
// 3. providing a setModuleFetcher that resolves each dependency
// 4. calling evaluateModuleToComponent(code, entryPath, dependencies)
