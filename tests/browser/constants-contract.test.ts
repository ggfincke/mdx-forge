// tests/browser/constants-contract.test.ts
// verify browser domain constants match expected contract values
// these values must align w/ vsc-mdx-preview contracts/runtime/constants.ts

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SHIM_LOAD_MAX_RETRIES,
  DEFAULT_SHIM_LOAD_RETRY_DELAY_MS,
  DEFAULT_MAX_MODULE_LOAD_DEPTH,
  DEFAULT_MAX_CONCURRENT_FETCHES,
  DEFAULT_MAX_MODULES,
  DEFAULT_MAX_MEMORY_BYTES,
  DEFAULT_MAX_STYLES,
} from '../../src/browser/internal/constants';
import { PRELOADED_MODULE_IDS } from '../../src/browser/types';

describe('browser constants contract', () => {
  it('shim retry constants match vsc-mdx-preview contracts', () => {
    // must match: packages/contracts/src/runtime/constants.ts
    expect(DEFAULT_SHIM_LOAD_MAX_RETRIES).toBe(3);
    expect(DEFAULT_SHIM_LOAD_RETRY_DELAY_MS).toBe(200);
  });

  it('module loading limits are within expected bounds', () => {
    expect(DEFAULT_MAX_MODULE_LOAD_DEPTH).toBe(100);
    expect(DEFAULT_MAX_CONCURRENT_FETCHES).toBe(8);
  });

  it('registry cache defaults are within expected bounds', () => {
    expect(DEFAULT_MAX_MODULES).toBe(500);
    expect(DEFAULT_MAX_MEMORY_BYTES).toBe(50 * 1024 * 1024);
    expect(DEFAULT_MAX_STYLES).toBe(100);
  });

  it('PRELOADED_MODULE_IDS values match vsc-mdx-preview contracts', () => {
    // must match: packages/contracts/src/runtime/preloaded-modules.ts
    expect(PRELOADED_MODULE_IDS.react).toBe('npm://react@18');
    expect(PRELOADED_MODULE_IDS.reactDom).toBe('npm://react-dom@18');
    expect(PRELOADED_MODULE_IDS.reactDomClient).toBe(
      'npm://react-dom/client@18'
    );
    expect(PRELOADED_MODULE_IDS.jsxRuntime).toBe('npm://react/jsx-runtime@18');
    expect(PRELOADED_MODULE_IDS.mdxReact).toBe('npm://@mdx-js/react@3');
    expect(PRELOADED_MODULE_IDS.vscodeLayout).toBe(
      'npm://vscode-markdown-layout@0.1.0'
    );
  });
});
