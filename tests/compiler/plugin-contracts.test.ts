// tests/compiler/plugin-contracts.test.ts
// regression coverage for plugin list isolation & load error classification

import { describe, expect, it } from 'vitest';
import { compileSafe, compileTrusted } from '../../src/compiler';
import {
  buildTrustedRemarkPlugins,
  getSafeRehypePluginSets,
  getSafeRemarkPlugins,
} from '../../src/compiler/plugins/builder';
import {
  loadPluginsFromConfig,
  mergePlugins,
} from '../../src/compiler/plugins/loader';
import {
  sharedRehypePluginsPostMath,
  sharedRemarkPlugins,
} from '../../src/compiler/plugins/shared-plugins';
import type {
  CompilerConfig,
  LoadedPlugins,
  PluginLoadError,
  PluginLoader,
  ResolvedConfig,
} from '../../src/compiler/types';
import type { Pluggable } from 'unified';

function compilerConfig(
  overrides: Partial<CompilerConfig> = {}
): CompilerConfig {
  return {
    documentPath: '/workspace/test.mdx',
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    useHostMarkdownStyles: true,
    ...overrides,
  };
}

describe('plugin array isolation', () => {
  it('preserves safe helpers & compiles after caller mutation', async () => {
    const remarkCount = getSafeRemarkPlugins().length;
    const rehypeSets = getSafeRehypePluginSets();
    const preMathCount = rehypeSets.preMath.length;
    const postMathCount = rehypeSets.postMath.length;

    getSafeRemarkPlugins().splice(0);
    rehypeSets.preMath.splice(0);
    rehypeSets.postMath.splice(0);

    expect(getSafeRemarkPlugins()).toHaveLength(remarkCount);
    expect(getSafeRehypePluginSets().preMath).toHaveLength(preMathCount);
    expect(getSafeRehypePluginSets().postMath).toHaveLength(postMathCount);

    const result = await compileSafe(
      '# Heading\n\n| A |\n| - |\n| B |',
      compilerConfig()
    );
    expect(result.html).toContain('id="heading"');
    expect(result.html).toContain('<table');
  });

  it('freezes shared lists & always returns a new merged array', () => {
    const plugin = (() => undefined) as Pluggable;
    const builtIn = [plugin];
    const merged = mergePlugins(builtIn, []);

    expect(Object.isFrozen(sharedRemarkPlugins)).toBe(true);
    expect(Object.isFrozen(sharedRehypePluginsPostMath)).toBe(true);
    expect(merged).not.toBe(builtIn);
    merged.splice(0);
    expect(builtIn).toEqual([plugin]);
  });

  it('preserves trusted compiles after mutating a built list', async () => {
    const emptyPlugins: LoadedPlugins = {
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    };
    const remarkCount = buildTrustedRemarkPlugins(emptyPlugins).length;

    buildTrustedRemarkPlugins(emptyPlugins).splice(0);

    expect(buildTrustedRemarkPlugins(emptyPlugins)).toHaveLength(
      remarkCount
    );
    const result = await compileTrusted('# Heading', true, compilerConfig());
    expect(result.code).toContain('data-source-line');
  });
});

describe('plugin load errors', () => {
  it.each([
    {
      failure: 'resolution',
      expectedCode: 'PLUGIN_LOAD_ERROR',
      loader: {
        resolve: () => {
          throw new Error('missing package');
        },
        load: () => ({ default: () => undefined }),
      },
    },
    {
      failure: 'module load',
      expectedCode: 'PLUGIN_LOAD_ERROR',
      loader: {
        resolve: () => '/workspace/plugin.js',
        load: () => {
          throw new Error('module crashed');
        },
      },
    },
    {
      failure: 'invalid export',
      expectedCode: 'PLUGIN_INVALID_EXPORT',
      loader: {
        resolve: () => '/workspace/plugin.js',
        load: () => ({ default: 42 }),
      },
    },
  ] as const)('reports $failure failures as $expectedCode', async ({
    expectedCode,
    loader,
  }) => {
    const errors: PluginLoadError[] = [];
    const config: ResolvedConfig = {
      config: { remarkPlugins: ['test-plugin'] },
      configPath: '/workspace/.mdx-previewrc.json',
      configDir: '/workspace',
    };

    const result = await loadPluginsFromConfig(
      config,
      compilerConfig({
        pluginLoader: loader as PluginLoader,
        errorReporter: {
          reportPluginError: (error) => errors.push(error),
        },
      })
    );

    expect(result.errorCount).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(expectedCode);
  });
});
