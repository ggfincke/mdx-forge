// tests/browser/load-module.test.ts
// module loader recovery & cycle detection regressions

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureModuleLoader } from '../../src/browser/internal/runtime-config';
import { createImportRuntimeRequest } from '../../src/browser/internal/dependency';
import { loadModule } from '../../src/browser/loader/loadModule';
import { registry } from '../../src/browser/registry/ModuleRegistry';
import type {
  FetchResult,
  ModuleDependency,
  ModuleDependencyKind,
} from '../../src/browser/types';

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

  it('rejects cross-branch pending cycles instead of deadlocking', async () => {
    const fetcher = vi.fn(
      async (
        request: string,
        _isBare: boolean,
        parentId: string
      ): Promise<FetchResult | undefined> => {
        const modules: Record<string, FetchResult> = {
          '/a.js\0./b': {
            fsPath: '/b.js',
            code: 'module.exports = {};',
            dependencies: ['./c'],
          },
          '/a.js\0./c': {
            fsPath: '/c.js',
            code: 'module.exports = {};',
            dependencies: ['./b'],
          },
          '/b.js\0./c': {
            fsPath: '/c.js',
            code: 'module.exports = {};',
            dependencies: ['./b'],
          },
          '/c.js\0./b': {
            fsPath: '/b.js',
            code: 'module.exports = {};',
            dependencies: ['./c'],
          },
        };
        return modules[`${parentId}\0${request}`];
      }
    );

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutGuard = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('cycle timed out')), 1_000);
    });

    try {
      await expect(
        Promise.race([
          loadModule('/a.js', 'module.exports = {};', ['./b', './c'], fetcher),
          timeoutGuard,
        ])
      ).rejects.toMatchObject({
        data: {
          code: 'CIRCULAR_DEPENDENCY',
        },
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }

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

  it('loads import & require export branches without request collisions', async () => {
    const importRequest = createImportRuntimeRequest('dual-package');
    expect(importRequest).toBe('\0mdx-forge:import\0dual-package');
    const importDependency: ModuleDependency = {
      specifier: 'dual-package',
      kind: 'import',
      runtimeRequest: importRequest,
    };
    const requireDependency: ModuleDependency = {
      specifier: 'dual-package',
      kind: 'require',
      runtimeRequest: 'dual-package',
    };
    const code = [
      `const imported = require(${JSON.stringify(importRequest)});`,
      'const required = require("dual-package");',
      'module.exports = { imported: imported.value, required: required.value };',
    ].join('\n');

    const fetcher = vi.fn(
      async (
        _request: string,
        _isBare: boolean,
        _parentId: string,
        kind?: ModuleDependencyKind
      ): Promise<FetchResult | undefined> => ({
        fsPath: `/dual-${kind}.js`,
        code: `module.exports = { value: ${JSON.stringify(kind)} };`,
        dependencies: [],
      })
    );

    const module = await loadModule(
      '/entry.js',
      code,
      [importDependency, requireDependency],
      fetcher
    );

    expect(module.exports).toEqual({
      imported: 'import',
      required: 'require',
    });
    expect(fetcher.mock.calls).toEqual([
      ['dual-package', true, '/entry.js', 'import'],
      ['dual-package', true, '/entry.js', 'require'],
    ]);
    expect(registry.getResolution('/entry.js', importRequest)).toBe(
      '/dual-import.js'
    );
    expect(registry.getResolution('/entry.js', 'dual-package')).toBe(
      '/dual-require.js'
    );

    resetLoaderState();
    const legacyFetcher = vi.fn(async (): Promise<FetchResult | undefined> => ({
      fsPath: '/legacy.js',
      code: 'module.exports = { value: "legacy" };',
      dependencies: [],
    }));
    await loadModule(
      '/legacy-entry.js',
      'module.exports = require("dual-package");',
      ['dual-package'],
      legacyFetcher
    );
    expect(legacyFetcher.mock.calls).toEqual([
      ['dual-package', true, '/legacy-entry.js'],
    ]);

    resetLoaderState();
    const malformedDependency: ModuleDependency = {
      specifier: 'other-package',
      kind: 'import',
      runtimeRequest: importRequest,
    };
    const malformedFetcher = vi.fn(async () => undefined);

    await expect(
      loadModule(
        '/malformed-entry.js',
        code,
        [importDependency, malformedDependency],
        malformedFetcher
      )
    ).rejects.toThrow('non-canonical runtime request');
    expect(malformedFetcher).not.toHaveBeenCalled();
    expect(registry.get('/malformed-entry.js')).toBeUndefined();
    expect(registry.getStats().resolutions).toBe(0);
  });

  it('discards metadata staged by a parent that fails evaluation', async () => {
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request === './b') {
          return {
            fsPath: '/b.js',
            code: 'module.exports = { value: "b" };',
            dependencies: [],
          };
        }
        return undefined;
      }
    );

    await expect(
      loadModule(
        '/a.js',
        'require("./b"); throw new Error("parent failed");',
        ['./b'],
        fetcher
      )
    ).rejects.toMatchObject({
      data: { code: 'EVALUATION_FAILED' },
    });

    const retried = await loadModule(
      '/a.js',
      'module.exports = { ok: true };',
      [],
      fetcher
    );
    const invalidated = registry.invalidateWithDependents('/b.js');

    expect(invalidated).toEqual(new Set(['/b.js']));
    expect(registry.get('/a.js')).toBe(retried);
    expect(registry.getStats().resolutions).toBe(0);
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
