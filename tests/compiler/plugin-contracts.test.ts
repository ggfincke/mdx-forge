// tests/compiler/plugin-contracts.test.ts
// plugin list isolation, cached loading, & load error classification

import { describe, expect, it } from 'vitest'
import { compileSafe, compileTrusted } from '../../src/compiler'
import {
  buildTrustedRemarkPlugins,
  getSafeRehypePluginSets,
  getSafeRemarkPlugins,
} from '../../src/compiler/plugins/builder'
import {
  clearPluginLoadCache,
  loadPluginsFromConfig,
  mergePlugins,
} from '../../src/compiler/plugins/loader'
import type {
  CompilerConfig,
  LoadedPlugins,
  PluginLoadError,
  PluginLoader,
  ResolvedConfig,
} from '../../src/compiler/types'
import type { Pluggable } from 'unified'

function compilerConfig(
  overrides: Partial<CompilerConfig> = {}
): CompilerConfig
{
  return {
    documentPath: '/workspace/test.mdx',
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    useHostMarkdownStyles: true,
    ...overrides,
  }
}

describe('plugin array isolation', () =>
{
  it('preserves safe helpers & compiles after caller mutation', async () =>
  {
    const remarkCount = getSafeRemarkPlugins().length
    const rehypeSets = getSafeRehypePluginSets()
    const preMathCount = rehypeSets.preMath.length
    const postMathCount = rehypeSets.postMath.length

    getSafeRemarkPlugins().splice(0)
    rehypeSets.preMath.splice(0)
    rehypeSets.postMath.splice(0)

    expect(getSafeRemarkPlugins()).toHaveLength(remarkCount)
    expect(getSafeRehypePluginSets().preMath).toHaveLength(preMathCount)
    expect(getSafeRehypePluginSets().postMath).toHaveLength(postMathCount)

    const result = await compileSafe(
      '# Heading\n\n| A |\n| - |\n| B |',
      compilerConfig()
    )
    expect(result.html).toContain('id="heading"')
    expect(result.html).toContain('<table')
  })

  it('always returns a new merged array isolated from the built-in list', () =>
  {
    const plugin = (() => undefined) as Pluggable
    const builtIn = [plugin]
    const merged = mergePlugins(builtIn, [])

    expect(merged).not.toBe(builtIn)
    merged.splice(0)
    expect(builtIn).toEqual([plugin])
  })

  it('preserves trusted compiles after mutating a built list', async () =>
  {
    const emptyPlugins: LoadedPlugins = {
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    }
    const remarkCount = buildTrustedRemarkPlugins(emptyPlugins).length

    buildTrustedRemarkPlugins(emptyPlugins).splice(0)

    expect(buildTrustedRemarkPlugins(emptyPlugins)).toHaveLength(remarkCount)
    const result = await compileTrusted('# Heading', true, compilerConfig())
    expect(result.code).toContain('data-source-line')
  })
})

describe('plugin load errors', () =>
{
  it.each([
    {
      failure: 'resolution',
      expectedCode: 'PLUGIN_LOAD_ERROR',
      loader: {
        resolve: () =>
        {
          throw new Error('missing package')
        },
        load: () => ({ default: () => undefined }),
      },
    },
    {
      failure: 'module load',
      expectedCode: 'PLUGIN_LOAD_ERROR',
      loader: {
        resolve: () => '/workspace/plugin.js',
        load: () =>
        {
          throw new Error('module crashed')
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
  ] as const)(
    'reports $failure failures as $expectedCode',
    async ({ expectedCode, loader }) =>
    {
      const errors: PluginLoadError[] = []
      const config: ResolvedConfig = {
        config: { remarkPlugins: ['test-plugin'] },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      }

      const result = await loadPluginsFromConfig(
        config,
        compilerConfig({
          pluginLoader: loader as PluginLoader,
          errorReporter: {
            reportPluginError: (error) => errors.push(error),
          },
        })
      )

      expect(result.errorCount).toBe(1)
      expect(errors).toHaveLength(1)
      expect(errors[0].code).toBe(expectedCode)
    }
  )
})

describe('plugin load cache', () =>
{
  it('loads delayed specs concurrently once & replays ordered results', async () =>
  {
    clearPluginLoadCache()
    try
    {
      const plugins = {
        first: (() => undefined) as Pluggable,
        third: (() => undefined) as Pluggable,
      }
      const delays: Record<string, number> = {
        first: 40,
        second: 5,
        third: 30,
        fourth: 1,
      }
      const loadCalls: string[] = []
      const completions: string[] = []
      const loader: PluginLoader = {
        resolve: (name) => `/workspace/${name}.js`,
        load: async (resolvedPath) =>
        {
          const name = resolvedPath
            .slice(resolvedPath.lastIndexOf('/') + 1)
            .replace(/\.js$/, '')
          loadCalls.push(name)
          await new Promise((resolve) => setTimeout(resolve, delays[name]))
          completions.push(name)
          if (name === 'second')
          {
            return { default: 42 }
          }
          if (name === 'fourth')
          {
            throw new Error('delayed failure')
          }
          return {
            default: plugins[name as keyof typeof plugins],
          }
        },
      }
      const config: ResolvedConfig = {
        config: {
          remarkPlugins: ['first', 'second', 'third', 'fourth'],
        },
        configPath: '/workspace/.mdx-previewrc.json',
        configDir: '/workspace',
      }
      const firstErrors: PluginLoadError[] = []
      const secondErrors: PluginLoadError[] = []

      const first = await loadPluginsFromConfig(
        config,
        compilerConfig({
          pluginLoader: loader,
          errorReporter: {
            reportPluginError: (error) => firstErrors.push(error),
          },
        })
      )
      const second = await loadPluginsFromConfig(
        config,
        compilerConfig({
          pluginLoader: loader,
          errorReporter: {
            reportPluginError: (error) => secondErrors.push(error),
          },
        })
      )

      expect(loadCalls).toEqual(['first', 'second', 'third', 'fourth'])
      expect(completions).toEqual(['fourth', 'second', 'third', 'first'])
      expect(first.remarkPlugins).toEqual([plugins.first, plugins.third])
      expect(second.remarkPlugins).toEqual([plugins.first, plugins.third])
      expect(second.remarkPlugins).not.toBe(first.remarkPlugins)
      expect(first.errorCount).toBe(2)
      expect(second.errorCount).toBe(2)
      expect(
        firstErrors.map(({ pluginName, code }) => [pluginName, code])
      ).toEqual([
        ['second', 'PLUGIN_INVALID_EXPORT'],
        ['fourth', 'PLUGIN_LOAD_ERROR'],
      ])
      expect(
        secondErrors.map(({ pluginName, code }) => [pluginName, code])
      ).toEqual([
        ['second', 'PLUGIN_INVALID_EXPORT'],
        ['fourth', 'PLUGIN_LOAD_ERROR'],
      ])
    }
    finally
    {
      clearPluginLoadCache()
    }
  })
})
