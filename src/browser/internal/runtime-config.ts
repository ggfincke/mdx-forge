// src/browser/internal/runtime-config.ts
// runtime configuration & module loader factory

import {
  DEFAULT_MAX_CONCURRENT_FETCHES,
  DEFAULT_MAX_MODULE_LOAD_DEPTH,
} from './constants'
import type { MDXRuntime, ModuleLoaderConfig } from '../types'

const MISSING_RUNTIME_FN = () =>
{
  throw new Error(
    'MDX runtime is not configured. Provide jsx/jsxs/Fragment via configureModuleLoader().'
  )
}

const defaultRuntime: MDXRuntime = {
  Fragment: null,
  jsx: MISSING_RUNTIME_FN,
  jsxs: MISSING_RUNTIME_FN,
}

interface RuntimeState
{
  maxModuleLoadDepth: number
  maxConcurrentFetches: number
  preloadAliases: Record<string, string>
  runtime: MDXRuntime
}

const state: RuntimeState = {
  maxModuleLoadDepth: DEFAULT_MAX_MODULE_LOAD_DEPTH,
  maxConcurrentFetches: DEFAULT_MAX_CONCURRENT_FETCHES,
  preloadAliases: {},
  runtime: defaultRuntime,
}

// validate budget at the public config boundary; zero/negative/non-finite
// values would stall the semaphore or disable loading entirely
function assertPositiveIntegerBudget(name: string, value: number): void
{
  if (!Number.isInteger(value) || value <= 0)
  {
    throw new RangeError(
      `${name} must be a finite positive integer, got ${String(value)}`
    )
  }
}

export function configureModuleLoader(config: ModuleLoaderConfig): void
{
  // validate all budgets before mutating state (invalid config changes nothing)
  if (config.maxModuleLoadDepth !== undefined)
  {
    assertPositiveIntegerBudget('maxModuleLoadDepth', config.maxModuleLoadDepth)
  }
  if (config.maxConcurrentFetches !== undefined)
  {
    assertPositiveIntegerBudget(
      'maxConcurrentFetches',
      config.maxConcurrentFetches
    )
  }

  if (config.maxModuleLoadDepth !== undefined)
  {
    state.maxModuleLoadDepth = config.maxModuleLoadDepth
  }
  if (config.maxConcurrentFetches !== undefined)
  {
    state.maxConcurrentFetches = config.maxConcurrentFetches
  }
  if (config.preloadAliases !== undefined)
  {
    state.preloadAliases = { ...config.preloadAliases }
  }
  if (config.runtime !== undefined)
  {
    state.runtime = {
      ...state.runtime,
      ...config.runtime,
    }
  }
}

export function getModuleLoaderConfig(): RuntimeState
{
  return state
}
