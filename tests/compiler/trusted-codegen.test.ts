// tests/compiler/trusted-codegen.test.ts
// t4: Trusted codegen hygiene (F6) & real default-export detection (F7)

import { describe, it, expect } from 'vitest'
import { build, transform } from 'esbuild'
import { compileTrusted } from '../../src/compiler/index'
import type { CompilerConfig } from '../../src/compiler/index'

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

  it('authored wrapper-name collisions parse & bundle', async () =>
  {
    const result = await compileTrusted(
      `import React from 'react'

export function MDXProvider() { return null }

export const _MDXComponents = 1

export const _OriginalDefault = 2

export const MDXContentWithComponents = 3

# Hello
`,
      true,
      createConfig()
    )

    await parseModule(result.code)
    await bundleModule(result.code)
    // exactly one module-level default export survives the wrapping
    const defaults = result.code.match(/^export default/gm) ?? []
    expect(defaults.length).toBe(1)
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
