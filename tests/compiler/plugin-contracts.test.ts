// tests/compiler/plugin-contracts.test.ts
// plugin list isolation, cached loading, & load error classification

import { describe, expect, it, vi } from 'vitest'
import { createProcessor } from '@mdx-js/mdx'
import rehypeRaw from 'rehype-raw'
import { VFile } from 'vfile'
import type { Root } from 'hast'
import rehypeRawWithSourceView from '../../src/compiler/pipeline/rehype/raw'
import { REHYPE_RAW_CONFIG } from '../../src/compiler/pipeline/common/pipeline-config'
import { pointAtOffset, SOURCE_START } from '../../src/internal/source-position'
import { compileSafe, compileTrusted } from '../../src/compiler'
import {
  buildTrustedRemarkPlugins,
  buildTrustedPluginPipeline,
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
import type { Pluggable, Processor } from 'unified'

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

describe('trusted raw normalization adapter', () =>
{
  it('matches stock normalized trees & positions without changing the original VFile', () =>
  {
    const rawRoot = (source: string): Root => ({
      type: 'root',
      children: [
        {
          type: 'raw',
          value: source,
          position: {
            start: { ...SOURCE_START },
            end: pointAtOffset(source, source.length),
          },
        },
      ],
    })
    const synthetic = { start: { ...SOURCE_START }, end: { ...SOURCE_START } }
    const mdxSource = '<Widget>content</Widget>\r\nnext'
    const fixtures: { source: string; tree: Root }[] = [
      ...[
        '',
        '<!doctype html><html><head><title>Doc</title></head><body><p>a<div>b</div>c</p></body></html>',
        '<table>before<tr><td>A</td></tr>after</table><!-- comment -->',
        '<template><p>bounded</p><template>nested</template></template>',
        '<template><div>unclosed',
        '<div>one\r\ntwo\rthree\nfour</div>',
      ].map((source) => ({ source, tree: rawRoot(source) })),
      {
        source: mdxSource,
        tree: {
          type: 'root',
          children: [
            {
              type: 'mdxJsxFlowElement',
              name: 'Widget',
              attributes: [],
              children: rawRoot('<template>inner').children,
              data: {
                preserved: {
                  type: 'root',
                  children: [],
                  position: structuredClone(synthetic),
                },
                bounded: {
                  type: 'root',
                  children: [],
                  position: {
                    start: { line: 3, column: 2, offset: 5 },
                    end: { line: 3, column: 8, offset: 11 },
                  },
                },
                unpositioned: { type: 'root', children: [] },
              },
            },
          ],
        },
      },
    ]
    const stock = rehypeRaw(REHYPE_RAW_CONFIG)
    const adapted = rehypeRawWithSourceView(REHYPE_RAW_CONFIG)
    for (const { source, tree } of fixtures)
    {
      const file = new VFile({
        value: source,
        path: '/workspace/raw.mdx',
        data: { marker: { keep: true } },
      })
      file.message('existing message')
      const stringify = vi.spyOn(file, 'toString')
      const descriptors = Object.getOwnPropertyDescriptors(file)
      const data = structuredClone(file.data)
      const history = [...file.history]
      const messages = [...file.messages]
      const expected = stock(
        structuredClone(tree),
        new VFile({ value: source })
      )
      const actual = adapted(structuredClone(tree), file)

      expect(actual).toEqual(expected)
      expect(stringify.mock.calls.length).toBeLessThanOrEqual(1)
      expect(Object.getOwnPropertyDescriptors(file)).toEqual(descriptors)
      expect(file.value).toBe(source)
      expect(file.data).toEqual(data)
      expect(file.history).toEqual(history)
      expect(file.messages).toEqual(messages)
      stringify.mockRestore()
    }

    const unsupported = {
      type: 'root',
      children: [{ type: 'unknown-node' }],
    } as unknown as Root
    const failedFile = new VFile({
      value: 'unchanged source',
      path: '/workspace/failure.mdx',
    })
    const before = Object.getOwnPropertyDescriptors(failedFile)
    expect(() =>
      stock(structuredClone(unsupported), new VFile('unchanged source'))
    ).toThrow(/unknown-node/)
    expect(() => adapted(structuredClone(unsupported), failedFile)).toThrow(
      /unknown-node/
    )
    expect(Object.getOwnPropertyDescriptors(failedFile)).toEqual(before)
  })

  it('keeps the original raw plugin registration when custom remark or rehype plugins use it', async () =>
  {
    const empty: LoadedPlugins = {
      remarkPlugins: [],
      rehypePlugins: [],
      errorCount: 0,
    }
    const optimized = buildTrustedPluginPipeline(empty)
    expect(optimized.rehypePlugins[1]).toEqual([
      rehypeRawWithSourceView,
      REHYPE_RAW_CONFIG,
    ])
    expect(getSafeRehypePluginSets().raw).toEqual([
      rehypeRaw,
      REHYPE_RAW_CONFIG,
    ])
    const source = '# Heading\n\n<div><p>text<div>block</div>tail</p></div>\n'
    const expected = await createProcessor({
      format: 'md',
      ...optimized,
    }).process(source)
    const observedValues: unknown[] = []
    let registrations = 0
    function reuseRaw(this: Processor)
    {
      registrations++
      this.use(rehypeRaw, REHYPE_RAW_CONFIG)
      return (_tree: unknown, file: VFile) =>
      {
        observedValues.push(file.value)
      }
    }

    for (const custom of [
      { ...empty, remarkPlugins: [reuseRaw] },
      { ...empty, rehypePlugins: [reuseRaw] },
    ])
    {
      const pipeline = buildTrustedPluginPipeline(custom)
      expect(pipeline.rehypePlugins[1]).toEqual([rehypeRaw, REHYPE_RAW_CONFIG])
      const processor = createProcessor({ format: 'md', ...pipeline })
      const actual = await processor.process(source)
      expect(
        processor.attachers.filter(([plugin]) => plugin === rehypeRaw)
      ).toHaveLength(1)
      expect(
        processor.attachers.some(
          ([plugin]) => plugin === rehypeRawWithSourceView
        )
      ).toBe(false)
      expect(String(actual)).toBe(String(expected))
    }
    expect(registrations).toBe(2)
    expect(observedValues).toEqual([source, source])
  })
})
