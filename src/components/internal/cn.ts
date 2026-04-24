// src/components/internal/cn.ts
// class name concatenation utility
// ! cross-repo duplicate: mirror webview cn behavior

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
