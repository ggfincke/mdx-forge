// tests/compiler-plugins-exports.test.ts
// verify compiler plugin public API surface

import { describe, expect, it } from 'vitest';
import {
  REHYPE_RAW_CONFIG,
  buildTrustedPluginPipeline,
  buildTrustedRehypePlugins,
  buildTrustedRemarkPlugins,
  getPluginName,
  getSafeRehypePluginSets,
  getSafeRemarkPlugins,
  loadPluginsFromConfig,
  mergePlugins,
  parsePluginSpec,
} from '../src/compiler/plugins/index';

describe('compiler plugins exports', () => {
  it('exposes stable compiler plugin helpers', () => {
    expect(typeof buildTrustedPluginPipeline).toBe('function');
    expect(typeof buildTrustedRehypePlugins).toBe('function');
    expect(typeof buildTrustedRemarkPlugins).toBe('function');
    expect(typeof getPluginName).toBe('function');
    expect(typeof getSafeRehypePluginSets).toBe('function');
    expect(typeof getSafeRemarkPlugins).toBe('function');
    expect(typeof loadPluginsFromConfig).toBe('function');
    expect(typeof mergePlugins).toBe('function');
    expect(typeof parsePluginSpec).toBe('function');
    expect(typeof REHYPE_RAW_CONFIG).toBe('object');
  });
});
