// vitest.config.ts
// test runner configuration

import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const localPath = (path: string): string =>
  fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      'mdx-forge/browser': localPath('./src/browser/index.ts'),
      'mdx-forge/components/registry': localPath(
        './src/components/registry/index.ts'
      ),
      'mdx-forge/compiler': localPath('./src/compiler/index.ts'),
    },
  },
  test: {
    environment: 'node',
    execArgv: ['--no-experimental-webstorage'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
