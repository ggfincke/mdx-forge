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
    expect(normalizeCalloutType('summary')).toBe('summary');
    expect(normalizeCalloutType('hint')).toBe('hint');
    expect(normalizeCalloutType('success')).toBe('success');
    expect(normalizeCalloutType('question')).toBe('question');
    expect(normalizeCalloutType('failure')).toBe('failure');
    expect(normalizeCalloutType('bug')).toBe('bug');
    expect(normalizeCalloutType('example')).toBe('example');
    expect(normalizeCalloutType('quote')).toBe('quote');
    expect(normalizeCalloutType('todo')).toBe('todo');
    expect(normalizeCalloutType('attention')).toBe('attention');
  });

  it('resolves aliases to canonical types', () => {
    expect(normalizeCalloutType('abstract')).toBe('summary');
    expect(normalizeCalloutType('tldr')).toBe('summary');
    expect(normalizeCalloutType('check')).toBe('success');
    expect(normalizeCalloutType('done')).toBe('success');
    expect(normalizeCalloutType('help')).toBe('question');
    expect(normalizeCalloutType('faq')).toBe('question');
    expect(normalizeCalloutType('fail')).toBe('failure');
    expect(normalizeCalloutType('missing')).toBe('failure');
    expect(normalizeCalloutType('snippet')).toBe('example');
    expect(normalizeCalloutType('cite')).toBe('quote');
    expect(normalizeCalloutType('error')).toBe('danger');
    expect(normalizeCalloutType('warn')).toBe('warning');
  });

  it('normalizes case-insensitively', () => {
    expect(normalizeCalloutType('WARNING')).toBe('warning');
    expect(normalizeCalloutType('Note')).toBe('note');
    expect(normalizeCalloutType('ABSTRACT')).toBe('summary');
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
    expect(isValidCalloutType('summary')).toBe(true);
    expect(isValidCalloutType('question')).toBe(true);
    expect(isValidCalloutType('bug')).toBe(true);
  });

  it('accepts aliases as valid', () => {
    expect(isValidCalloutType('abstract')).toBe(true);
    expect(isValidCalloutType('tldr')).toBe(true);
    expect(isValidCalloutType('error')).toBe(true);
    expect(isValidCalloutType('warn')).toBe(true);
    expect(isValidCalloutType('check')).toBe(true);
    expect(isValidCalloutType('cite')).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(isValidCalloutType('unknown')).toBe(false);
    expect(isValidCalloutType('custom')).toBe(false);
    expect(isValidCalloutType('')).toBe(false);
  });
});
