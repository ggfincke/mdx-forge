// tests/browser/async-coordination.test.ts
// T3: generation-safe async coordination & runtime budget validation

// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAllCaches,
  configureRuntime,
  ensureGenericShimsLoaded,
  evaluateModuleToComponent,
  loadModule,
  registry,
  setModuleFetcher,
  setHostPreloadCallbacks,
} from '../../src/browser/index';
import { getModuleLoaderConfig } from '../../src/browser/internal/runtime-config';
import type { FetchResult } from '../../src/browser/types';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const COMPONENT_CODE = 'module.exports = { default: () => null };';

beforeEach(() => {
  setHostPreloadCallbacks({});
  clearAllCaches();
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
  setModuleFetcher(async () => undefined);
});

describe('shim load generations (T3)', () => {
  it('waits for a newer shim load installed during an in-flight evaluation', async () => {
    const first = deferred();
    const second = deferred();
    const loads = [first, second];
    let call = 0;
    setHostPreloadCallbacks({
      ensureGenericShims: () => loads[call++].promise,
    });

    ensureGenericShimsLoaded(['One']);
    let settled = false;
    const evaluation = evaluateModuleToComponent(
      COMPONENT_CODE,
      '/entry.mdx',
      []
    ).then((component) => {
      settled = true;
      return component;
    });
    await flushMicrotasks();
    expect(settled).toBe(false);

    // newer generation installed while the first load is still pending
    ensureGenericShimsLoaded(['Two']);
    first.resolve();
    await flushMicrotasks();
    // erased-handle regression: evaluation must keep waiting for the newer load
    expect(settled).toBe(false);

    second.resolve();
    const component = await evaluation;
    expect(typeof component).toBe('function');
  });

  it('recovers after a rejected shim load', async () => {
    const failing = deferred();
    setHostPreloadCallbacks({
      ensureGenericShims: () => failing.promise,
    });

    ensureGenericShimsLoaded(['One']);
    const evaluation = evaluateModuleToComponent(
      COMPONENT_CODE,
      '/entry.mdx',
      []
    );
    failing.reject(new Error('shim load failed'));
    await expect(evaluation).rejects.toThrow('shim load failed');

    // rejected handle is cleared; a sequential evaluation succeeds
    const component = await evaluateModuleToComponent(
      COMPONENT_CODE,
      '/entry.mdx',
      []
    );
    expect(typeof component).toBe('function');
  });
});

describe('cache generations (T3)', () => {
  it('prevents a pre-clear in-flight load from repopulating cleared caches', async () => {
    const gate = deferred<FetchResult | undefined>();
    const fetcher = vi.fn(() => gate.promise);

    const load = loadModule(
      '/entry.js',
      'const d = require("./dep"); module.exports = { d };',
      ['./dep'],
      fetcher
    );
    await flushMicrotasks();

    clearAllCaches();
    expect(registry.getStats().modules).toBe(0);

    gate.resolve({
      fsPath: '/dep.js',
      code: 'module.exports = { value: 1 };',
      dependencies: [],
    });
    await expect(load).rejects.toMatchObject({
      data: { code: 'STALE_GENERATION' },
    });

    const stats = registry.getStats();
    expect(stats.modules).toBe(0);
    expect(stats.resolutions).toBe(0);
    expect(stats.dependents).toBe(0);
    expect(stats.pending).toBe(0);
  });

  it('loads normally in the new generation after a stale rejection', async () => {
    const gate = deferred<FetchResult | undefined>();
    const staleLoad = loadModule(
      '/entry.js',
      'const d = require("./dep"); module.exports = { d };',
      ['./dep'],
      () => gate.promise
    );
    await flushMicrotasks();
    clearAllCaches();
    gate.resolve({
      fsPath: '/dep.js',
      code: 'module.exports = { value: 1 };',
      dependencies: [],
    });
    await expect(staleLoad).rejects.toMatchObject({
      data: { code: 'STALE_GENERATION' },
    });

    const fresh = await loadModule(
      '/entry.js',
      'module.exports = { ok: true };',
      [],
      async () => undefined
    );
    expect((fresh.exports as { ok: boolean }).ok).toBe(true);
    expect(registry.getStats().modules).toBe(1);
  });
});

describe('runtime budget validation (T3)', () => {
  it('rejects zero, negative, and non-finite budgets immediately', () => {
    expect(() => configureRuntime({ maxConcurrentFetches: 0 })).toThrow(
      RangeError
    );
    expect(() => configureRuntime({ maxConcurrentFetches: -1 })).toThrow(
      RangeError
    );
    expect(() =>
      configureRuntime({ maxConcurrentFetches: Number.POSITIVE_INFINITY })
    ).toThrow(RangeError);
    expect(() => configureRuntime({ maxModuleLoadDepth: 0 })).toThrow(
      RangeError
    );
    expect(() => configureRuntime({ maxModuleLoadDepth: Number.NaN })).toThrow(
      RangeError
    );

    // failed configuration leaves prior budgets intact
    const config = getModuleLoaderConfig();
    expect(config.maxConcurrentFetches).toBe(8);
    expect(config.maxModuleLoadDepth).toBe(100);
  });
});
