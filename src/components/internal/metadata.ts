// src/components/internal/metadata.ts
// react-free shim metadata tuples

export type NextraCalloutType =
  'default' | 'info' | 'warning' | 'error' | 'important'

export const NEXTRA_CALLOUT_TYPES: readonly NextraCalloutType[] = [
  'default',
  'info',
  'warning',
  'error',
  'important',
] as const

export type AsideType = 'note' | 'tip' | 'caution' | 'danger'

export const ASIDE_TYPES: readonly AsideType[] = [
  'note',
  'tip',
  'caution',
  'danger',
] as const

export type BadgeVariant =
  'note' | 'tip' | 'caution' | 'danger' | 'success' | 'default'

export const BADGE_VARIANTS: readonly BadgeVariant[] = [
  'note',
  'tip',
  'caution',
  'danger',
  'success',
  'default',
] as const

export type BadgeSize = 'small' | 'medium' | 'large'

export const BADGE_SIZES: readonly BadgeSize[] = [
  'small',
  'medium',
  'large',
] as const
