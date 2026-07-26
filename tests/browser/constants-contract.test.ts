// tests/browser/constants-contract.test.ts
// verify browser domain constants match expected contract values

// these values must align w/ vsc-mdx-preview contracts/runtime/constants.ts

import { describe, it, expect } from 'vitest'
import { PRELOADED_MODULE_IDS } from '../../src/browser/types'

describe('browser constants contract', () =>
{
  it('PRELOADED_MODULE_IDS values match vsc-mdx-preview contracts', () =>
  {
    // must match: packages/contracts/src/runtime/preloaded-modules.ts
    expect(PRELOADED_MODULE_IDS.react).toBe('npm://react@18')
    expect(PRELOADED_MODULE_IDS.reactDom).toBe('npm://react-dom@18')
    expect(PRELOADED_MODULE_IDS.reactDomClient).toBe(
      'npm://react-dom/client@18'
    )
    expect(PRELOADED_MODULE_IDS.jsxRuntime).toBe('npm://react/jsx-runtime@18')
    expect(PRELOADED_MODULE_IDS.jsxDevRuntime).toBe(
      'npm://react/jsx-dev-runtime@18'
    )
    expect(PRELOADED_MODULE_IDS.mdxReact).toBe('npm://@mdx-js/react@3')
    expect(PRELOADED_MODULE_IDS.vscodeLayout).toBe(
      'npm://vscode-markdown-layout@0.1.0'
    )
  })
})
