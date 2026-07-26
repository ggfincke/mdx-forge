// tests/cross-repo/metadata-contract.test.ts
// verify metadata constants match expected contract values

// ! cross-repo parity: mirror vsc metadata-parity behavior

import { describe, it, expect } from 'vitest'
import {
  CALLOUT_TITLES,
  CALLOUT_TYPE_ALIASES,
  VALID_CALLOUT_TYPES,
} from '../../src/internal/callout'
import {
  CALLOUT_ICONS,
  GITHUB_ICONS,
  GITHUB_ALERT_ICONS,
  FILE_TREE_ICONS,
  LUCIDE_ICONS,
} from '../../src/internal/icons'

describe('metadata contract', () =>
{
  describe('callout type contract', () =>
  {
    it('VALID_CALLOUT_TYPES has exactly 17 expected types', () =>
    {
      expect([...VALID_CALLOUT_TYPES].sort()).toEqual([
        'attention',
        'bug',
        'caution',
        'danger',
        'example',
        'failure',
        'hint',
        'important',
        'info',
        'note',
        'question',
        'quote',
        'success',
        'summary',
        'tip',
        'todo',
        'warning',
      ])
    })

    it('CALLOUT_TITLES values are expected display labels', () =>
    {
      expect(CALLOUT_TITLES).toEqual({
        note: 'Note',
        tip: 'Tip',
        warning: 'Warning',
        danger: 'Danger',
        info: 'Info',
        caution: 'Caution',
        important: 'Important',
        summary: 'Summary',
        hint: 'Hint',
        success: 'Success',
        question: 'Question',
        failure: 'Failure',
        bug: 'Bug',
        example: 'Example',
        quote: 'Quote',
        todo: 'Todo',
        attention: 'Attention',
      })
    })
  })

  describe('callout alias contract', () =>
  {
    it('CALLOUT_TYPE_ALIASES maps expected aliases', () =>
    {
      expect(CALLOUT_TYPE_ALIASES).toEqual({
        abstract: 'summary',
        tldr: 'summary',
        check: 'success',
        done: 'success',
        help: 'question',
        faq: 'question',
        fail: 'failure',
        missing: 'failure',
        snippet: 'example',
        cite: 'quote',
        error: 'danger',
        warn: 'warning',
      })
    })
  })

  describe('icon collection key contract', () =>
  {
    it('CALLOUT_ICONS has expected keys', () =>
    {
      expect(Object.keys(CALLOUT_ICONS).sort()).toEqual([
        'attention',
        'bug',
        'caution',
        'danger',
        'example',
        'failure',
        'hint',
        'important',
        'info',
        'note',
        'question',
        'quote',
        'success',
        'summary',
        'tip',
        'todo',
        'warning',
      ])
    })

    it('GITHUB_ICONS has expected keys', () =>
    {
      expect(Object.keys(GITHUB_ICONS).sort()).toEqual([
        'arrowRight',
        'check',
        'copy',
        'error',
        'important',
        'info',
        'lightbulb',
        'warning',
      ])
    })

    it('GITHUB_ALERT_ICONS has expected keys', () =>
    {
      expect(Object.keys(GITHUB_ALERT_ICONS).sort()).toEqual([
        'CAUTION',
        'IMPORTANT',
        'NOTE',
        'TIP',
        'WARNING',
      ])
    })

    it('FILE_TREE_ICONS has expected keys', () =>
    {
      expect(Object.keys(FILE_TREE_ICONS).sort()).toEqual([
        'chevron',
        'file',
        'folder',
      ])
    })

    it('LUCIDE_ICONS has expected keys', () =>
    {
      expect(Object.keys(LUCIDE_ICONS).sort()).toEqual([
        'arrowRight',
        'check',
        'copy',
      ])
    })
  })
})
