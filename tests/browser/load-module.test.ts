// tests/browser/load-module.test.ts
// module loader recovery & cycle detection regressions

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureModuleLoader } from '../../src/browser/internal/runtime-config';
import { loadModule } from '../../src/browser/loader/loadModule';
import { registry } from '../../src/browser/registry/ModuleRegistry';
import type { FetchResult } from '../../src/browser/types';

const ENTRY_CODE = [
  'const dep = require("./dep");',
  'module.exports = { value: dep.value };',
].join('\n');

function resetLoaderState(): void {
  registry.clear();
  configureModuleLoader({
    maxConcurrentFetches: 8,
    maxModuleLoadDepth: 100,
    preloadAliases: {},
    runtime: {
      Fragment: null,
      jsx: () => null,
      jsxs: () => null,
    },
  });
}

function waitForUnhandledRejectionTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('loadModule', () => {
  beforeEach(() => {
    resetLoaderState();
  });

  it('clears rejected in-flight fetches without secondary rejections', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    let calls = 0;
    const fetcher = vi.fn(async (): Promise<FetchResult | undefined> => {
      calls++;
      if (calls === 1) {
        throw new Error('temporary fetch failed');
      }
      return {
        fsPath: '/dep.js',
        code: 'module.exports = { value: "dep" };',
        dependencies: [],
      };
    });

    process.on('unhandledRejection', onUnhandled);
    try {
      await expect(
        loadModule('/entry.js', ENTRY_CODE, ['./dep'], fetcher)
      ).rejects.toThrow('temporary fetch failed');
      await waitForUnhandledRejectionTurn();

      const module = await loadModule(
        '/entry.js',
        ENTRY_CODE,
        ['./dep'],
        fetcher
      );
      const exports = module.exports as { value: string };

      expect(unhandled).toEqual([]);
      expect(exports.value).toBe('dep');
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('throws a targeted error for circular dependency chains', async () => {
    const fetcher = vi.fn(
      async (
        request: string,
        _isBare: boolean,
        parentId: string
      ): Promise<FetchResult | undefined> => {
        if (parentId === '/a.js' && request === './b') {
          return {
            fsPath: '/b.js',
            code: 'module.exports = {};',
            dependencies: ['./a'],
          };
        }
        if (parentId === '/b.js' && request === './a') {
          return {
            fsPath: '/a.js',
            code: 'module.exports = {};',
            dependencies: ['./b'],
          };
        }
      }
    );

    await expect(
      loadModule('/a.js', 'module.exports = {};', ['./b'], fetcher)
    ).rejects.toMatchObject({
      data: {
        code: 'CIRCULAR_DEPENDENCY',
        importChain: ['/a.js', '/b.js', '/a.js'],
      },
    });
    expect(registry.getStats().pending).toBe(0);
  });

  it('shares non-circular pending loads across dependency branches', async () => {
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request !== './a' && request !== './b') {
          return undefined;
        }
        return {
          fsPath: '/shared.js',
          code: 'module.exports = { value: "shared" };',
          dependencies: [],
        };
      }
    );
    const code = [
      'const a = require("./a");',
      'const b = require("./b");',
      'module.exports = { value: a.value + b.value };',
    ].join('\n');

    const module = await loadModule('/entry.js', code, ['./a', './b'], fetcher);
    const exports = module.exports as { value: string };

    expect(exports.value).toBe('sharedshared');
  });

  it('injects full MDX runtime (Fragment/jsx/jsxs/jsxDEV/useMDXComponents) + require', async () => {
    const Fragment = Symbol('Fragment');
    const jsx = (): null => null;
    const jsxs = (): null => null;
    const jsxDEV = (): null => null;
    const useMDXComponents = (): Record<string, unknown> => ({});
    registry.clear();
    configureModuleLoader({
      maxConcurrentFetches: 8,
      maxModuleLoadDepth: 100,
      preloadAliases: {},
      runtime: { Fragment, jsx, jsxs, jsxDEV, useMDXComponents },
    });

    const code = [
      'module.exports = {',
      '  Fragment: runtime.Fragment,',
      '  jsx: runtime.jsx,',
      '  jsxs: runtime.jsxs,',
      '  jsxDEV: runtime.jsxDEV,',
      '  useMDXComponents: runtime.useMDXComponents,',
      '  hasRequire: typeof require,',
      '};',
    ].join('\n');

    const module = await loadModule('/runtime.js', code, [], vi.fn());
    const captured = module.exports as Record<string, unknown>;

    expect(captured.Fragment).toBe(Fragment);
    expect(captured.jsx).toBe(jsx);
    expect(captured.jsxs).toBe(jsxs);
    expect(captured.jsxDEV).toBe(jsxDEV);
    expect(captured.useMDXComponents).toBe(useMDXComponents);
    expect(captured.hasRequire).toBe('function');
  });
});
