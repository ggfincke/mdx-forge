// src/browser/preload/shimLoader.ts
// resilient shim loading w/ retry & fallback to generic shims

import { normalizeError } from '../../internal/errors';
import {
  DEFAULT_SHIM_LOAD_MAX_RETRIES,
  DEFAULT_SHIM_LOAD_RETRY_DELAY_MS,
} from '../internal/constants';
import type { ModuleRegistry } from '../registry/ModuleRegistry';
import type { Framework } from '../types';

// result of shim loading attempt
export interface ShimLoadResult {
  success: boolean;
  framework: Framework;
  failedShims: string[];
  usedFallback: boolean;
}

// retry operation result
interface RetryResult<T> {
  // resolved value or null on failure
  result: T | null;
  // total attempts made
  attempts: number;
  // last error if failed
  lastError?: Error;
}

// utility: delay w/ exponential backoff
function delay(attempt: number): Promise<void> {
  const ms = DEFAULT_SHIM_LOAD_RETRY_DELAY_MS * Math.pow(2, attempt);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// retry loader function w/ exponential backoff
async function retryLoad<T>(
  name: string,
  loader: () => Promise<T>,
  maxRetries: number = DEFAULT_SHIM_LOAD_MAX_RETRIES
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await loader();
      return { result, attempts: attempt + 1 };
    } catch (error: unknown) {
      lastError = normalizeError(error);

      if (attempt < maxRetries) {
        await delay(attempt);
      }
    }
  }

  return { result: null, attempts: maxRetries + 1, lastError };
}

// load framework shims w/ retry & fallback to generic shims
export async function loadFrameworkShimsWithRetry(
  registry: ModuleRegistry,
  framework: Framework,
  frameworkLoader: (registry: ModuleRegistry) => Promise<void>,
  genericFallbackLoader: (registry: ModuleRegistry) => void
): Promise<ShimLoadResult> {
  const result: ShimLoadResult = {
    success: false,
    framework,
    failedShims: [],
    usedFallback: false,
  };

  // attempt to load framework-specific shims w/ retry
  const loadResult = await retryLoad(`${framework} shims`, () =>
    frameworkLoader(registry)
  );

  if (loadResult.result !== null) {
    result.success = true;
    return result;
  }

  // framework shims failed - fall back to generic shims

  try {
    genericFallbackLoader(registry);
    result.usedFallback = true;
    result.success = true;
  } catch {
    result.failedShims.push('generic-fallback');
  }

  return result;
}

// load individual generic shims w/ retry
export async function loadGenericShimsWithRetry(
  registry: ModuleRegistry,
  componentNames: string[],
  shimLoaders: Record<string, (registry: ModuleRegistry) => Promise<void>>
): Promise<{ loaded: string[]; failed: string[] }> {
  const loaded: string[] = [];
  const failed: string[] = [];

  // load shims in parallel w/ individual retry
  const loadPromises = componentNames.map(async (name) => {
    const loader = shimLoaders[name];
    if (!loader) {
      return;
    }

    const result = await retryLoad(name, () => loader(registry));
    if (result.result !== null) {
      loaded.push(name);
    } else {
      failed.push(name);
    }
  });

  await Promise.all(loadPromises);

  return { loaded, failed };
}

// test helper for retry
export { retryLoad as _retryLoadForTesting };
