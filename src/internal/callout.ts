// src/internal/callout.ts
// shared callout type definitions & normalization

export type CalloutType =
  | 'note'
  | 'tip'
  | 'warning'
  | 'danger'
  | 'info'
  | 'caution'
  | 'important'
  | 'summary'
  | 'hint'
  | 'success'
  | 'question'
  | 'failure'
  | 'bug'
  | 'example'
  | 'quote'
  | 'todo'
  | 'attention';

export const VALID_CALLOUT_TYPES: readonly CalloutType[] = [
  'note',
  'tip',
  'warning',
  'danger',
  'info',
  'caution',
  'important',
  'summary',
  'hint',
  'success',
  'question',
  'failure',
  'bug',
  'example',
  'quote',
  'todo',
  'attention',
] as const;

export const VALID_CALLOUT_TYPE_SET: ReadonlySet<string> = new Set(
  VALID_CALLOUT_TYPES
);

export const CALLOUT_TYPE_ALIASES: Readonly<Record<string, CalloutType>> = {
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
} as const;

export const CALLOUT_TITLES: Readonly<Record<CalloutType, string>> = {
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
} as const;

// shared shape for callout/admonition/alert config objects
export interface CalloutStyleConfig {
  className: string;
  label: string;
  icon: string;
}

export function normalizeCalloutType(type: string | undefined): CalloutType {
  if (!type) {
    return 'note';
  }

  const normalized = type.toLowerCase();
  if (normalized in CALLOUT_TYPE_ALIASES) {
    return CALLOUT_TYPE_ALIASES[normalized];
  }

  if (VALID_CALLOUT_TYPE_SET.has(normalized)) {
    return normalized as CalloutType;
  }

  return 'note';
}

export function isValidCalloutType(type: string): boolean {
  const normalized = type.toLowerCase();
  return (
    VALID_CALLOUT_TYPE_SET.has(normalized) || normalized in CALLOUT_TYPE_ALIASES
  );
}
