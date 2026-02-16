// tests/cross-repo/metadata-contract.test.ts
// verify metadata constants match expected contract values
// ! cross-repo parity: mirror test in vsc-mdx-preview/tests/shared/metadata-parity.test.ts
// ! changes to callout metadata must update BOTH test files

import { describe, it, expect } from 'vitest';
import {
  CALLOUT_TITLES,
  CALLOUT_TYPE_ALIASES,
  VALID_CALLOUT_TYPES,
  normalizeCalloutType,
} from '../../src/internal/callout';
import {
  CALLOUT_ICONS,
  GITHUB_ICONS,
  GITHUB_ALERT_ICONS,
  FILE_TREE_ICONS,
  LUCIDE_ICONS,
} from '../../src/internal/icons';

describe('metadata contract', () => {
  describe('callout type contract', () => {
    it('VALID_CALLOUT_TYPES has exactly 7 expected types', () => {
      expect([...VALID_CALLOUT_TYPES].sort()).toEqual([
        'caution',
        'danger',
        'important',
        'info',
        'note',
        'tip',
        'warning',
      ]);
    });

    it('CALLOUT_TITLES values are expected display labels', () => {
      expect(CALLOUT_TITLES).toEqual({
        note: 'Note',
        tip: 'Tip',
        warning: 'Warning',
        danger: 'Danger',
        info: 'Info',
        caution: 'Caution',
        important: 'Important',
      });
    });
  });

  describe('callout alias contract', () => {
    it('CALLOUT_TYPE_ALIASES maps expected aliases', () => {
      expect(CALLOUT_TYPE_ALIASES).toEqual({
        success: 'tip',
        error: 'danger',
        warn: 'warning',
        hint: 'tip',
      });
    });

    it('unknown types default to note', () => {
      expect(normalizeCalloutType('unknown')).toBe('note');
      expect(normalizeCalloutType(undefined)).toBe('note');
    });
  });

  describe('icon collection key contract', () => {
    it('CALLOUT_ICONS has expected keys', () => {
      expect(Object.keys(CALLOUT_ICONS).sort()).toEqual([
        'caution',
        'danger',
        'important',
        'info',
        'note',
        'tip',
        'warning',
      ]);
    });

    it('GITHUB_ICONS has expected keys', () => {
      expect(Object.keys(GITHUB_ICONS).sort()).toEqual([
        'arrowRight',
        'check',
        'copy',
        'error',
        'important',
        'info',
        'lightbulb',
        'warning',
      ]);
    });

    it('GITHUB_ALERT_ICONS has expected keys', () => {
      expect(Object.keys(GITHUB_ALERT_ICONS).sort()).toEqual([
        'CAUTION',
        'IMPORTANT',
        'NOTE',
        'TIP',
        'WARNING',
      ]);
    });

    it('FILE_TREE_ICONS has expected keys', () => {
      expect(Object.keys(FILE_TREE_ICONS).sort()).toEqual([
        'chevron',
        'file',
        'folder',
      ]);
    });

    it('LUCIDE_ICONS has expected keys', () => {
      expect(Object.keys(LUCIDE_ICONS).sort()).toEqual([
        'arrowRight',
        'check',
        'copy',
      ]);
    });
  });
});
