// tests/compiler/shiki-fences.test.ts
// T4: fence meta (F9), demand-driven grammars (F25) & block-result cache (F26)

import { describe, it, expect, beforeEach } from 'vitest';
import type { Root, Element, Text } from 'hast';
import { compileSafe } from '../../src/compiler/index';
import type { CompilerConfig } from '../../src/compiler/index';
import rehypeShiki, {
  __highlightCacheStats,
  __resetHighlightState,
  __setHighlightCacheLimits,
} from '../../src/compiler/pipeline/rehype/shiki';

// create library-native CompilerConfig
function createConfig(overrides: Partial<CompilerConfig> = {}): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  };
}

// build a minimal hast tree containing one pre>code fence
function fenceTree(code: string, lang: string): Root {
  return {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: [`language-${lang}`] },
            children: [{ type: 'text', value: code }],
          },
        ],
      },
    ],
  } as Root;
}

// run the rehype-shiki transformer directly on a tree
async function runShiki(tree: Root): Promise<Root> {
  const transformer = rehypeShiki() as (t: Root) => Promise<void>;
  await transformer(tree);
  return tree;
}

// extract the shiki-rendered pre element markup boundary for parity checks
function extractShikiPre(html: string): string | undefined {
  return /<pre class="shiki[\s\S]*?<\/pre>/.exec(html)?.[0];
}

beforeEach(() => {
  __resetHighlightState();
});

describe('fence metadata (F9)', () => {
  it('renders title, line numbers & highlight ranges from fence meta', async () => {
    const result = await compileSafe(
      '```ts title="example.ts" showLineNumbers {1,3-4}\nconst a=1\nconst b=2\nconst c=3\nconst d=4\n```',
      createConfig()
    );

    expect(result.html).toContain('mdx-preview-codeblock-title');
    expect(result.html).toContain('example.ts');
    expect(result.html).toContain('with-line-numbers');
    expect(result.html).toContain('data-highlight-lines="1,3,4"');
    // wrapper exposes the title for tab-label derivation (e.g. CodeGroup)
    expect(result.html).toContain('data-title="example.ts"');
  });

  it('parses the title using its matching quote delimiter', async () => {
    const apostrophe = await compileSafe(
      '```ts title="Bob\'s file.ts"\nconst a=1\n```',
      createConfig()
    );
    const doubleQuote = await compileSafe(
      '```ts title=\'Bob "file".ts\'\nconst a=1\n```',
      createConfig()
    );

    // attribute value is entity-encoded; the title div carries the raw text
    expect(apostrophe.html).toContain('data-title="Bob&#x27;s file.ts"');
    expect(apostrophe.html).toContain("<div class=\"mdx-preview-codeblock-title\">Bob's file.ts</div>");
    expect(doubleQuote.html).toContain('data-title=');
    expect(doubleQuote.html).toContain('Bob "file".ts');
  });

  it('ignores subtitle & malformed title metadata', async () => {
    const subtitle = await compileSafe(
      '```ts subtitle="wrong.ts"\nconst a=1\n```',
      createConfig()
    );
    const malformed = await compileSafe(
      '```ts title="unfinished.ts\nconst a=1\n```',
      createConfig()
    );

    expect(subtitle.html).not.toContain('data-title');
    expect(subtitle.html).not.toContain('mdx-preview-codeblock-title');
    expect(malformed.html).not.toContain('data-title');
    expect(malformed.html).not.toContain('mdx-preview-codeblock-title');
  });

  it('clamps huge ranges to the real line count', async () => {
    const result = await compileSafe(
      '```ts {1-999999999}\nconst a=1\nconst b=2\n```',
      createConfig()
    );

    expect(result.html).toContain('data-highlight-lines="1,2"');
  });

  it('drops reversed & out-of-range parts', async () => {
    const reversed = await compileSafe(
      '```ts {5-3}\nconst a=1\n```',
      createConfig()
    );
    expect(reversed.html).not.toContain('data-highlight-lines');

    const outOfRange = await compileSafe(
      '```ts {99}\nconst a=1\n```',
      createConfig()
    );
    expect(outOfRange.html).not.toContain('data-highlight-lines');
  });
});

describe('demand-driven highlighting (F25)', () => {
  it('language aliases produce identical highlighted output', async () => {
    const code = '```js\nconst x = 1;\n```';
    const canonical = '```javascript\nconst x = 1;\n```';

    const aliased = await compileSafe(code, createConfig());
    const full = await compileSafe(canonical, createConfig());

    const aliasedPre = extractShikiPre(aliased.html);
    const fullPre = extractShikiPre(full.html);
    expect(aliasedPre).toBeDefined();
    expect(aliasedPre).toBe(fullPre);
  });

  it('highlights representative languages via on-demand grammars', async () => {
    const cases = [
      ['python', 'def greet():\n    return 1'],
      ['bash', 'echo "hello"'],
      ['tsx', 'const El = () => <div>x</div>;'],
    ] as const;

    for (const [lang, code] of cases) {
      const result = await compileSafe(
        `\`\`\`${lang}\n${code}\n\`\`\``,
        createConfig()
      );
      expect(result.html).toContain(`data-language="${lang}"`);
      // token spans prove a real grammar ran, not the plaintext path
      expect(result.html).toContain('--shiki-token-');
    }
  });

  it('unsupported & unlabeled fences fall back to plaintext w/o grammar or cache cost', async () => {
    const unknown = await compileSafe(
      '```notareallanguage123\nplain body\n```',
      createConfig()
    );
    expect(unknown.html).toContain('class="shiki css-variables"');
    expect(unknown.html).toContain('data-language="notareallanguage123"');

    const unlabeled = await compileSafe('```\njust text\n```', createConfig());
    expect(unlabeled.html).toContain('class="shiki css-variables"');

    // plaintext fast path never populates the block cache
    expect(__highlightCacheStats().entries).toBe(0);
  });
});

describe('block-result cache (F26)', () => {
  it('reuses the cached template on warm repeats w/ identical output', async () => {
    const doc = '```ts\nconst warm = true;\n```';

    const first = await compileSafe(doc, createConfig());
    expect(__highlightCacheStats().entries).toBe(1);

    const second = await compileSafe(doc, createConfig());
    expect(__highlightCacheStats().entries).toBe(1);
    expect(second.html).toBe(first.html);
  });

  it('mutating returned HAST does not poison the cached template', async () => {
    const code = 'const isolated = 42;';

    const tree = await runShiki(fenceTree(code, 'typescript'));

    // mutate every text node in the returned tree
    const poison = (node: Element | Root): void => {
      for (const child of node.children ?? []) {
        if (child.type === 'text') {
          (child as Text).value = 'POISONED';
        } else if (child.type === 'element') {
          poison(child);
        }
      }
    };
    poison(tree);
    expect(JSON.stringify(tree)).toContain('POISONED');

    // a fresh run of the same fence must not see the mutation
    const fresh = await runShiki(fenceTree(code, 'typescript'));
    expect(JSON.stringify(fresh)).not.toContain('POISONED');
    expect(JSON.stringify(fresh)).toContain('isolated');
  });

  it('evicts by entry count', async () => {
    __setHighlightCacheLimits({ maxEntries: 2 });

    for (let i = 0; i < 4; i++) {
      await runShiki(fenceTree(`const distinct${i} = ${i};`, 'typescript'));
    }

    expect(__highlightCacheStats().entries).toBeLessThanOrEqual(2);
  });

  it('evicts by byte budget', async () => {
    __setHighlightCacheLimits({ maxMemoryBytes: 4096 });

    for (let i = 0; i < 4; i++) {
      const big = `const filler${i} = "${'x'.repeat(400)}";`;
      await runShiki(fenceTree(big, 'typescript'));
    }

    expect(__highlightCacheStats().bytes).toBeLessThanOrEqual(4096);
  });
});
