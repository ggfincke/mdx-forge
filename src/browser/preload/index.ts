// src/browser/preload/index.ts
// preload API entry point & framework shim loading

import type { ModuleRegistry } from '../registry/ModuleRegistry';
import type { FrameworkId, HostPreloadCallbacks, PreloadEntry } from '../types';
import { preloadCoreModules } from './core';
import { configureModuleLoader } from '../internal/runtime-config';

export { fallbackLayoutModule } from './core';

// host-provided callbacks for environment-specific preload behavior
let hostCallbacks: HostPreloadCallbacks = {};

// register host-specific preload implementations
// call before any module loading to override default no-op stubs
export function setHostPreloadCallbacks(callbacks: HostPreloadCallbacks): void {
  hostCallbacks = callbacks;
}

// request-specifier -> canonical module ID
const PRELOAD_ALIASES: Record<string, string> = {};

const preloadEntriesById = new Map<string, PreloadEntry>();

function clearObject(target: Record<string, string>): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
}

function syncRuntimeAliases(): void {
  configureModuleLoader({ preloadAliases: { ...PRELOAD_ALIASES } });
}

function addAliasesForEntry(entry: PreloadEntry): void {
  for (const alias of entry.aliases ?? []) {
    const existing = PRELOAD_ALIASES[alias];
    if (existing && existing !== entry.id) {
      throw new Error(
        `Alias collision for "${alias}": ${existing} vs ${entry.id}`
      );
    }
    PRELOAD_ALIASES[alias] = entry.id;
  }
}

function registerEntry(entry: PreloadEntry): void {
  preloadEntriesById.set(entry.id, entry);
  addAliasesForEntry(entry);
}

export function setPreloadEntries(entries: readonly PreloadEntry[]): void {
  preloadEntriesById.clear();
  clearObject(PRELOAD_ALIASES);

  for (const entry of entries) {
    registerEntry(entry);
  }

  syncRuntimeAliases();
}

export function registerPreloadEntries(
  registry: ModuleRegistry,
  entries: readonly PreloadEntry[]
): void {
  for (const entry of entries) {
    registerEntry(entry);
    registry.preload(entry.id, entry.exports);
  }

  syncRuntimeAliases();
}

export function initPreloadedModules(
  registry: ModuleRegistry,
  vscodeMarkdownLayout: unknown
): void {
  if (hostCallbacks.initPreloadedModules) {
    hostCallbacks.initPreloadedModules(registry, vscodeMarkdownLayout);
    syncRuntimeAliases();
    return;
  }

  // default standalone behavior
  preloadCoreModules(
    registry,
    vscodeMarkdownLayout,
    Array.from(preloadEntriesById.values())
  );

  syncRuntimeAliases();
}

export async function ensureFrameworkShims(
  registry: ModuleRegistry,
  framework: FrameworkId
): Promise<void> {
  if (hostCallbacks.ensureFrameworkShims) {
    return hostCallbacks.ensureFrameworkShims(registry, framework);
  }
  // no-op in standalone (host integration provides real implementation)
}

export async function ensureGenericShims(
  registry: ModuleRegistry,
  components: string[]
): Promise<void> {
  if (hostCallbacks.ensureGenericShims) {
    return hostCallbacks.ensureGenericShims(registry, components);
  }
  // no-op in standalone (host integration provides real implementation)
}
