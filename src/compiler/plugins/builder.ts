// src/compiler/plugins/builder.ts
// shared MDX plugin pipeline construction for trusted & safe compilers

import type { Pluggable } from 'unified';
import rehypeRawPkg from 'rehype-raw';
import {
  sharedRemarkPlugins,
  getSharedRehypePluginsPreMath,
  sharedRehypePluginsPostMath,
  rehypeKatex,
} from './shared-plugins';
import type { DiagramBehavior, LoadedPlugins, PluginPipeline } from '../types';
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
  customPlugins: LoadedPlugins,
  diagramBehavior?: DiagramBehavior
): Pluggable[] {
  const basePlugins: Pluggable[] = [
    [rehypeRawPkg, REHYPE_RAW_CONFIG],
    ...getSharedRehypePluginsPreMath(diagramBehavior),
    rehypeKatex,
    ...sharedRehypePluginsPostMath,
  ];

  return mergePlugins(basePlugins, customPlugins.rehypePlugins);
}

// build the complete plugin pipeline for Trusted Mode
export function buildTrustedPluginPipeline(
  customPlugins: LoadedPlugins,
  diagramBehavior?: DiagramBehavior
): PluginPipeline {
  return {
    remarkPlugins: buildTrustedRemarkPlugins(customPlugins),
    rehypePlugins: buildTrustedRehypePlugins(customPlugins, diagramBehavior),
  };
}

// get shared remark plugins for Safe Mode (does not support custom plugins)
export function getSafeRemarkPlugins(): Pluggable[] {
  return sharedRemarkPlugins;
}

// get rehype plugins for Safe Mode (rehype-raw, diagram, math & post-math)
export function getSafeRehypePluginSets(diagramBehavior?: DiagramBehavior): {
  raw: Pluggable;
  preMath: Pluggable[];
  math: Pluggable;
  postMath: Pluggable[];
} {
  return {
    raw: [rehypeRawPkg, REHYPE_RAW_CONFIG] as Pluggable,
    preMath: getSharedRehypePluginsPreMath(diagramBehavior),
    math: rehypeKatex,
    postMath: sharedRehypePluginsPostMath,
  };
}
