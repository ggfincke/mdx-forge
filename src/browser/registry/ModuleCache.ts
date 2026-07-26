// src/browser/registry/ModuleCache.ts
// module cache w/ LRU eviction (count + memory based) & pending fetch tracking
// use shared LRUCache w/ isProtected for preloaded module protection

import { LRUCache } from '../internal/lru-cache';
import {
  DEFAULT_MAX_MODULES,
  DEFAULT_MAX_MEMORY_BYTES,
} from '../internal/constants';
import type { Module } from '../types';

// cache entry combining module w/ size estimate
interface CacheEntry {
  module: Module;
  estimatedSize: number;
}

const MAX_ESTIMATED_EXPORT_VALUES = 1_000;

// lru configuration options
export interface ModuleCacheConfig {
  maxModules?: number;
  maxMemoryBytes?: number;
}

// lru cache for evaluated modules w/ memory-aware eviction
// use shared LRUCache w/ isProtected predicate for preloaded module protection
// preloaded modules are protected from eviction & don't count against limits
export class ModuleCache {
  private cache: LRUCache<string, CacheEntry>;
  private pendingFetches: Map<string, Promise<Module>> = new Map();
  private preloadedIds: Set<string> = new Set();

  // eviction cleanup callback
  onEvict?: (id: string) => void;

  // extra protection predicate wired by ModuleRegistry
  // keeps dependencies of live cached modules out of automatic eviction
  isDependencyProtected?: (id: string) => boolean;

  constructor() {
    this.cache = new LRUCache<string, CacheEntry>({
      maxEntries: DEFAULT_MAX_MODULES,
      maxMemoryBytes: DEFAULT_MAX_MEMORY_BYTES,
      estimateSize: (entry) => entry.estimatedSize,
      isProtected: (id) =>
        this.preloadedIds.has(id) || this.isDependencyProtected?.(id) === true,
      onEvict: (id) => this.onEvict?.(id),
    });
  }

  // configure lru limits
  configure(options: ModuleCacheConfig): void {
    this.cache.updateSettings({
      maxEntries: options.maxModules,
      maxMemoryBytes: options.maxMemoryBytes,
    });
  }

  // get current memory usage in bytes
  get memoryBytes(): number {
    return this.cache.memoryBytes;
  }

  // get number of cached modules
  get size(): number {
    return this.cache.size;
  }

  // get number of preloaded modules
  get preloadedCount(): number {
    return this.preloadedIds.size;
  }

  // get number of pending fetches
  get pendingCount(): number {
    return this.pendingFetches.size;
  }

  // preload module (for built-in modules like React)
  // preloaded modules are protected from eviction & don't count against limits
  preload(id: string, exports: unknown): void {
    const estimatedSize = this.estimateExportsSize(exports);
    this.preloadedIds.add(id);
    this.cache.set(id, {
      module: { id, exports, loaded: true },
      estimatedSize,
    });
  }

  // estimate a preload batch before installing any of it
  preloadMany(entries: readonly { id: string; exports: unknown }[]): void {
    const prepared = entries.map(({ id, exports }) => ({
      id,
      exports,
      estimatedSize: this.estimateExportsSize(exports),
    }));

    for (const entry of prepared) {
      this.preloadedIds.add(entry.id);
      this.cache.set(entry.id, {
        module: { id: entry.id, exports: entry.exports, loaded: true },
        estimatedSize: entry.estimatedSize,
      });
    }
  }

  // get cached module (update lru position)
  get(id: string): Module | undefined {
    const entry = this.cache.get(id);
    return entry?.module;
  }

  // check if module is cached
  has(id: string): boolean {
    return this.cache.has(id);
  }

  // check if module is preloaded (protected from eviction)
  isPreloaded(id: string): boolean {
    return this.preloadedIds.has(id);
  }

  // set module in cache w/ automatic lru eviction
  set(id: string, module: Module, sourceByteLength: number = 0): void {
    const sourceFloor =
      Number.isFinite(sourceByteLength) && sourceByteLength > 0
        ? sourceByteLength
        : 0;
    const estimatedSize = Math.max(
      sourceFloor,
      this.estimateExportsSize(module.exports)
    );
    this.cache.set(id, { module, estimatedSize });
  }

  // delete module from cache, return the estimated size freed
  delete(id: string): number {
    if (this.preloadedIds.has(id)) {
      // don't delete preloaded modules
      return 0;
    }
    const entry = this.cache.peek(id);
    const freedSize = entry?.estimatedSize ?? 0;
    this.cache.delete(id);
    return freedSize;
  }

  // recursively estimate reachable export values w/ a hard work cap
  // evaluated source bytes provide the floor for opaque function closures
  private estimateExportsSize(exports: unknown): number {
    const pending: unknown[] = [exports];
    const visited = new Set<object>();
    let estimatedSize = 0;
    let visitedValues = 0;

    while (
      pending.length > 0 &&
      visitedValues < MAX_ESTIMATED_EXPORT_VALUES
    ) {
      const value = pending.pop();
      visitedValues++;

      if (value === null || value === undefined) {
        estimatedSize += 8;
        continue;
      }

      if (typeof value === 'string') {
        estimatedSize += value.length * 2 + 40;
        continue;
      }

      if (typeof value === 'function') {
        estimatedSize += 100;
        continue;
      }

      if (typeof value !== 'object') {
        estimatedSize += 8;
        continue;
      }

      if (visited.has(value)) {
        estimatedSize += 8;
        continue;
      }
      visited.add(value);
      estimatedSize += 40;

      for (const [key, descriptor] of Object.entries(
        Object.getOwnPropertyDescriptors(value)
      )) {
        estimatedSize += key.length * 2 + 8;
        if ('value' in descriptor) {
          pending.push(descriptor.value);
        }
      }
    }

    return Math.max(estimatedSize, 8);
  }

  // pending fetch management (for circular dependency detection)

  // get pending fetch promise
  getPending(id: string): Promise<Module> | undefined {
    return this.pendingFetches.get(id);
  }

  // set pending fetch promise
  setPending(id: string, promise: Promise<Module>): void {
    this.pendingFetches.set(id, promise);
  }

  // clear pending fetch
  clearPending(id: string, promise?: Promise<Module>): void {
    if (promise && this.pendingFetches.get(id) !== promise) {
      return;
    }
    this.pendingFetches.delete(id);
  }

  // bulk operations

  // clear all cached modules except preloaded ones
  clearNonPreloaded(): void {
    for (const id of this.cache.keys()) {
      if (!this.preloadedIds.has(id)) {
        this.cache.delete(id);
      }
    }
    this.pendingFetches.clear();
  }

  // clear all cached modules
  clear(): void {
    this.cache.clear();
    this.pendingFetches.clear();
    this.preloadedIds.clear();
  }
}
