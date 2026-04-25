// src/browser/runtime/require.ts
// synchronous require factory for module evaluation

import { registry } from '../registry/ModuleRegistry';
import { getModuleLoaderConfig } from '../internal/runtime-config';

// create sync require bound to a parent module
// resolve direct cache, relative resolution map, then preload aliases
// throw when dependency was not prefetched
export function createSyncRequire(
  parentId: string
): (request: string) => unknown {
  return (request: string): unknown => {
    // 1. direct cache hit
    const cached = registry.get(request);
    if (cached) {
      return cached.exports;
    }

    // 2. resolution map for relative imports resolved from this parent
    const resolvedPath = registry.getResolution(parentId, request);
    if (resolvedPath) {
      const resolvedModule = registry.get(resolvedPath);
      if (resolvedModule) {
        return resolvedModule.exports;
      }
    }

    // 3. alias lookup
    const aliasId = getModuleLoaderConfig().preloadAliases[request];
    if (aliasId) {
      const aliased = registry.get(aliasId);
      if (aliased) {
        return aliased.exports;
      }
    }

    // module not found (should have been pre-fetched via preload aliases or resolution map)
    throw new Error(
      `Module not found: "${request}" (required by "${parentId}"). ` +
        `Make sure all dependencies are fetched before evaluation.`
    );
  };
}
