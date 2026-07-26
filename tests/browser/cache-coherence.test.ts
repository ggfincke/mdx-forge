// tests/browser/cache-coherence.test.ts
// T2: module dependency & CSS cache state stays coherent through eviction/reload

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureModuleLoader } from '../../src/browser/internal/runtime-config';
import { loadModule } from '../../src/browser/loader/loadModule';
import { registry } from '../../src/browser/registry/ModuleRegistry';
import {
  injectStyles,
  clearInjectedStyles,
} from '../../src/browser/styles/injectStyles';
import type { FetchResult } from '../../src/browser/types';

function resetState(): void {
  registry.clear();
  clearInjectedStyles();
  registry.configureLRU({
    maxModules: 2,
    maxMemoryBytes: 50 * 1024 * 1024,
    maxStyles: 100,
  });
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

function styleNodes(id: string): HTMLStyleElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLStyleElement>(
      `style[data-module-id="${id}"]`
    )
  );
}

describe('module dependency cache coherence (T2)', () => {
  beforeEach(() => {
    resetState();
  });

  it('never holds a dependent beside an evicted or replaced dependency', async () => {
    let bCode = 'module.exports = { token: "v1" };';
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request === './b') {
          return { fsPath: '/b.js', code: bCode, dependencies: [] };
        }
        return undefined;
      }
    );
    const A_CODE = 'module.exports = { b: require("./b") };';

    // non-promoting invariant: cached dependent implies cached dependency
    function expectNoOrphanedDependent(): void {
      if (registry.has('/a.js')) {
        expect(registry.has('/b.js')).toBe(true);
      }
    }

    // A retains B(v1) through its exports
    const a = await loadModule('/a.js', A_CODE, ['./b'], fetcher);
    expect((a.exports as { b: { token: string } }).b.token).toBe('v1');

    // apply eviction pressure beyond maxModules: 2, one entry at a time
    await loadModule('/c.js', 'module.exports = {};', [], fetcher);
    expectNoOrphanedDependent();
    await loadModule('/d.js', 'module.exports = {};', [], fetcher);
    expectNoOrphanedDependent();

    // dependent & dependency leave the cache together -> reload B(v2)
    bCode = 'module.exports = { token: "v2" };';
    const b2 = await loadModule('/b.js', bCode, [], fetcher);
    expect((b2.exports as { token: string }).token).toBe('v2');

    // reloaded dependent binds to the canonical B(v2) singleton, never A->v1
    const a2 = await loadModule('/a.js', A_CODE, ['./b'], fetcher);
    const a2Exports = a2.exports as { b: { token: string } };
    expect(a2Exports.b).toBe(b2.exports);
    expect(a2Exports.b.token).toBe('v2');
    expectNoOrphanedDependent();
  });

  it('pins sibling dependencies until the parent commits at maxModules 1', async () => {
    registry.configureLRU({ maxModules: 1 });
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request === './b') {
          return {
            fsPath: '/b.js',
            code: 'module.exports = { value: "b" };',
            dependencies: [],
          };
        }
        if (request === './c') {
          return {
            fsPath: '/c.js',
            code: 'module.exports = { value: "c" };',
            dependencies: [],
          };
        }
        return undefined;
      }
    );
    const code = [
      'const b = require("./b");',
      'const c = require("./c");',
      'module.exports = { value: b.value + c.value };',
    ].join('\n');

    const module = await loadModule('/entry.js', code, ['./b', './c'], fetcher);

    expect(module.exports).toEqual({ value: 'bc' });
    expect(registry.has('/b.js')).toBe(true);
    expect(registry.has('/c.js')).toBe(true);
  });
});

describe('CSS cache coherence (T2)', () => {
  beforeEach(() => {
    resetState();
  });

  it('evicts style DOM w/ its module & reloads changed CSS under the same ID', async () => {
    let css = 'body { color: red; }';
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request === './theme.css') {
          return { fsPath: '/theme.css', code: '', dependencies: [], css };
        }
        return undefined;
      }
    );

    await loadModule('/a.js', 'module.exports = {};', ['./theme.css'], fetcher);
    expect(styleNodes('/theme.css')).toHaveLength(1);
    expect(styleNodes('/theme.css')[0].textContent).toContain('red');

    // eviction pressure removes importer then css module; style follows module
    await loadModule('/c.js', 'module.exports = {};', [], fetcher);
    await loadModule('/d.js', 'module.exports = {};', [], fetcher);
    expect(registry.has('/theme.css')).toBe(false);
    expect(registry.hasInjectedStyle('/theme.css')).toBe(false);
    expect(styleNodes('/theme.css')).toHaveLength(0);

    // reload blue under the same ID -> exactly one blue style node
    css = 'body { color: blue; }';
    await loadModule(
      '/a2.js',
      'module.exports = {};',
      ['./theme.css'],
      fetcher
    );
    const nodes = styleNodes('/theme.css');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].textContent).toContain('blue');
    expect(nodes[0].textContent).not.toContain('red');
    expect(registry.hasInjectedStyle('/theme.css')).toBe(true);
    expect(registry.has('/theme.css')).toBe(true);
  });

  it('dedups unchanged bytes & replaces the node for changed bytes', () => {
    injectStyles('/s.css', '.a { color: red; }');
    injectStyles('/s.css', '.a { color: red; }');
    expect(styleNodes('/s.css')).toHaveLength(1);
    expect(styleNodes('/s.css')[0].textContent).toContain('red');

    injectStyles('/s.css', '.a { color: blue; }');
    const nodes = styleNodes('/s.css');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].textContent).toContain('blue');
    expect(nodes[0].textContent).not.toContain('red');
  });

  it('rolls back staged CSS when a sibling module fails', async () => {
    const fetcher = vi.fn(
      async (request: string): Promise<FetchResult | undefined> => {
        if (request === './theme.css') {
          return {
            fsPath: '/theme.css',
            code: '',
            dependencies: [],
            css: 'body { color: red; }',
          };
        }
        if (request === './bad') {
          return {
            fsPath: '/bad.js',
            code: 'throw new Error("bad sibling");',
            dependencies: [],
          };
        }
        return undefined;
      }
    );

    await expect(
      loadModule(
        '/entry.js',
        'module.exports = {};',
        ['./theme.css', './bad'],
        fetcher
      )
    ).rejects.toMatchObject({
      data: { code: 'EVALUATION_FAILED' },
    });

    expect(styleNodes('/theme.css')).toHaveLength(0);
    expect(registry.has('/theme.css')).toBe(false);
    expect(registry.hasInjectedStyle('/theme.css')).toBe(false);
    expect(registry.getStats().resolutions).toBe(0);
    expect(registry.getStats().dependents).toBe(0);
  });
});
