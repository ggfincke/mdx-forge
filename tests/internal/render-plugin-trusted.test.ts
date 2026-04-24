// tests/internal/render-plugin-trusted.test.ts
// unit tests for the Trusted Mode compile helpers (no Playwright required)

import { describe, expect, it } from 'vitest';
import { transform } from 'esbuild';
import { compileTrusted } from '../../src/compiler';

const IMPORT_SPECIFIER_PATTERN =
  /^\s*import\s+(?:[^'"]+?\s+from\s+)?['"]([^'"\n]+)['"]\s*;?\s*$/gm;

function extractDependencies(esmCode: string): string[] {
  const deps = new Set<string>();
  for (const match of esmCode.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    deps.add(match[1]);
  }
  return Array.from(deps);
}

describe('render plugin trusted compile pipeline', () => {
  it('emits only react, jsx-runtime & @mdx-js/react imports when builtins are disabled', async () => {
    const result = await compileTrusted('# Hello\n\nParagraph.', true, {
      documentPath: '/virtual/x.mdx',
      componentsBuiltins: false,
    });

    const deps = extractDependencies(result.code);
    expect(new Set(deps)).toEqual(
      new Set(['react', 'react/jsx-runtime', '@mdx-js/react']),
    );
  });

  it('leaves JSX-tag references unresolved so MDXProvider can supply them at render time', async () => {
    const result = await compileTrusted('<Tabs><TabItem>x</TabItem></Tabs>', true, {
      documentPath: '/virtual/x.mdx',
      componentsBuiltins: false,
    });

    // when builtins are off, MDX generates runtime lookups via _components
    // rather than bare imports like `import _builtin_Tabs from 'Tabs'`
    const deps = extractDependencies(result.code);
    expect(deps).not.toContain('Tabs');
    expect(deps).not.toContain('TabItem');
    expect(result.code).toContain('_missingMdxReference');
  });

  it('preserves frontmatter alongside the compiled ESM module', async () => {
    const source = '---\ntitle: Hi\ncount: 3\n---\n\n# Body\n';
    const result = await compileTrusted(source, true, {
      documentPath: '/virtual/x.mdx',
      componentsBuiltins: false,
    });

    expect(result.frontmatter).toEqual({ title: 'Hi', count: 3 });
  });

  it('transforms MDX output to CJS with require() calls that match the ESM imports', async () => {
    const mdx = await compileTrusted('# Test\n\nHello world.', true, {
      documentPath: '/virtual/x.mdx',
      componentsBuiltins: false,
    });

    const cjs = await transform(mdx.code, {
      loader: 'js',
      format: 'cjs',
      target: 'chrome120',
      sourcemap: false,
    });

    // every ESM import specifier should appear as a require() target
    const deps = extractDependencies(mdx.code);
    for (const dep of deps) {
      expect(cjs.code).toContain(`require("${dep}")`);
    }

    // the module must populate its default export for loadModule to pick up
    expect(cjs.code).toMatch(/module\.exports|exports\.default/);
    expect(cjs.code).not.toMatch(/^\s*import\s/m);
  });
});
