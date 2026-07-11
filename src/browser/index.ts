// src/browser/index.ts
// main entry point - exports & high-level API for Trusted Mode module loading

import { registry } from './registry/ModuleRegistry';
import { clearInjectedStyles } from './styles/injectStyles';
import { loadModule } from './loader/loadModule';
import {
  initPreloadedModules,
  fallbackLayoutModule,
  ensureFrameworkShims,
  ensureGenericShims,
} from './preload';
import { configureModuleLoader } from './internal/runtime-config';
import type {
  FetchResult,
  Framework,
  ModuleFetcher,
  ModuleLoaderConfig,
} from './types';

// re-exports for external use
export { registry } from './registry/ModuleRegistry';
export { clearInjectedStyles } from './styles/injectStyles';
export { loadModule } from './loader/loadModule';
export { evaluateModule } from './eval/evaluateModule';
export { createSyncRequire } from './runtime/require';
export type {
  FetchResult,
  Framework,
  FrameworkId,
  HostPreloadCallbacks,
  MDXRuntime,
  Module,
  ModuleFetcher,
  ModuleLoaderConfig,
  ModuleRuntime,
  PreloadEntry,
} from './types';
export { PRELOADED_MODULE_IDS } from './types';
export {
  setPreloadEntries,
  registerPreloadEntries,
  setHostPreloadCallbacks,
} from './preload';

// state
let preloadedModulesInitialized = false;
let pendingFrameworkShimLoad: Promise<void> | null = null;
let pendingGenericShimLoad: Promise<void> | null = null;
let activeFetcher: ModuleFetcher | null = null;

// configure module loader behavior
export function configureRuntime(config: ModuleLoaderConfig): void {
  configureModuleLoader(config);
}

export function setModuleFetcher(fetcher: ModuleFetcher): void {
  activeFetcher = fetcher;
}

// ensure preloaded modules are initialized - called internally before any module loading
function ensurePreloadedModules(): void {
  if (preloadedModulesInitialized) {
    return;
  }
  initPreloadedModules(registry, fallbackLayoutModule);
  preloadedModulesInitialized = true;
}

// track last entry path for incremental invalidation
let lastEntryPath: string | null = null;

// clear all modules except preloaded ones - called when entry file changes to ensure fresh state
export function resetModules(): void {
  registry.clearNonPreloaded();
  clearInjectedStyles();
}

// clear dependency graph but keep module cache - called at start of each evaluation to rebuild dependency graph
export function resetDependencies(): void {
  registry.clearDependencies();
}

// invalidate a specific module (for hot reload)
export function invalidateModule(id: string): void {
  registry.invalidate(id);
}

// invalidate a module & all modules that depend on it - return the set of invalidated module IDs
export function invalidateModuleWithDependents(id: string): Set<string> {
  return registry.invalidateWithDependents(id);
}

// clear all caches (modules, styles, dependencies) - called by manual cache refresh command
export function clearAllCaches(): void {
  registry.clear();
  clearInjectedStyles();
  lastEntryPath = null;
  preloadedModulesInitialized = false;
}

// load framework-specific shims on demand - called by RPC handler when extension sends framework info
export function ensureFrameworkShimsLoaded(framework: Framework): void {
  // ensure preloaded modules are ready first
  ensurePreloadedModules();
  // store the promise so evaluateModuleToComponent can await it
  pendingFrameworkShimLoad = ensureFrameworkShims(registry, framework);
}

// load specific generic shims on demand - called by RPC handler for conditional preloading
export function ensureGenericShimsLoaded(components: string[]): void {
  // ensure preloaded modules are ready first
  ensurePreloadedModules();
  // store the promise so evaluateModuleToComponent can await it
  // this fixes the race condition where setUsedComponents is called right before updatePreview
  pendingGenericShimLoad = ensureGenericShims(registry, components);
}

// fetcher that delegates to host-provided implementation
async function rpcFetcher(
  request: string,
  isBare: boolean,
  parentId: string
): Promise<FetchResult | undefined> {
  if (!activeFetcher) {
    throw new Error(
      'Module fetcher is not configured. Call setModuleFetcher().'
    );
  }
  return activeFetcher(request, isBare, parentId);
}

// evaluate MDX into a component & preserve dependency cache when possible
// full reset only when entry path changes; otherwise invalidate dependents
export async function evaluateModuleToComponent(
  code: string,
  entryFilePath: string,
  dependencies: string[]
): Promise<(...args: unknown[]) => unknown> {
  // ensure preloaded modules are ready
  ensurePreloadedModules();

  // wait for pending independent shim loads before evaluation
  // loop so a newer load installed mid-await is also honored
  // compare-&-clear exact handles so a newer generation is never erased
  while (pendingGenericShimLoad || pendingFrameworkShimLoad) {
    const genericSnapshot = pendingGenericShimLoad;
    const frameworkSnapshot = pendingFrameworkShimLoad;
    const pendingLoads: Promise<void>[] = [];
    if (genericSnapshot) {
      pendingLoads.push(genericSnapshot);
    }
    if (frameworkSnapshot) {
      pendingLoads.push(frameworkSnapshot);
    }

    try {
      await Promise.all(pendingLoads);
    } finally {
      // clear only the exact awaited handles (settled or rejected)
      if (pendingGenericShimLoad === genericSnapshot) {
        pendingGenericShimLoad = null;
      }
      if (pendingFrameworkShimLoad === frameworkSnapshot) {
        pendingFrameworkShimLoad = null;
      }
    }
  }

  // determine if we need full reset or incremental invalidation
  if (lastEntryPath !== entryFilePath) {
    // entry file changed - full reset required
    resetModules();
    lastEntryPath = entryFilePath;
  } else {
    // same entry file - incremental invalidation
    // invalidate entry & all modules that depend on it
    registry.invalidateWithDependents(entryFilePath);
    // clear dependency graph (will be rebuilt during load)
    resetDependencies();
    // clear injected styles (will be re-injected)
    clearInjectedStyles();
  }

  // load the entry module & all dependencies
  const module = await loadModule(
    entryFilePath,
    code,
    dependencies,
    rpcFetcher
  );

  // get the default export (MDX component)
  const moduleExports = module.exports as Record<string, unknown>;
  const component = moduleExports.default ?? module.exports;

  if (typeof component !== 'function') {
    throw new Error(
      `MDX module did not export a valid component. ` +
        `Got: ${typeof component}. ` +
        `Make sure the MDX file has valid content.`
    );
  }

  return component as (...args: unknown[]) => unknown;
}
