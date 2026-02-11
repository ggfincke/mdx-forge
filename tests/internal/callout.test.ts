// tests/internal/callout.test.ts
// callout type normalization & validation — cross-domain contract

import { describe, it, expect } from 'vitest';
import {
  normalizeCalloutType,
  isValidCalloutType,
} from '../../src/internal/callout';

describe('normalizeCalloutType()', () => {
  it('passes through valid callout types unchanged', () => {
    expect(normalizeCalloutType('note')).toBe('note');
    expect(normalizeCalloutType('tip')).toBe('tip');
    expect(normalizeCalloutType('warning')).toBe('warning');
    expect(normalizeCalloutType('danger')).toBe('danger');
    expect(normalizeCalloutType('info')).toBe('info');
    expect(normalizeCalloutType('caution')).toBe('caution');
    expect(normalizeCalloutType('important')).toBe('important');
  });

  it('resolves aliases to canonical types', () => {
    expect(normalizeCalloutType('success')).toBe('tip');
    expect(normalizeCalloutType('error')).toBe('danger');
    expect(normalizeCalloutType('warn')).toBe('warning');
    expect(normalizeCalloutType('hint')).toBe('tip');
  });

  it('normalizes case-insensitively', () => {
    expect(normalizeCalloutType('WARNING')).toBe('warning');
    expect(normalizeCalloutType('Note')).toBe('note');
    expect(normalizeCalloutType('SUCCESS')).toBe('tip');
    expect(normalizeCalloutType('Error')).toBe('danger');
  });

  it('falls back to note for unknown types', () => {
    expect(normalizeCalloutType('unknown')).toBe('note');
    expect(normalizeCalloutType('custom')).toBe('note');
    expect(normalizeCalloutType('')).toBe('note');
  });

  it('falls back to note for undefined input', () => {
    expect(normalizeCalloutType(undefined)).toBe('note');
  });
});

describe('isValidCalloutType()', () => {
  it('accepts valid callout types', () => {
    expect(isValidCalloutType('note')).toBe(true);
    expect(isValidCalloutType('danger')).toBe(true);
    expect(isValidCalloutType('important')).toBe(true);
  });

  it('accepts aliases as valid', () => {
    expect(isValidCalloutType('success')).toBe(true);
    expect(isValidCalloutType('error')).toBe(true);
    expect(isValidCalloutType('warn')).toBe(true);
    expect(isValidCalloutType('hint')).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(isValidCalloutType('unknown')).toBe(false);
    expect(isValidCalloutType('custom')).toBe(false);
    expect(isValidCalloutType('')).toBe(false);
  });
});
