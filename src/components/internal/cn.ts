// src/components/internal/cn.ts
// class name concatenation utility
// ! cross-repo duplicate: vsc-mdx-preview/packages/webview-client/src/shared/utils/cn.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
