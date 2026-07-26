// src/compiler/plugins/loader.ts
// cached concurrent user plugin loading from filesystem paths

import * as path from 'path';
import type { Pluggable } from 'unified';
import { extractErrorMessage, isError } from '../../internal/errors';
import { getLogger } from '../internal/logging';
import {
  clearDefaultPluginResolverCache,
  DEFAULT_PLUGIN_LOADER,
} from '../internal/plugin-loader';
import {
  getDocumentDir,
  getDocumentPath,
  getDocumentUri,
} from '../internal/path';
import { requireTrustedMode } from '../internal/trust';
import type {
  CompilerConfig,
  LoadedPlugins,
  PluginLoadError,
  PluginLoader,
  PluginSpec,
  ResolvedConfig,
} from '../types';
import { getPluginName, parsePluginSpec } from './utils';

class InvalidPluginExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPluginExportError';
  }
}

interface PluginLoadOutcome {
  pluginName: string;
  pluginPath?: string;
  plugin?: Pluggable;
  error?: PluginLoadError;
}

interface CachedPluginLists {
  remark: PluginLoadOutcome[];
  rehype: PluginLoadOutcome[];
}

interface LoadedPluginList {
  plugins: Pluggable[];
  errorCount: number;
}

const pluginLoadCache = new Map<string, Promise<CachedPluginLists>>();
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

function getObjectId(value: object | undefined): number {
  if (!value) {
    return 0;
  }
  const cached = objectIds.get(value);
  if (cached) {
    return cached;
  }
  const id = nextObjectId++;
  objectIds.set(value, id);
  return id;
}

function resolvePluginPath(
  pluginName: string,
  configDir: string,
  loader: PluginLoader
): string {
  try {
    return loader.resolve(pluginName, configDir);
  } catch (error) {
    throw new Error(
      `Cannot resolve plugin "${pluginName}" from ${configDir}. ` +
        `Make sure it is installed in your project's node_modules.`,
      {
        cause: error,
      }
    );
  }
}

async function loadPlugin(
  spec: PluginSpec,
  configDir: string,
  loader: PluginLoader,
  onResolved: (pluginPath: string) => void
): Promise<Pluggable> {
  const { name: pluginName, options: pluginOptions } = parsePluginSpec(spec);

  const pluginPath = resolvePluginPath(pluginName, configDir, loader);
  onResolved(pluginPath);

  try {
    const pluginModule = await loader.load(pluginPath);
    const pluginRecord =
      pluginModule !== null &&
      (typeof pluginModule === 'object' || typeof pluginModule === 'function')
        ? (pluginModule as Record<string, unknown>)
        : {};
    const pluginFn =
      pluginRecord.default ?? pluginRecord[pluginName] ?? pluginModule;

    if (typeof pluginFn !== 'function') {
      throw new InvalidPluginExportError(
        `Plugin "${pluginName}" does not export a function. Got: ${typeof pluginFn}`
      );
    }

    return pluginOptions
      ? ([pluginFn, pluginOptions] as Pluggable)
      : (pluginFn as Pluggable);
  } catch (error) {
    if (error instanceof InvalidPluginExportError) {
      throw error;
    }
    const message = extractErrorMessage(error);
    throw new Error(`Failed to load plugin "${pluginName}": ${message}`, {
      cause: error,
    });
  }
}

function reportPluginError(
  compilerConfig: CompilerConfig,
  pluginError: PluginLoadError,
  logger: ReturnType<typeof getLogger>
): void {
  if (compilerConfig.errorReporter) {
    compilerConfig.errorReporter.reportPluginError(pluginError);
    return;
  }

  logger.warn(`${pluginError.message} (code: ${pluginError.code})`);
}

async function loadPluginList(
  specs: PluginSpec[] | undefined,
  configDir: string,
  loader: PluginLoader
): Promise<PluginLoadOutcome[]> {
  return Promise.all(
    (specs ?? []).map(async (spec): Promise<PluginLoadOutcome> => {
      const pluginName = getPluginName(spec);
      let pluginPath: string | undefined;
      try {
        const plugin = await loadPlugin(
          spec,
          configDir,
          loader,
          (resolvedPath) => {
            pluginPath = resolvedPath;
          }
        );
        return { pluginName, pluginPath, plugin };
      } catch (error) {
        return {
          pluginName,
          pluginPath,
          error: {
            code:
              error instanceof InvalidPluginExportError
                ? 'PLUGIN_INVALID_EXPORT'
                : 'PLUGIN_LOAD_ERROR',
            pluginName,
            message: extractErrorMessage(error),
            cause: isError(error) ? error : undefined,
          },
        };
      }
    })
  );
}

// replay ordered diagnostics while returning a fresh plugin list every call
function assemblePluginList(
  outcomes: PluginLoadOutcome[],
  pluginType: 'remark' | 'rehype',
  compilerConfig: CompilerConfig,
  logger: ReturnType<typeof getLogger>
): LoadedPluginList {
  const loaded: Pluggable[] = [];
  let errorCount = 0;

  for (const outcome of outcomes) {
    if (outcome.pluginPath) {
      logger.debug(
        `Loading plugin ${outcome.pluginName} from ${outcome.pluginPath}`
      );
    }
    if (outcome.error) {
      errorCount++;
      reportPluginError(compilerConfig, outcome.error, logger);
      continue;
    }
    if (outcome.plugin) {
      loaded.push(outcome.plugin);
      logger.debug(`Loaded ${pluginType} plugin: ${outcome.pluginName}`);
    }
  }

  return { plugins: loaded, errorCount };
}

function createPluginCacheKey(
  config: ResolvedConfig,
  compilerConfig: CompilerConfig,
  loader: PluginLoader
): string {
  const trustValidator = compilerConfig.trustValidator;
  return JSON.stringify({
    plugins: [
      config.config.remarkPlugins ?? [],
      config.config.rehypePlugins ?? [],
    ],
    configPath: config.configPath,
    configDir: config.configDir,
    documentDir: getDocumentDir(compilerConfig),
    loader: getObjectId(loader),
    trustContext: trustValidator
      ? {
          validator: getObjectId(trustValidator),
          documentPath: getDocumentPath(compilerConfig),
          documentUri: getDocumentUri(compilerConfig),
        }
      : null,
  });
}

function getCachedPluginLists(
  cacheKey: string,
  remarkPlugins: PluginSpec[] | undefined,
  rehypePlugins: PluginSpec[] | undefined,
  configDir: string,
  loader: PluginLoader
): Promise<CachedPluginLists> {
  const cached = pluginLoadCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = Promise.all([
    loadPluginList(remarkPlugins, configDir, loader),
    loadPluginList(rehypePlugins, configDir, loader),
  ]).then(([remark, rehype]) => ({ remark, rehype }));
  pluginLoadCache.set(cacheKey, pending);
  void pending.catch(() => {
    if (pluginLoadCache.get(cacheKey) === pending) {
      pluginLoadCache.delete(cacheKey);
    }
  });
  return pending;
}

// invalidate cached module loads after a host-observed config revision
export function clearPluginLoadCache(): void {
  pluginLoadCache.clear();
  clearDefaultPluginResolverCache();
}

export async function loadPluginsFromConfig(
  config: ResolvedConfig | undefined,
  compilerConfig: CompilerConfig
): Promise<LoadedPlugins> {
  const logger = getLogger(compilerConfig.logger);
  const loader = compilerConfig.pluginLoader ?? DEFAULT_PLUGIN_LOADER;

  const emptyResult: LoadedPlugins = {
    remarkPlugins: [],
    rehypePlugins: [],
    errorCount: 0,
  };

  if (!config) {
    return emptyResult;
  }

  const { remarkPlugins, rehypePlugins } = config.config;
  const hasPlugins =
    (remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0) > 0;
  if (!hasPlugins) {
    return emptyResult;
  }

  const trusted = requireTrustedMode(
    compilerConfig,
    'load custom MDX plugins',
    (error) => {
      reportPluginError(
        compilerConfig,
        {
          code: 'PLUGIN_LOAD_ERROR',
          pluginName: 'custom-plugins',
          message:
            `Custom plugins configured but cannot load: ${error.message}. ` +
            `${(remarkPlugins?.length ?? 0) + (rehypePlugins?.length ?? 0)} plugin(s) will be ignored.`,
          cause: error,
        },
        logger
      );
    }
  );

  if (!trusted) {
    return emptyResult;
  }

  const configDir = config.configDir;
  logger.info(
    `Loading custom plugins from ${path.basename(config.configPath)}...`
  );

  const cacheKey = createPluginCacheKey(config, compilerConfig, loader);
  const cachedPlugins = await getCachedPluginLists(
    cacheKey,
    remarkPlugins,
    rehypePlugins,
    configDir,
    loader
  );
  const loadedRemarkPlugins = assemblePluginList(
    cachedPlugins.remark,
    'remark',
    compilerConfig,
    logger
  );
  const loadedRehypePlugins = assemblePluginList(
    cachedPlugins.rehype,
    'rehype',
    compilerConfig,
    logger
  );

  const result: LoadedPlugins = {
    remarkPlugins: loadedRemarkPlugins.plugins,
    rehypePlugins: loadedRehypePlugins.plugins,
    errorCount: loadedRemarkPlugins.errorCount + loadedRehypePlugins.errorCount,
  };

  const loadedCount = result.remarkPlugins.length + result.rehypePlugins.length;
  if (loadedCount > 0) {
    logger.info(
      `Loaded ${loadedCount} custom plugin(s)` +
        (result.errorCount > 0 ? ` (${result.errorCount} failed)` : '')
    );
  }

  return result;
}

export function mergePlugins(
  builtIn: readonly Pluggable[],
  custom: readonly Pluggable[]
): Pluggable[] {
  return [...builtIn, ...custom];
}
