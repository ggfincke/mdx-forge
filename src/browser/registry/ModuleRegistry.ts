// src/browser/registry/ModuleRegistry.ts
// facade over ModuleCache, StyleCache & DependencyTracker subsystems

import type { Module } from '../types';
import { getStyleInjector } from '../internal/style-injector';
import { ModuleCache, type ModuleCacheConfig } from './ModuleCache';
import { StyleCache, type StyleCacheConfig } from './StyleCache';
import { DependencyTracker } from './DependencyTracker';

// lru configuration options
export interface LRUConfig extends ModuleCacheConfig, StyleCacheConfig {}

// coordinate module cache, style cache & dependency tracker
// ModuleCache owns modules; a cached CSS module owns its injected style
// DependencyTracker owns dependency graph & resolution map
export class ModuleRegistry {
  private moduleCache = new ModuleCache();
  private styleCache = new StyleCache();
  private dependencyTracker = new DependencyTracker();
  private provisionalDependencyPins = new Map<string, Set<symbol>>();

  // cache generation; bumped at every clear boundary so in-flight loads
  // from an older generation cannot commit stale state
  private cacheGeneration = 0;

  constructor() {
    // wire up eviction callback for coordinated cleanup
    // module removal also removes its owned style (tracking + DOM node)
    this.moduleCache.onEvict = (id: string) => {
      this.dependencyTracker.cleanDependentsFor(id);
      this.dependencyTracker.cleanResolutionMapFor(id);
      this.styleCache.untrackStyle(id);
    };
    // dependencies of live cached modules never auto-evict (graph coherence)
    this.moduleCache.isDependencyProtected = (id: string) =>
      this.dependencyTracker.hasDependents(id) ||
      this.provisionalDependencyPins.has(id);
    // style eviction removes the DOM node; live owning module protects style
    this.styleCache.onEvict = (id: string) =>
      getStyleInjector().removeModuleCss(id);
    this.styleCache.isProtected = (id: string) => this.moduleCache.has(id);
  }

  // current cache generation for stale-commit detection
  get generation(): number {
    return this.cacheGeneration;
  }

  // lru configuration

  // configure lru limits for modules & styles
  configureLRU(options: LRUConfig): void {
    this.moduleCache.configure(options);
    this.styleCache.configure(options);
  }

  // module cache operations (delegated to ModuleCache)

  // preload module (for built-in modules like React)
  // preloaded modules are protected from eviction & don't count against memory limit
  preload(id: string, exports: unknown): void {
    this.moduleCache.preload(id, exports);
  }

  // preload a validated batch after all export sizes are known
  preloadMany(entries: readonly { id: string; exports: unknown }[]): void {
    this.moduleCache.preloadMany(entries);
  }

  // get cached module (update access time for lru)
  get(id: string): Module | undefined {
    return this.moduleCache.get(id);
  }

  // check if module is cached
  has(id: string): boolean {
    return this.moduleCache.has(id);
  }

  // check if module is preloaded (protected from eviction)
  isPreloaded(id: string): boolean {
    return this.moduleCache.isPreloaded(id);
  }

  // set module in cache w/ lru eviction (memory-based + count-based)
  set(id: string, module: Module, sourceByteLength: number = 0): void {
    this.moduleCache.set(id, module, sourceByteLength);
  }

  // pending fetch operations (delegated to ModuleCache)

  // get pending fetch promise (for circular dependency detection)
  getPending(id: string): Promise<Module> | undefined {
    return this.moduleCache.getPending(id);
  }

  // set pending fetch promise
  setPending(id: string, promise: Promise<Module>): void {
    this.moduleCache.setPending(id, promise);
  }

  // clear pending fetch
  clearPending(id: string, promise?: Promise<Module>): void {
    this.moduleCache.clearPending(id, promise);
  }

  // invalidation (coordinated across subsystems)

  // invalidate cached module (for hot reload)
  // clean up all related metadata to prevent memory leaks
  invalidate(id: string): void {
    // delete from cache; onEvict removes tracker metadata & owned style
    this.moduleCache.delete(id);
    // clean up dependency tracking
    this.dependencyTracker.cleanDependentsFor(id);
    this.dependencyTracker.cleanResolutionMapFor(id);
    // clean up pending fetch
    this.moduleCache.clearPending(id);
  }

  // invalidate module & all modules that depend on it (cascade)
  // clean up all related metadata to prevent memory leaks
  invalidateWithDependents(id: string): Set<string> {
    const invalidated = this.dependencyTracker.invalidateWithDependents(id);

    // delete all invalidated modules from cache
    for (const moduleId of invalidated) {
      this.moduleCache.delete(moduleId);
      this.moduleCache.clearPending(moduleId);
    }

    return invalidated;
  }

  // dependency operations (delegated to DependencyTracker)

  // record that moduleId depends on dependsOnId
  addDependency(moduleId: string, dependsOnId: string): void {
    this.dependencyTracker.addDependency(moduleId, dependsOnId);
  }

  // pin a future dependency before its recursive load can trigger eviction
  protectProvisionalDependency(id: string): symbol {
    const token = Symbol(id);
    const pins = this.provisionalDependencyPins.get(id) ?? new Set<symbol>();
    pins.add(token);
    this.provisionalDependencyPins.set(id, pins);
    return token;
  }

  // release one parent transaction's provisional dependency ownership
  releaseProvisionalDependency(id: string, token: symbol): void {
    const pins = this.provisionalDependencyPins.get(id);
    if (!pins) {
      return;
    }
    pins.delete(token);
    if (pins.size === 0) {
      this.provisionalDependencyPins.delete(id);
    }
  }

  // commit staged graph metadata & the module without yielding between writes
  commitModule(
    id: string,
    module: Module,
    dependencies: ReadonlySet<string>,
    resolutions: ReadonlyMap<string, string>,
    sourceByteLength: number
  ): void {
    this.moduleCache.set(id, module, sourceByteLength);
    for (const [request, fsPath] of resolutions) {
      this.dependencyTracker.setResolution(id, request, fsPath);
    }
    for (const dependsOnId of dependencies) {
      this.dependencyTracker.addDependency(id, dependsOnId);
    }
  }

  // clear the dependency graph (but keep module cache)
  clearDependencies(): void {
    this.dependencyTracker.clearDependencies();
  }

  // resolution map operations (delegated to DependencyTracker)

  // register a resolved path for a (parent, request) pair
  setResolution(parentId: string, request: string, fsPath: string): void {
    this.dependencyTracker.setResolution(parentId, request, fsPath);
  }

  // get resolved fsPath for a (parent, request) pair
  getResolution(parentId: string, request: string): string | undefined {
    return this.dependencyTracker.getResolution(parentId, request);
  }

  // style operations (delegated to StyleCache)

  // check if CSS has been injected for module
  hasInjectedStyle(id: string): boolean {
    return this.styleCache.hasInjectedStyle(id);
  }

  // get injected CSS bytes for module (for changed-bytes detection)
  getInjectedCss(id: string): string | undefined {
    return this.styleCache.getInjectedCss(id);
  }

  // track injected CSS for module
  trackStyleInjected(id: string, css: string): void {
    this.styleCache.trackStyle(id, css);
  }

  // clear injected styles tracking
  clearInjectedStyles(): void {
    for (const id of this.styleCache.getIds()) {
      if (this.moduleCache.has(id)) {
        this.invalidateWithDependents(id);
      }
    }
    this.styleCache.clear();
  }

  // bulk operations (coordinated across subsystems)

  // clear all cached modules except preloaded ones
  // clear tracker first so per-module onEvict cleanup runs on empty maps
  clearNonPreloaded(): void {
    this.cacheGeneration++;
    this.provisionalDependencyPins.clear();
    this.dependencyTracker.clear();
    this.moduleCache.clearNonPreloaded();
  }

  // clear all cached modules & metadata
  clear(): void {
    this.cacheGeneration++;
    this.provisionalDependencyPins.clear();
    this.moduleCache.clear();
    this.styleCache.clear();
    this.dependencyTracker.clear();
  }

  // statistics (aggregated from subsystems)

  // get cache statistics (for debugging/monitoring)
  getStats(): {
    modules: number;
    styles: number;
    preloaded: number;
    pending: number;
    resolutions: number;
    dependents: number;
    memoryBytes: number;
  } {
    const depStats = this.dependencyTracker.getStats();
    return {
      modules: this.moduleCache.size,
      styles: this.styleCache.size,
      preloaded: this.moduleCache.preloadedCount,
      pending: this.moduleCache.pendingCount,
      resolutions: depStats.resolutions,
      dependents: depStats.dependents,
      memoryBytes: this.moduleCache.memoryBytes,
    };
  }
}

// singleton registry instance
export const registry = new ModuleRegistry();
