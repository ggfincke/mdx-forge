// tests/compiler/trusted-single-parse.test.ts
// layout injection decided inside the single MDX pipeline (PERF-F-1)

import { describe, expect, it } from 'vitest';
import { compileTrusted } from '../../src/compiler';
import type { CompilerConfig } from '../../src/compiler';

const config: CompilerConfig = {
  documentPath: '/workspace/test.mdx',
  componentsBuiltins: false,
  useHostMarkdownStyles: true,
};

describe('trusted single-parse layout detection', () => {
  it.each([
    {
      name: 'without an authored default export',
      source: '# Hello',
      hasInjectedLayout: true,
    },
    {
      name: 'with an authored default export',
      source:
        'export default function Layout({ children }) { return children }\n\n# Hello',
      hasInjectedLayout: false,
    },
  ])(
    'injects the layout only when needed $name',
    async ({ source, hasInjectedLayout }) => {
      const result = await compileTrusted(source, true, config);

      expect(result.code.includes('vscode-markdown-layout')).toBe(
        hasInjectedLayout
      );
    }
  );

  it('keeps original-document source lines w/ pipeline-injected layout', async () => {
    // frontmatter + injected layout: heading must still map to original line 4
    const result = await compileTrusted(
      '---\ntitle: x\n---\n# Heading',
      true,
      config
    );

    expect(result.code).toContain('vscode-markdown-layout');
    expect(result.code).toMatch(/data-source-line["']?\s*:\s*["']?4/);
  });
});
