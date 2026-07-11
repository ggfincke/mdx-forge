// src/components/starlight/icon-map.ts
// starlight icon name -> emoji fallbacks shared by Card & TabItem shims

import type { ReactNode } from 'react';

// supported subset of Starlight's built-in icon set
export const STARLIGHT_ICON_MAP: Record<string, string> = {
  star: '⭐',
  rocket: '🚀',
  document: '📄',
  pencil: '✏️',
  puzzle: '🧩',
  setting: '⚙️',
  information: 'ℹ️',
  'open-book': '📖',
  warning: '⚠️',
  error: '❌',
  check: '✅',
  heart: '❤️',
  lightning: '⚡',
  sun: '☀️',
  moon: '🌙',
  external: '🔗',
  seti: '📁',
};

// resolve a Starlight icon name to its emoji; unknown names & custom
// nodes pass through unchanged
export function resolveStarlightIcon(icon: ReactNode): ReactNode {
  if (typeof icon === 'string') {
    return STARLIGHT_ICON_MAP[icon] ?? icon;
  }
  return icon;
}
