// tests/browser-exports.test.ts
// verify browser module public API surface

import { describe, expect, it } from 'vitest';
import * as browser from '../src/browser/index';

describe('browser exports', () => {
  it('exposes module runtime helpers', () => {
    expect(typeof browser.loadModule).toBe('function');
    expect(typeof browser.evaluateModule).toBe('function');
    expect(typeof browser.createSyncRequire).toBe('function');
  });
});
