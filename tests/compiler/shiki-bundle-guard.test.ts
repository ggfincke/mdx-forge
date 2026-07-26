// tests/compiler/shiki-bundle-guard.test.ts
// t4 guard: built compiler entry must not statically pull shiki grammars

import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST_COMPILER = join(__dirname, '../../dist/esm/compiler')

// collect .js files recursively
function collectJsFiles(dir: string): string[]
{
  const files: string[] = []
  for (const entry of readdirSync(dir))
  {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
    {
      files.push(...collectJsFiles(full))
    }
    else if (entry.endsWith('.js'))
    {
      files.push(full)
    }
  }
  return files
}

// static ESM import of a grammar bundle or the full shiki package
const STATIC_SHIKI_IMPORT =
  /^\s*import\s[^;]*from\s+['"](?:shiki(?:\/|['"])|@shikijs\/langs)/m

describe.skipIf(!existsSync(DIST_COMPILER))(
  'compiler dist shiki bundle guard',
  () =>
  {
    it('emits no static imports of full shiki or grammar bundles', () =>
    {
      const offenders: string[] = []
      for (const file of collectJsFiles(DIST_COMPILER))
      {
        if (STATIC_SHIKI_IMPORT.test(readFileSync(file, 'utf8')))
        {
          offenders.push(file)
        }
      }
      expect(offenders).toEqual([])
    })

    it('loads grammars only through dynamic import()', () =>
    {
      const shikiFile = join(DIST_COMPILER, 'pipeline/rehype/shiki.js')
      const source = readFileSync(shikiFile, 'utf8')
      expect(source).toContain("import('@shikijs/langs/typescript')")
      expect(source).not.toMatch(/from\s+['"]shiki['"]/)
    })
  }
)
