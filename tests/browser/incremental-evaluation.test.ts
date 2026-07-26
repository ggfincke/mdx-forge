// tests/browser/incremental-evaluation.test.ts
// same-entry dependency, style, & invalidation transaction regressions

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllCaches,
  configureRuntime,
  evaluateModuleToComponent,
  invalidateModuleWithDependents,
  registry,
  setHostPreloadCallbacks,
  setModuleFetcher,
} from '../../src/browser/index';
import type { FetchResult } from '../../src/browser/types';

const ENTRY_CODE = [
  'const dep = require("./dep");',
  'module.exports = { default: () => dep.value };',
].join('\n');

function styleNodes(id: string): HTMLStyleElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLStyleElement>(
      `style[data-module-id="${id}"]`
    )
  );
}

beforeEach(() => {
  setHostPreloadCallbacks({});
  clearAllCaches();
  registry.configureLRU({
    maxModules: 100,
    maxMemoryBytes: 50 * 1024 * 1024,
    maxStyles: 100,
  });
  configureRuntime({
    maxConcurrentFetches: 8,
    maxModuleLoadDepth: 100,
    preloadAliases: {},
    runtime: {
      Fragment: null,
      jsx: () => null,
      jsxs: () => null,
    },
  });
});

describe('same-entry evaluation transactions', () => {
  it('retains unchanged CSS and replaces invalidated changed CSS once', async () => {
    let css = 'body { color: red; }';
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request === '/theme.css') {
          return {
            fsPath: '/theme.css',
            code: '',
            dependencies: [],
            css,
          };
        }
        return undefined;
      }
    );
    setModuleFetcher(fetcher);
    const code = [
      'require("/theme.css");',
      'module.exports = { default: () => null };',
    ].join('\n');

    await evaluateModuleToComponent(code, '/entry.mdx', ['/theme.css']);
    await evaluateModuleToComponent(code, '/entry.mdx', ['/theme.css']);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(styleNodes('/theme.css')).toHaveLength(1);
    expect(styleNodes('/theme.css')[0].textContent).toContain('red');

    css = 'body { color: blue; }';
    expect(invalidateModuleWithDependents('/theme.css')).toEqual(
      new Set(['/theme.css', '/entry.mdx'])
    );
    await evaluateModuleToComponent(code, '/entry.mdx', ['/theme.css']);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(styleNodes('/theme.css')).toHaveLength(1);
    expect(styleNodes('/theme.css')[0].textContent).toContain('blue');
  });

  it('reuses a resolved direct dependency on same-entry evaluation', async () => {
    const fetcher = vi.fn(
      async (): Promise<FetchResult | undefined> => ({
        fsPath: '/dep.js',
        code: 'module.exports = { value: "v1" };',
        dependencies: [],
      })
    );
    setModuleFetcher(fetcher);

    const first = await evaluateModuleToComponent(
      ENTRY_CODE,
      '/entry.mdx',
      ['./dep']
    );
    const second = await evaluateModuleToComponent(
      ENTRY_CODE,
      '/entry.mdx',
      ['./dep']
    );

    expect(first()).toBe('v1');
    expect(second()).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cascades dependency invalidation and fetches the replacement once', async () => {
    let version = 'v1';
    const fetcher = vi.fn(
      async (): Promise<FetchResult | undefined> => ({
        fsPath: '/dep.js',
        code: `module.exports = { value: "${version}" };`,
        dependencies: [],
      })
    );
    setModuleFetcher(fetcher);

    const first = await evaluateModuleToComponent(
      ENTRY_CODE,
      '/entry.mdx',
      ['./dep']
    );
    expect(first()).toBe('v1');

    version = 'v2';
    expect(invalidateModuleWithDependents('/dep.js')).toEqual(
      new Set(['/dep.js', '/entry.mdx'])
    );

    const second = await evaluateModuleToComponent(
      ENTRY_CODE,
      '/entry.mdx',
      ['./dep']
    );
    expect(second()).toBe('v2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
