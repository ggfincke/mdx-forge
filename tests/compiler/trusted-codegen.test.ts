// tests/compiler/trusted-codegen.test.ts
// trusted compiler codegen hygiene & default-export regression tests

import { describe, it, expect } from 'vitest'
import { build, transform } from 'esbuild'
import React from 'react'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentType, ReactNode } from 'react'
import {
  compileTrusted,
  KNOWN_GENERIC_COMPONENTS,
} from '../../src/compiler/index'
import type { Root } from 'mdast'
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm'
import { evaluateModule } from '../../src/browser/eval/evaluateModule'
import type { CompilerConfig } from '../../src/compiler/index'
import type { ModuleRuntime } from '../../src/browser/types'

// create library-native CompilerConfig
function createConfig(overrides: Partial<CompilerConfig> = {}): CompilerConfig
{
  return {
    documentPath: '/workspace/test.mdx',
    useHostMarkdownStyles: true,
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  }
}

// parse generated output as a standalone module
async function parseModule(code: string): Promise<void>
{
  await transform(code, { loader: 'js' })
}

// bundle generated output w/ every import treated as external; surfaces
// duplicate-binding errors (e.g. two React imports) that parsing alone misses
async function bundleModule(code: string): Promise<void>
{
  await build({
    stdin: {
      contents: code,
      loader: 'js',
      resolveDir: '/',
      sourcefile: 'doc.js',
    },
    bundle: true,
    write: false,
    format: 'esm',
    logLevel: 'silent',
    plugins: [
      {
        name: 'externalize-all',
        setup(pluginBuild)
        {
          pluginBuild.onResolve({ filter: /.*/ }, (args) =>
            args.kind === 'entry-point'
              ? undefined
              : { path: args.path, external: true }
          )
        },
      },
    ],
  })
}

// execute emitted code through the browser evaluator w/ deterministic imports
async function evaluateCompiledModule(
  code: string
): Promise<Record<string, unknown>>
{
  const transformed = await transform(code, {
    loader: 'js',
    format: 'cjs',
  })
  const componentContext = React.createContext<Record<string, unknown>>({})
  const shortcodeLayout = ({ marker }: { marker?: string }) =>
    React.createElement(
      'span',
      { 'data-shortcode-layout': true, 'data-marker': marker },
      'shortcode'
    )
  const runtimeWrapper = ({ children }: { children?: ReactNode }) =>
    React.createElement('aside', { 'data-runtime-wrapper': true }, children)
  const pageLayout = ({
    children,
    pageMarker,
  }: {
    children?: ReactNode
    pageMarker?: string
  }) =>
  {
    const components = React.useContext(componentContext)
    return React.createElement(
      'main',
      {
        'data-page-layout': true,
        'data-page-marker': pageMarker,
        'data-provider-layout': components.Layout === shortcodeLayout,
        'data-provider-wrapper': components.wrapper === runtimeWrapper,
      },
      children
    )
  }
  const mdxProvider = ({
    children,
    components,
  }: {
    children?: ReactNode
    components?: Record<string, unknown>
  }) =>
    React.createElement(
      componentContext.Provider,
      { value: components ?? {} },
      children
    )
  const useMdxComponents = () => React.useContext(componentContext)
  const runtime: ModuleRuntime = {
    Fragment,
    jsx,
    jsxs,
    useMDXComponents: useMdxComponents,
    require: (specifier) =>
    {
      if (specifier === 'react/jsx-runtime')
      {
        return {
          Fragment: runtime.Fragment,
          jsx: runtime.jsx,
          jsxs: runtime.jsxs,
        }
      }
      if (specifier === '@mdx-js/react')
      {
        return {
          MDXProvider: mdxProvider,
          useMDXComponents: runtime.useMDXComponents,
        }
      }
      if (specifier === 'react')
      {
        return React
      }
      if (specifier === 'vscode-markdown-layout')
      {
        return { createLayout: () => pageLayout }
      }
      if (specifier === './page-layout.jsx')
      {
        return { __esModule: true, default: pageLayout }
      }
      if (specifier === './shortcode-layout.jsx')
      {
        return { __esModule: true, default: shortcodeLayout }
      }
      if (specifier === './runtime-wrapper.jsx')
      {
        return { __esModule: true, default: runtimeWrapper }
      }
      if (
        specifier === './mapped.jsx' ||
        KNOWN_GENERIC_COMPONENTS.has(specifier)
      )
      {
        return {
          __esModule: true,
          default: ({ children }: { children?: ReactNode }) =>
            React.createElement(
              'aside',
              { 'data-codegen-component': specifier },
              children
            ),
        }
      }
      if (specifier === './authored-bindings.js')
      {
        return { value: null }
      }
      throw new Error(`Unexpected compiled import: ${specifier}`)
    },
  }

  return evaluateModule(transformed.code, 'trusted-codegen.mdx', runtime)
}

describe('Trusted codegen hygiene (F6)', () =>
{
  it('authored `import React from "react"` parses & bundles w/o symbol collision', async () =>
  {
    const result = await compileTrusted(
      `import React from 'react'

# Hello

<div>{React.version}</div>
`,
      true,
      createConfig()
    )

    await parseModule(result.code)
    await bundleModule(result.code)
  })

  it('authored & generated binding collisions preserve exports & rendering', async () =>
  {
    let observedImports = false
    const inspectImports = () => (tree: Root) =>
    {
      const imports = tree.children.filter(
        (node) => node.type === 'mdxjsEsm'
      ) as MdxjsEsm[]
      const authored = imports.filter((node) => node.position)
      expect(authored[0].position?.start).toMatchObject({
        line: 1,
        column: 1,
        offset: 0,
      })
      expect(authored[0].value).toContain("import React from 'react'")
      expect(authored[0].value).toContain(
        'import { value as _builtin_Callout_2 }'
      )
      const generated = imports.filter((node) => !node.position)
      expect(generated.length).toBeGreaterThan(3)
      const names = new Set<string>()
      for (const node of generated)
      {
        const declaration = node.data?.estree?.body[0]
        expect(declaration?.type).toBe('ImportDeclaration')
        if (declaration?.type !== 'ImportDeclaration')
        {
          continue
        }
        const name = declaration.specifiers[0].local.name
        expect(names.has(name)).toBe(false)
        names.add(name)
        expect(node.value).toBe(
          `import ${name} from ${JSON.stringify(declaration.source.value)};`
        )
      }
      observedImports = true
    }
    const result = await compileTrusted(
      `import React from 'react'
import { value as _builtin_Callout_2 } from './authored-bindings.js'

export function MDXProvider() { return null }

export const _MDXComponents = 1

export const _OriginalDefault = 2

export const MDXContentWithComponents = 3

export const _builtin_Cal\\u006cout = 7
export const _builtin_Callout_1 = 8
export const { value: _component_Box = 9 } = {}
export const [_component_Box_1 = 10] = []
export const _component_$Widget = 11

# Hello

<Callout>Built-in content</Callout>

<Box>Configured content</Box>

<$Widget>Dollar content</$Widget>

<Box_2>Generated collision content</Box_2>
`,
      true,
      createConfig({
        useHostMarkdownStyles: false,
        configFile: {
          config: {
            components: {
              Box: './mapped.jsx',
              $Widget: './mapped.jsx',
              Box_2: './mapped.jsx',
            },
            remarkPlugins: ['inspect-generated-imports'],
          },
          configDir: '/workspace',
          configPath: '/workspace/.mdx-previewrc.json',
        },
        pluginLoader: {
          resolve: () => '/workspace/inspect-generated-imports.js',
          load: () => ({ default: inspectImports }),
        },
      })
    )

    expect(observedImports).toBe(true)
    await parseModule(result.code)
    await bundleModule(result.code)
    const defaults = result.code.match(/^export default/gm) ?? []
    expect(defaults.length).toBe(1)
    const evaluated = await evaluateCompiledModule(result.code)
    expect(evaluated).toMatchObject({
      _MDXComponents: 1,
      _OriginalDefault: 2,
      MDXContentWithComponents: 3,
      _builtin_Callout: 7,
      _builtin_Callout_1: 8,
      _component_Box: 9,
      _component_Box_1: 10,
      _component_$Widget: 11,
    })
    const rendered = renderToStaticMarkup(
      React.createElement(evaluated.default as ComponentType)
    )
    expect(rendered).toContain('data-codegen-component="Callout"')
    expect(rendered).toContain('Built-in content')
    expect(rendered).toContain('Configured content')
    expect(rendered).toContain('Dollar content')
    expect(rendered).toContain('Generated collision content')
  })

  it('literal-sensitive component paths (apostrophes) stay quoted & parseable', async () =>
  {
    const componentPath = "./component's dir/Fancy.jsx"
    const result = await compileTrusted(
      '# Hi\n\n<Fancy />\n',
      true,
      createConfig({
        configFile: {
          config: { components: { Fancy: componentPath } },
          configPath: '/workspace/.mdx-previewrc.json',
          configDir: '/workspace',
        },
      })
    )

    await parseModule(result.code)
    await bundleModule(result.code)
    expect(result.code).toContain(JSON.stringify(componentPath))
  })

  it('rejects unsupported component keys before compilation w/ a clear error', async () =>
  {
    await expect(
      compileTrusted(
        '# Hi\n',
        true,
        createConfig({
          configFile: {
            config: { components: { 'Foo-Bar': './x.jsx' } },
            configPath: '/workspace/.mdx-previewrc.json',
            configDir: '/workspace',
          },
        })
      )
    ).rejects.toThrow(/Unsupported component name.*Foo-Bar/)
  })

  it('omits the classic React import when the wrapper does not need it', async () =>
  {
    const result = await compileTrusted('# Hello\n', true, {
      documentPath: '/workspace/test.mdx',
      componentsBuiltins: false,
    })

    expect(result.code).not.toMatch(/^import .* from ['"]react['"]/m)
    await parseModule(result.code)
    await bundleModule(result.code)
  })
})

describe('real default-export detection (F7)', () =>
{
  it('fenced `export default` does NOT suppress layout injection', async () =>
  {
    const result = await compileTrusted(
      '# Doc\n\n```js\nexport default demo\n```\n',
      true,
      createConfig({ useHostMarkdownStyles: true })
    )

    expect(result.code).toContain('vscode-markdown-layout')
  })

  it('inline-code `export default` does NOT suppress layout injection', async () =>
  {
    const result = await compileTrusted(
      '# Doc\n\nUse `export default` wisely.\n',
      true,
      createConfig({ useHostMarkdownStyles: true })
    )

    expect(result.code).toContain('vscode-markdown-layout')
  })

  it('a real ESM default export suppresses layout injection', async () =>
  {
    const result = await compileTrusted(
      'export default function Layout({ children }) { return children }\n\n# Hi\n',
      true,
      createConfig({ useHostMarkdownStyles: true })
    )

    expect(result.code).not.toContain('vscode-markdown-layout')
  })

  it('export-as-default suppresses layout injection', async () =>
  {
    const result = await compileTrusted(
      'export function Thing() { return null }\nexport { Thing as default }\n\n# Hi\n',
      true,
      createConfig({ useHostMarkdownStyles: true })
    )

    expect(result.code).not.toContain('vscode-markdown-layout')
  })
})

describe('layout wrapping hygiene (F14)', () =>
{
  const customAuthoredBindings = `---
title: F14
---
import { value as Layout_2 } from './authored-bindings.js'
export const \\u004cayout = 1
export const Layout\\u005f1 = 2
export const { value: Layout_3 = null, ...Layout_4 } = {}
export function Layout_5() {}
export class Layout_6 {}
export const MDXLayout = 10
export const MDXLayout_1 = 11
export const authoredLayoutValue = MDXLayout

# Hi
`
  const hostAuthoredBindings = `import { value as createLayout_2 } from './authored-bindings.js'
export const create\\u004cayout = 1
export const createLayout\\u005f1 = 2
export const [createLayout_3 = null, ...createLayout_4] = []
export function createLayout_5() {}
export class createLayout_6 {}
export const MDXLayout = 10
export const MDXLayout_1 = 11
export const authoredLayoutValue = MDXLayout

# Hi
`

  it('aliases a custom layout past authored bindings & evaluates', async () =>
  {
    const result = await compileTrusted(
      customAuthoredBindings,
      true,
      createConfig({
        componentsBuiltins: false,
        customLayoutFilePath: '/workspace/page-layout.jsx',
        configFile: {
          config: {
            components: {
              wrapper: './runtime-wrapper.jsx',
            },
          },
          configDir: '/workspace',
          configPath: '/workspace/.mdx-previewrc.json',
        },
        useHostMarkdownStyles: false,
      })
    )

    expect(result.code).toMatch(
      /import Layout_7 from ["']\.\/page-layout\.jsx["']/
    )
    expect(result.code).toMatch(/createElement\(_createMdxContent, props\)/)
    expect(result.code).toContain('"data-source-line": "14"')
    expect(result.frontmatter).toEqual({ title: 'F14' })
    await bundleModule(result.code)
    const evaluated = await evaluateCompiledModule(result.code)
    expect(evaluated.default).toBeTypeOf('function')
    expect(evaluated.MDXLayout).toBe(10)
    expect(evaluated.authoredLayoutValue).toBe(10)
    const rendered = renderToStaticMarkup(
      React.createElement(evaluated.default as ComponentType, {
        pageMarker: 'page',
      })
    )
    expect(rendered).toContain('data-page-layout="true"')
    expect(rendered).toContain('data-page-marker="page"')
    expect(rendered).toContain('data-provider-wrapper="true"')
    expect(rendered).not.toContain('data-runtime-wrapper')

    const componentResult = await compileTrusted(
      '# Hi\n\n<Layout marker="shortcode" />\n',
      true,
      createConfig({
        componentsBuiltins: false,
        customLayoutFilePath: '/workspace/page-layout.jsx',
        configFile: {
          config: {
            components: {
              Layout: './shortcode-layout.jsx',
              wrapper: './runtime-wrapper.jsx',
            },
          },
          configDir: '/workspace',
          configPath: '/workspace/.mdx-previewrc.json',
        },
        useHostMarkdownStyles: false,
      })
    )

    expect(componentResult.code).toMatch(
      /import Layout_1 from ["']\.\/page-layout\.jsx["']/
    )
    expect(componentResult.code).toMatch(
      /createElement\(_createMdxContent, props\)/
    )
    await bundleModule(componentResult.code)
    const componentModule = await evaluateCompiledModule(componentResult.code)
    const componentMarkup = renderToStaticMarkup(
      React.createElement(componentModule.default as ComponentType)
    )
    expect(componentMarkup).toContain('data-provider-layout="true"')
    expect(componentMarkup).toContain('data-shortcode-layout="true"')
    expect(componentMarkup).toContain('data-marker="shortcode"')
    expect(componentMarkup).not.toContain('data-runtime-wrapper')
  })

  it('aliases the host layout factory past authored bindings & evaluates', async () =>
  {
    const result = await compileTrusted(
      hostAuthoredBindings,
      true,
      createConfig({
        componentsBuiltins: false,
        useHostMarkdownStyles: true,
      })
    )

    expect(result.code).toMatch(
      /import\s*\{\s*createLayout as createLayout_7\s*\}\s*from\s*["']vscode-markdown-layout["']/
    )
    expect(result.code).toMatch(/createElement\(_createMdxContent, props\)/)
    await bundleModule(result.code)
    const evaluated = await evaluateCompiledModule(result.code)
    expect(evaluated.default).toBeTypeOf('function')
    expect(evaluated.MDXLayout).toBe(10)
    expect(evaluated.authoredLayoutValue).toBe(10)
  })
})
