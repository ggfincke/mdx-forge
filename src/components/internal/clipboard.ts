// src/components/internal/clipboard.ts
// clipboard API wrapper
// ! cross-repo duplicate: vsc-mdx-preview/packages/webview-client/src/shared/utils/clipboard.ts
// ! changes here must be mirrored (GPL licensing prevents shared dependency)

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
