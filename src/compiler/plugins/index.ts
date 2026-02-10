// src/compiler/plugins/index.ts
// barrel exports for plugin subsystem

export {
  buildTrustedRemarkPlugins,
  buildTrustedRehypePlugins,
  buildTrustedPluginPipeline,
  getSafeRemarkPlugins,
  getSafeRehypePluginSets,
  REHYPE_RAW_CONFIG,
} from './builder';

export { loadPluginsFromConfig, mergePlugins } from './loader';
export { parsePluginSpec, getPluginName } from './utils';
