// skills/mdx-forge/examples/safe-document.ts
// compile untrusted MDX into closed host-rendered data

import { compileSafeDocument } from 'mdx-forge/compiler';

const source = `---
title: Architecture
---

# System map

<Hotspots metric="fanIn" limit={10} />
`;

const document = await compileSafeDocument(source, {
  components: {
    Hotspots: {
      props: {
        metric: { type: 'string', enum: ['fanIn', 'fanOut'] },
        limit: { type: 'number', integer: true, minimum: 1, maximum: 100 },
      },
      requiredProps: ['metric'],
      children: 'none',
    },
  },
});

if (document.diagnostics.some((item) => item.severity === 'error')) {
  throw new Error(JSON.stringify(document.diagnostics));
}

console.log(document.version, document.frontmatter, document.root);
