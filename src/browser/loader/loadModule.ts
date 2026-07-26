// src/browser/loader/loadModule.ts
// transactional recursive module loading w/ graph-safe async coordination

import { evaluateModule } from '../eval/evaluateModule';
import {
  createCircularDependencyError,
  createModuleDepthExceededError,
  createModuleNotFoundError,
  createStaleGenerationError,
} from '../errors';
import { isBareImport } from '../internal/module-id';
import { getModuleLoaderConfig } from '../internal/runtime-config';
import {
  normalizeModuleDependencies,
  type NormalizedModuleDependency,
} from '../internal/dependency';
import { Semaphore } from '../internal/semaphore';
import { registry } from '../registry/ModuleRegistry';
import { createSyncRequire } from '../runtime/require';
import { injectStyles } from '../styles/injectStyles';
import type {
  FetchResult,
  Module,
  ModuleDependencyInput,
  ModuleFetcher,
  ModuleRuntime,
} from '../types';

interface InFlightFetch {
  promise: Promise<FetchResult | undefined>;
}

interface StagedStyle {
  id: string;
  css: string;
  module: Module;
}

interface ModuleTransaction {
  id: string;
  dependencies: Set<string>;
  resolutions: Map<string, string>;
  pins: Map<string, symbol>;
}

interface ToFetch {
  dependency: NormalizedModuleDependency;
  isBare: boolean;
}

interface FetchedResult {
  dependency: NormalizedModuleDependency;
  result: FetchResult | undefined;
}

const inFlightFetches = new Map<string, InFlightFetch>();
const fetcherIds = new WeakMap<ModuleFetcher, number>();
const pendingWaitEdges = new Map<string, Map<string, number>>();
let nextFetcherId = 1;

let fetchSemaphore = new Semaphore(
  getModuleLoaderConfig().maxConcurrentFetches
);
let semaphoreConcurrency = getModuleLoaderConfig().maxConcurrentFetches;

// stage CSS for one root graph so sibling failure leaves no DOM/cache residue
class GraphTransaction {
  private styles: StagedStyle[] = [];
  private styleModules = new Map<string, Module>();

  constructor(
    readonly epoch: number,
    private readonly resolutionHints: ReadonlyMap<string, string>
  ) {}

  getResolutionHint(parentId: string, request: string): string | undefined {
    return this.resolutionHints.get(makeResolutionKey(parentId, request));
  }

  stageStyle(id: string, css: string): Module {
    const module =
      this.styleModules.get(id) ??
      ({
        id,
        exports: {},
        loaded: true,
      } satisfies Module);
    this.styleModules.set(id, module);
    this.styles.push({ id, css, module });
    return module;
  }

  getStyleModule(id: string): Module | undefined {
    return this.styleModules.get(id);
  }

  commitStyles(): void {
    for (const style of this.styles) {
      assertCurrentGeneration(this.epoch, style.id);
      registry.set(style.id, style.module, getSourceByteLength(style.css));
      injectStyles(style.id, style.css);
    }
  }
}

function makeResolutionKey(parentId: string, request: string): string {
  return `${parentId}\0${request}`;
}

function getFetcherId(fetcher: ModuleFetcher): number {
  const existing = fetcherIds.get(fetcher);
  if (existing !== undefined) {
    return existing;
  }
  const id = nextFetcherId++;
  fetcherIds.set(fetcher, id);
  return id;
}

function makeInFlightKey(
  epoch: number,
  fetcher: ModuleFetcher,
  parentId: string,
  dependency: NormalizedModuleDependency
): string {
  return [
    epoch,
    getFetcherId(fetcher),
    parentId,
    dependency.kind,
    dependency.legacy ? 'legacy' : 'structured',
    dependency.runtimeRequest,
    dependency.specifier,
  ].join('\0');
}

function makeWaitNode(epoch: number, id: string): string {
  return `${epoch}\0${id}`;
}

function getWaitNodeId(node: string): string {
  return node.slice(node.indexOf('\0') + 1);
}

function createCycleChain(id: string, importChain: string[]): string[] {
  const cycleStart = importChain.indexOf(id);
  if (cycleStart === -1) {
    return [...importChain, id];
  }
  return [...importChain.slice(cycleStart), id];
}

// find an existing awaited -> ... -> waiter path before adding waiter -> awaited
function findWaitPath(
  current: string,
  target: string,
  visited: Set<string> = new Set()
): string[] | undefined {
  if (current === target) {
    return [current];
  }
  if (visited.has(current)) {
    return undefined;
  }
  visited.add(current);

  for (const next of pendingWaitEdges.get(current)?.keys() ?? []) {
    const suffix = findWaitPath(next, target, visited);
    if (suffix) {
      return [current, ...suffix];
    }
  }
  return undefined;
}

function addWaitEdge(waiter: string, awaited: string): void {
  const awaitedCounts =
    pendingWaitEdges.get(waiter) ?? new Map<string, number>();
  awaitedCounts.set(awaited, (awaitedCounts.get(awaited) ?? 0) + 1);
  pendingWaitEdges.set(waiter, awaitedCounts);
}

function removeWaitEdge(waiter: string, awaited: string): void {
  const awaitedCounts = pendingWaitEdges.get(waiter);
  if (!awaitedCounts) {
    return;
  }
  const remaining = (awaitedCounts.get(awaited) ?? 0) - 1;
  if (remaining > 0) {
    awaitedCounts.set(awaited, remaining);
  } else {
    awaitedCounts.delete(awaited);
  }
  if (awaitedCounts.size === 0) {
    pendingWaitEdges.delete(waiter);
  }
}

async function waitForPending(
  pending: Promise<Module>,
  id: string,
  importChain: string[],
  epoch: number
): Promise<Module> {
  const waiterId = importChain.at(-1);
  if (!waiterId) {
    return pending;
  }

  if (importChain.includes(id)) {
    throw createCircularDependencyError(
      id,
      waiterId,
      createCycleChain(id, importChain)
    );
  }

  const waiter = makeWaitNode(epoch, waiterId);
  const awaited = makeWaitNode(epoch, id);
  const closingPath = findWaitPath(awaited, waiter);
  if (closingPath) {
    throw createCircularDependencyError(id, waiterId, [
      waiterId,
      ...closingPath.map(getWaitNodeId),
    ]);
  }

  addWaitEdge(waiter, awaited);
  try {
    return await pending;
  } finally {
    removeWaitEdge(waiter, awaited);
  }
}

function getPreloadAliasMap(): Record<string, string> {
  return getModuleLoaderConfig().preloadAliases;
}

function getFetchSemaphore(): Semaphore {
  const configured = getModuleLoaderConfig().maxConcurrentFetches;
  if (configured !== semaphoreConcurrency) {
    fetchSemaphore = new Semaphore(configured);
    semaphoreConcurrency = configured;
  }
  return fetchSemaphore;
}

function getSourceByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}

// reject writes from loads that started before a cache clear boundary
function assertCurrentGeneration(epoch: number, id: string): void {
  if (registry.generation !== epoch) {
    throw createStaleGenerationError(id);
  }
}

function createModuleTransaction(id: string): ModuleTransaction {
  return {
    id,
    dependencies: new Set(),
    resolutions: new Map(),
    pins: new Map(),
  };
}

// pin each child before starting work that can commit it into the LRU
function stageDependency(
  transaction: ModuleTransaction,
  dependsOnId: string
): void {
  if (transaction.dependencies.has(dependsOnId)) {
    return;
  }
  transaction.dependencies.add(dependsOnId);
  transaction.pins.set(
    dependsOnId,
    registry.protectProvisionalDependency(dependsOnId)
  );
}

function releaseDependencyPins(transaction: ModuleTransaction): void {
  for (const [id, token] of transaction.pins) {
    registry.releaseProvisionalDependency(id, token);
  }
  transaction.pins.clear();
}

function stageResolution(
  transaction: ModuleTransaction,
  request: string,
  resolvedId: string
): void {
  if (request !== resolvedId) {
    transaction.resolutions.set(request, resolvedId);
  }
}

// resolve staged CSS first; all other modules must already be committed
function createTransactionRequire(
  transaction: ModuleTransaction,
  graph: GraphTransaction
): (request: string) => unknown {
  const fallback = createSyncRequire(transaction.id);
  return (request: string): unknown => {
    const directStyle = graph.getStyleModule(request);
    if (directStyle) {
      return directStyle.exports;
    }

    const resolvedId = transaction.resolutions.get(request);
    if (resolvedId) {
      const stagedStyle = graph.getStyleModule(resolvedId);
      if (stagedStyle) {
        return stagedStyle.exports;
      }
      const resolvedModule = registry.get(resolvedId);
      if (resolvedModule) {
        return resolvedModule.exports;
      }
    }

    return fallback(request);
  };
}

async function fetchDependency(
  parentId: string,
  dependency: NormalizedModuleDependency,
  isBare: boolean,
  fetcher: ModuleFetcher,
  epoch: number
): Promise<FetchedResult> {
  const inFlightKey = makeInFlightKey(epoch, fetcher, parentId, dependency);
  let inFlight = inFlightFetches.get(inFlightKey);

  if (!inFlight) {
    const semaphore = getFetchSemaphore();
    // identity-compare the record so the finally only clears its own entry
    const record = {} as InFlightFetch;
    record.promise = (async (): Promise<FetchResult | undefined> => {
      await semaphore.acquire();
      try {
        if (dependency.legacy) {
          return await fetcher(dependency.specifier, isBare, parentId);
        }
        return await fetcher(
          dependency.specifier,
          isBare,
          parentId,
          dependency.kind
        );
      } finally {
        if (inFlightFetches.get(inFlightKey) === record) {
          inFlightFetches.delete(inFlightKey);
        }
        semaphore.release();
      }
    })();
    inFlight = record;
    inFlightFetches.set(inFlightKey, record);
  }

  return { dependency, result: await inFlight.promise };
}

// recursively load one module inside its root graph transaction
async function loadModuleInGraph(
  id: string,
  code: string,
  dependencies: ModuleDependencyInput[],
  fetcher: ModuleFetcher,
  depth: number,
  importChain: string[],
  graph: GraphTransaction
): Promise<Module> {
  const config = getModuleLoaderConfig();
  const normalizedDependencies = normalizeModuleDependencies(dependencies);

  if (depth > config.maxModuleLoadDepth) {
    throw createModuleDepthExceededError(id, depth);
  }

  assertCurrentGeneration(graph.epoch, id);

  const cached = registry.get(id);
  if (cached) {
    return cached;
  }

  const pending = registry.getPending(id);
  if (pending) {
    return waitForPending(pending, id, importChain, graph.epoch);
  }

  const modulePromise = loadModuleAsync(
    id,
    code,
    normalizedDependencies,
    fetcher,
    depth,
    [...importChain, id],
    graph
  );
  registry.setPending(id, modulePromise);

  try {
    return await modulePromise;
  } finally {
    registry.clearPending(id, modulePromise);
  }
}

// load, evaluate, then atomically publish one module's staged metadata
async function loadModuleAsync(
  id: string,
  code: string,
  dependencies: NormalizedModuleDependency[],
  fetcher: ModuleFetcher,
  depth: number,
  importChain: string[],
  graph: GraphTransaction
): Promise<Module> {
  const transaction = createModuleTransaction(id);

  try {
    const toFetch: ToFetch[] = [];

    for (const dependency of dependencies) {
      if (!dependency.specifier || !dependency.runtimeRequest) {
        continue;
      }

      const directId = registry.has(dependency.specifier)
        ? dependency.specifier
        : graph.getStyleModule(dependency.specifier)
          ? dependency.specifier
          : undefined;
      if (directId) {
        stageResolution(transaction, dependency.runtimeRequest, directId);
        stageDependency(transaction, directId);
        continue;
      }

      const priorResolution =
        graph.getResolutionHint(id, dependency.runtimeRequest) ??
        registry.getResolution(id, dependency.runtimeRequest);
      if (
        priorResolution &&
        (registry.has(priorResolution) || graph.getStyleModule(priorResolution))
      ) {
        stageResolution(
          transaction,
          dependency.runtimeRequest,
          priorResolution
        );
        stageDependency(transaction, priorResolution);
        continue;
      }

      const aliasId = getPreloadAliasMap()[dependency.specifier];
      if (aliasId && registry.has(aliasId)) {
        stageResolution(transaction, dependency.runtimeRequest, aliasId);
        stageDependency(transaction, aliasId);
        continue;
      }

      toFetch.push({
        dependency,
        isBare: isBareImport(dependency.specifier),
      });
    }

    const fetchResults = await Promise.all(
      toFetch.map(({ dependency, isBare }) =>
        fetchDependency(id, dependency, isBare, fetcher, graph.epoch)
      )
    );

    assertCurrentGeneration(graph.epoch, id);

    const failed = fetchResults.find((result) => !result.result);
    if (failed) {
      throw createModuleNotFoundError(failed.dependency.specifier, id);
    }

    const loadPromises: Promise<Module>[] = [];

    // stage in dependency-list order so successful CSS keeps cascade order
    for (const { dependency, result } of fetchResults) {
      if (!result) {
        continue;
      }

      const preloadId = getPreloadAliasMap()[result.fsPath];
      if (preloadId && registry.has(preloadId)) {
        stageResolution(transaction, dependency.runtimeRequest, preloadId);
        stageDependency(transaction, preloadId);
        continue;
      }

      stageResolution(transaction, dependency.runtimeRequest, result.fsPath);
      stageDependency(transaction, result.fsPath);

      if (result.css) {
        graph.stageStyle(result.fsPath, result.css);
        continue;
      }

      loadPromises.push(
        loadModuleInGraph(
          result.fsPath,
          result.code,
          result.dependencies,
          fetcher,
          depth + 1,
          importChain,
          graph
        )
      );
    }

    await Promise.all(loadPromises);
    assertCurrentGeneration(graph.epoch, id);

    const runtimeBase = getModuleLoaderConfig().runtime;
    const runtime: ModuleRuntime = {
      ...runtimeBase,
      require: createTransactionRequire(transaction, graph),
    };
    const exports = evaluateModule(code, id, runtime);
    const module: Module = {
      id,
      exports,
      loaded: true,
    };

    registry.commitModule(
      id,
      module,
      transaction.dependencies,
      transaction.resolutions,
      getSourceByteLength(code)
    );
    return module;
  } finally {
    releaseDependencyPins(transaction);
  }
}

async function loadRootModule(
  id: string,
  code: string,
  dependencies: ModuleDependencyInput[],
  fetcher: ModuleFetcher,
  depth: number,
  importChain: string[],
  epoch: number,
  resolutionHints: ReadonlyMap<string, string>
): Promise<Module> {
  const graph = new GraphTransaction(epoch, resolutionHints);
  const module = await loadModuleInGraph(
    id,
    code,
    dependencies,
    fetcher,
    depth,
    importChain,
    graph
  );
  assertCurrentGeneration(epoch, id);
  graph.commitStyles();
  return module;
}

// public recursive loader entry point
export function loadModule(
  id: string,
  code: string,
  dependencies: ModuleDependencyInput[],
  fetcher: ModuleFetcher,
  depth: number = 0,
  importChain: string[] = [],
  epoch: number = registry.generation
): Promise<Module> {
  return loadRootModule(
    id,
    code,
    dependencies,
    fetcher,
    depth,
    importChain,
    epoch,
    new Map()
  );
}

// same-entry evaluation supplies validated cache hints after invalidating the entry
export function loadModuleWithResolutionHints(
  id: string,
  code: string,
  dependencies: ModuleDependencyInput[],
  fetcher: ModuleFetcher,
  resolutionHints: ReadonlyMap<string, string>
): Promise<Module> {
  const keyedHints = new Map<string, string>();
  for (const [request, resolvedId] of resolutionHints) {
    keyedHints.set(makeResolutionKey(id, request), resolvedId);
  }
  return loadRootModule(
    id,
    code,
    dependencies,
    fetcher,
    0,
    [],
    registry.generation,
    keyedHints
  );
}

// hard resets detach old generation wait/fetch bookkeeping immediately
export function resetModuleLoaderCoordination(): void {
  inFlightFetches.clear();
  pendingWaitEdges.clear();
  fetchSemaphore = new Semaphore(getModuleLoaderConfig().maxConcurrentFetches);
  semaphoreConcurrency = getModuleLoaderConfig().maxConcurrentFetches;
}
