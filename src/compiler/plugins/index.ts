// src/compiler/plugins/index.ts
// barrel exports for plugin subsystem

export {
  buildTrustedRemarkPlugins,
  buildTrustedRehypePlugins,
  buildTrustedPluginPipeline,
  getSafeRemarkPlugins,
  getSafeRehypePluginSets,
} from './builder';

export { REHYPE_RAW_CONFIG } from '../pipeline/common/pipeline-config';

export { loadPluginsFromConfig, mergePlugins } from './loader';
export { parsePluginSpec, getPluginName } from './utils';
