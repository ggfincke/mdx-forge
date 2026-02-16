// tests/components/constants-contract.test.ts
// verify component domain constants match expected contract values
// ! cross-repo parity: mirror test in vsc-mdx-preview/tests/shared/constant-parity.test.ts

import { describe, it, expect } from 'vitest';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../src/components/internal/constants';

describe('component constants contract', () => {
  it('code copy feedback duration matches vsc-mdx-preview value', () => {
    // must match: vsc-mdx-preview/packages/webview-client/src/app/constants.ts
    expect(CODE_COPY_FEEDBACK_DURATION_MS).toBe(2000);
  });
});
