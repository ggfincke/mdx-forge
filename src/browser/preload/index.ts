// src/browser/preload/index.ts
// preload API entry point & framework shim loading

import {
  registry as sharedRegistry,
  type ModuleRegistry,
} from '../registry/ModuleRegistry';
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

let preloadAliases: Record<string, string> = {};
let preloadEntriesById = new Map<string, PreloadEntry>();

function syncRuntimeAliases(): void {
  configureModuleLoader({ preloadAliases });
}

// derive aliases from the complete candidate so collisions cannot partially install
function buildAliases(
  entriesById: ReadonlyMap<string, PreloadEntry>
): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const entry of entriesById.values()) {
    for (const alias of entry.aliases ?? []) {
      const existing = aliases[alias];
      if (existing && existing !== entry.id) {
        throw new Error(
          `Alias collision for "${alias}": ${existing} vs ${entry.id}`
        );
      }
      aliases[alias] = entry.id;
    }
  }
  return aliases;
}

function replacePreloadState(
  entriesById: Map<string, PreloadEntry>,
  aliases: Record<string, string>
): void {
  preloadEntriesById = entriesById;
  preloadAliases = aliases;
  syncRuntimeAliases();
}

export function setPreloadEntries(entries: readonly PreloadEntry[]): void {
  const candidateEntries = new Map<string, PreloadEntry>();
  for (const entry of entries) {
    candidateEntries.set(entry.id, entry);
  }
  const candidateAliases = buildAliases(candidateEntries);
  replacePreloadState(candidateEntries, candidateAliases);
}

// one-arg form targets the singleton registry (typical standalone hosts)
// two-arg form lets embedders supply their own ModuleRegistry instance
export function registerPreloadEntries(entries: readonly PreloadEntry[]): void;
export function registerPreloadEntries(
  registry: ModuleRegistry,
  entries: readonly PreloadEntry[]
): void;
export function registerPreloadEntries(
  registryOrEntries: ModuleRegistry | readonly PreloadEntry[],
  maybeEntries?: readonly PreloadEntry[]
): void {
  const usesSharedRegistry = Array.isArray(registryOrEntries);
  const registry = usesSharedRegistry
    ? sharedRegistry
    : (registryOrEntries as ModuleRegistry);
  const entries = usesSharedRegistry
    ? (registryOrEntries as readonly PreloadEntry[])
    : (maybeEntries ?? []);

  const candidateEntries = new Map(preloadEntriesById);
  for (const entry of entries) {
    candidateEntries.set(entry.id, entry);
  }
  const candidateAliases = buildAliases(candidateEntries);

  const batchEntries = new Map(entries.map((entry) => [entry.id, entry]));
  registry.preloadMany(Array.from(batchEntries.values()));
  replacePreloadState(candidateEntries, candidateAliases);
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
    const generation = registry.generation;
    return hostCallbacks.ensureFrameworkShims(
      createGenerationBoundRegistry(registry, generation),
      framework
    );
  }
  // no-op in standalone (host integration provides real implementation)
}

export async function ensureGenericShims(
  registry: ModuleRegistry,
  components: string[]
): Promise<void> {
  if (hostCallbacks.ensureGenericShims) {
    const generation = registry.generation;
    return hostCallbacks.ensureGenericShims(
      createGenerationBoundRegistry(registry, generation),
      components
    );
  }
  // no-op in standalone (host integration provides real implementation)
}

// stale async shim callbacks may observe the registry but cannot preload into it
function createGenerationBoundRegistry(
  registry: ModuleRegistry,
  generation: number
): ModuleRegistry {
  return new Proxy(registry, {
    get(target, property) {
      if (property === 'preload') {
        return (id: string, exports: unknown): void => {
          if (target.generation === generation) {
            target.preload(id, exports);
          }
        };
      }
      if (property === 'preloadMany') {
        return (entries: readonly { id: string; exports: unknown }[]): void => {
          if (target.generation === generation) {
            target.preloadMany(entries);
          }
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
