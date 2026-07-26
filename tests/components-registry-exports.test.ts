// tests/components-registry-exports.test.ts
// verify component registry public API surface

import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

describe('components registry exports', () =>
{
  it('keeps the registry entrypoint free of React component shims', async () =>
  {
    const result = await build({
      absWorkingDir: process.cwd(),
      bundle: true,
      entryPoints: ['src/components/registry/index.ts'],
      format: 'esm',
      logLevel: 'silent',
      metafile: true,
      platform: 'node',
      write: false,
    })
    const inputs = Object.keys(result.metafile?.inputs ?? {})
    const componentShims = inputs.filter(
      (input) => input.startsWith('src/components/') && input.endsWith('.tsx')
    )

    expect(componentShims).toEqual([])
    expect(inputs.some((input) => input.includes('node_modules/react'))).toBe(
      false
    )
  })

  it('keeps compiler identity consumers off authoring metadata', async () =>
  {
    const result = await build({
      absWorkingDir: process.cwd(),
      bundle: true,
      entryPoints: [
        'src/compiler/pipeline/remark/generic-components.ts',
        'src/compiler/safe/compile.ts',
        'src/compiler/trusted/component-mapper.ts',
      ],
      format: 'esm',
      logLevel: 'silent',
      metafile: true,
      outdir: 'identity-consumers',
      platform: 'node',
      write: false,
    })
    const inputs = Object.keys(result.metafile?.inputs ?? {})

    expect(inputs).toContain('src/components/internal/component-identity.ts')
    expect(inputs).toContain(
      'src/components/internal/component-identity-queries.ts'
    )
    expect(inputs).not.toContain(
      'src/components/registry/component-metadata.ts'
    )
    expect(inputs).not.toContain('src/components/registry/registry-data.ts')
    expect(inputs).not.toContain('src/components/registry/queries.ts')
    expect(inputs.some((input) => input.includes('node_modules/react'))).toBe(
      false
    )
  })
})
