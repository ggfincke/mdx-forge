// src/components/internal/clipboard.ts
// clipboard API wrapper
// ! cross-repo duplicate: mirror webview clipboard behavior

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
