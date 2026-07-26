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

const STAR_CASES = [
  {
    kind: 'relative',
    requests: ['./dep-0', './dep-1', './dep-2'],
    resolvedIds: ['/dep-0.js', '/dep-1.js', '/dep-2.js'],
  },
] as const;

function getDependencyEvaluations(): Record<string, number> {
  const scope = globalThis as typeof globalThis & {
    __mdxForgeDependencyEvaluations?: Record<string, number>;
  };
  scope.__mdxForgeDependencyEvaluations ??= {};
  return scope.__mdxForgeDependencyEvaluations;
}

function createEntryCode(
  requests: readonly string[],
  fail: boolean = false
): string {
  const values = requests.map(
    (request, index) => `require(${JSON.stringify(request)}).value`
  );
  return [
    `const values = [${values.join(',')}];`,
    fail
      ? 'throw new Error("entry evaluation failed");'
      : 'module.exports = { default: () => values.reduce((sum, value) => sum + value, 0) };',
  ].join('\n');
}

function createGraphFetcher(
  requests: readonly string[],
  resolvedIds: readonly string[],
  versions: Map<number, number>
) {
  return vi.fn(async (request: string): Promise<FetchResult | undefined> => {
    const index = requests.indexOf(request);
    if (index === -1) {
      return undefined;
    }
    const resolvedId = resolvedIds[index];
    const version = versions.get(index) ?? 1;
    return {
      fsPath: resolvedId,
      code: [
        `globalThis.__mdxForgeDependencyEvaluations[${JSON.stringify(resolvedId)}] =`,
        `(globalThis.__mdxForgeDependencyEvaluations[${JSON.stringify(resolvedId)}] ?? 0) + 1;`,
        `module.exports = { value: ${version} };`,
      ].join('\n'),
      dependencies: [],
    };
  });
}

function styleNodes(id: string): HTMLStyleElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLStyleElement>(
      `style[data-module-id="${id}"]`
    )
  );
}

beforeEach(() => {
  const scope = globalThis as typeof globalThis & {
    __mdxForgeDependencyEvaluations?: Record<string, number>;
  };
  delete scope.__mdxForgeDependencyEvaluations;
  getDependencyEvaluations();
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
  it('keeps legacy fetchers on the three-argument callback ABI', async () => {
    const fetcher = vi.fn(
      async (
        _request: string,
        _isBare: boolean,
        _parentId: string
      ): Promise<FetchResult | undefined> => ({
        fsPath: '/dep.js',
        code: 'module.exports = { value: "legacy" };',
        dependencies: [],
      })
    );
    setModuleFetcher(fetcher);

    const component = await evaluateModuleToComponent(
      ENTRY_CODE,
      '/legacy-entry.mdx',
      ['./dep']
    );

    expect(component()).toBe('legacy');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual([
      './dep',
      false,
      '/legacy-entry.mdx',
    ]);
  });

  it('rejects malformed dependencies before mutating runtime state', async () => {
    const sentinelExports = Object.freeze({ exact: 'state-sentinel' });
    registry.set(
      '/state-sentinel.js',
      {
        id: '/state-sentinel.js',
        exports: sentinelExports,
        loaded: true,
      },
      14
    );
    registry.setResolution(
      '/state-parent.mdx',
      './state-sentinel',
      '/state-sentinel.js'
    );
    registry.addDependency('/state-parent.mdx', '/state-sentinel.js');
    registry.trackStyleInjected(
      '/state-sentinel.js',
      '.state-sentinel { color: red; }'
    );
    const before = {
      generation: registry.generation,
      stats: registry.getStats(),
      resolution: registry.getResolution(
        '/state-parent.mdx',
        './state-sentinel'
      ),
      style: registry.getInjectedCss('/state-sentinel.js'),
    };

    await expect(
      evaluateModuleToComponent(
        'module.exports = { default: () => null };',
        '/malformed-entry.mdx',
        [
          {
            specifier: 'conditional-package',
            kind: 'import',
            runtimeRequest: '\0mdx-forge:import\0wrong-package',
          },
        ]
      )
    ).rejects.toThrow(
      'Structured module dependency has a non-canonical runtime request'
    );

    expect({
      generation: registry.generation,
      stats: registry.getStats(),
      resolution: registry.getResolution(
        '/state-parent.mdx',
        './state-sentinel'
      ),
      style: registry.getInjectedCss('/state-sentinel.js'),
    }).toEqual(before);
    expect(registry.get('/state-sentinel.js')?.exports).toBe(sentinelExports);
  });

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
    const fetcher = vi.fn(async (): Promise<FetchResult | undefined> => ({
      fsPath: '/dep.js',
      code: 'module.exports = { value: "v1" };',
      dependencies: [],
    }));
    setModuleFetcher(fetcher);

    const first = await evaluateModuleToComponent(ENTRY_CODE, '/entry.mdx', [
      './dep',
    ]);
    const second = await evaluateModuleToComponent(ENTRY_CODE, '/entry.mdx', [
      './dep',
    ]);

    expect(first()).toBe('v1');
    expect(second()).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cascades dependency invalidation and fetches the replacement once', async () => {
    let version = 'v1';
    const fetcher = vi.fn(async (): Promise<FetchResult | undefined> => ({
      fsPath: '/dep.js',
      code: `module.exports = { value: "${version}" };`,
      dependencies: [],
    }));
    setModuleFetcher(fetcher);

    const first = await evaluateModuleToComponent(ENTRY_CODE, '/entry.mdx', [
      './dep',
    ]);
    expect(first()).toBe('v1');

    version = 'v2';
    const generation = registry.generation;
    expect(invalidateModuleWithDependents('/dep.js')).toEqual(
      new Set(['/dep.js', '/entry.mdx'])
    );
    expect(registry.generation).toBe(generation + 1);

    const second = await evaluateModuleToComponent(ENTRY_CODE, '/entry.mdx', [
      './dep',
    ]);
    expect(second()).toBe('v2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(STAR_CASES)(
    'reuses unchanged $kind siblings after leaf invalidation',
    async ({ requests, resolvedIds }) => {
      const versions = new Map<number, number>();
      const fetcher = createGraphFetcher(requests, resolvedIds, versions);
      setModuleFetcher(fetcher);
      const entryPath = `/${requests[0].startsWith('.') ? 'relative' : 'bare'}/entry.mdx`;
      const code = createEntryCode(requests);

      const first = await evaluateModuleToComponent(code, entryPath, [
        ...requests,
      ]);
      expect(first()).toBe(3);

      versions.set(0, 2);
      expect(invalidateModuleWithDependents(resolvedIds[0])).toEqual(
        new Set([resolvedIds[0], entryPath])
      );
      expect(registry.getResolution(entryPath, requests[0])).toBeUndefined();
      expect(registry.getResolution(entryPath, requests[1])).toBe(
        resolvedIds[1]
      );
      expect(registry.getResolution(entryPath, requests[2])).toBe(
        resolvedIds[2]
      );

      const second = await evaluateModuleToComponent(code, entryPath, [
        ...requests,
      ]);
      expect(second()).toBe(4);
      expect(fetcher).toHaveBeenCalledTimes(4);
      expect(getDependencyEvaluations()).toEqual({
        [resolvedIds[0]]: 2,
        [resolvedIds[1]]: 1,
        [resolvedIds[2]]: 1,
      });
    }
  );

  it('removes retained mappings omitted by a successful reload', async () => {
    const requests = ['./changed', './removed', './kept'];
    const resolvedIds = ['/changed.js', '/removed.js', '/kept.js'];
    const versions = new Map<number, number>();
    const fetcher = createGraphFetcher(requests, resolvedIds, versions);
    setModuleFetcher(fetcher);
    const entryPath = '/removed-import/entry.mdx';

    await evaluateModuleToComponent(
      createEntryCode(requests),
      entryPath,
      requests
    );
    versions.set(0, 2);
    invalidateModuleWithDependents(resolvedIds[0]);

    const nextRequests = [requests[0], requests[2]];
    await evaluateModuleToComponent(
      createEntryCode(nextRequests),
      entryPath,
      nextRequests
    );

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(registry.getResolution(entryPath, requests[0])).toBe(resolvedIds[0]);
    expect(registry.getResolution(entryPath, requests[1])).toBeUndefined();
    expect(registry.getResolution(entryPath, requests[2])).toBe(resolvedIds[2]);
  });

  it('keeps stable hints but rolls back staged mappings after failure', async () => {
    const requests = ['./changed', './stable'];
    const resolvedIds = ['/changed.js', '/stable.js'];
    const versions = new Map<number, number>();
    const fetcher = createGraphFetcher(requests, resolvedIds, versions);
    setModuleFetcher(fetcher);
    const entryPath = '/failed-entry/entry.mdx';

    await evaluateModuleToComponent(
      createEntryCode(requests),
      entryPath,
      requests
    );
    versions.set(0, 2);
    invalidateModuleWithDependents(resolvedIds[0]);

    await expect(
      evaluateModuleToComponent(
        createEntryCode(requests, true),
        entryPath,
        requests
      )
    ).rejects.toThrow('Failed to evaluate module');
    expect(registry.getResolution(entryPath, requests[0])).toBeUndefined();
    expect(registry.getResolution(entryPath, requests[1])).toBe(resolvedIds[1]);

    const recovered = await evaluateModuleToComponent(
      createEntryCode(requests),
      entryPath,
      requests
    );
    expect(recovered()).toBe(3);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(getDependencyEvaluations()).toEqual({
      [resolvedIds[0]]: 2,
      [resolvedIds[1]]: 1,
    });
    expect(registry.getResolution(entryPath, requests[0])).toBe(resolvedIds[0]);
    expect(registry.getResolution(entryPath, requests[1])).toBe(resolvedIds[1]);
  });
});
