// src/compiler/plugins/builder.ts
// shared MDX plugin pipeline construction for trusted & safe compilers

import type { Pluggable } from 'unified';
import rehypeRawPkg from 'rehype-raw';
import {
  sharedRemarkPlugins,
  sharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from './shared-plugins';
import type { LoadedPlugins, PluginPipeline } from '../types';
import { REHYPE_RAW_CONFIG } from '../pipeline/common/pipeline-config';
import { mergePlugins } from './loader';

// build the remark plugin array for Trusted Mode (merge shared & custom plugins)
export function buildTrustedRemarkPlugins(
  customPlugins: LoadedPlugins
): Pluggable[] {
  return mergePlugins(sharedRemarkPlugins, customPlugins.remarkPlugins);
}

// build the rehype plugin array for Trusted Mode (rehype-raw, math, shiki, custom)
export function buildTrustedRehypePlugins(
  customPlugins: LoadedPlugins
): Pluggable[] {
  const basePlugins: Pluggable[] = [
    [rehypeRawPkg, REHYPE_RAW_CONFIG],
    ...sharedRehypePluginsPreMath,
    rehypeKatex,
    ...sharedRehypePluginsPostMath,
  ];

  return mergePlugins(basePlugins, customPlugins.rehypePlugins);
}

// build the complete plugin pipeline for Trusted Mode
export function buildTrustedPluginPipeline(
  customPlugins: LoadedPlugins
): PluginPipeline {
  return {
    remarkPlugins: buildTrustedRemarkPlugins(customPlugins),
    rehypePlugins: buildTrustedRehypePlugins(customPlugins),
  };
}

// get shared remark plugins for Safe Mode (does not support custom plugins)
export function getSafeRemarkPlugins(): Pluggable[] {
  return sharedRemarkPlugins;
}

// get shared rehype plugins for Safe Mode (separate arrays for unified().use() pattern)
export function getSafeRehypePluginSets(): {
  preMath: Pluggable[];
  math: Pluggable;
  postMath: Pluggable[];
} {
  return {
    preMath: sharedRehypePluginsPreMath,
    math: rehypeKatex,
    postMath: sharedRehypePluginsPostMath,
  };
}
