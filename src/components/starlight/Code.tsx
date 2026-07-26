// src/components/starlight/Code.tsx
// starlight Code component shim for MDX Preview

// provide preview-compatible version of @astrojs/starlight/components Code

import { createCodeBlock, type BaseCodeBlockProps } from '../base/BaseCodeBlock'

// languages that should use terminal frame by default
const TERMINAL_LANGUAGES = new Set([
  'bash',
  'sh',
  'zsh',
  'shell',
  'console',
  'powershell',
  'ps1',
  'cmd',
  'batch',
])

// code component using shared factory
export const Code = createCodeBlock({
  classPrefix: 'mdx-preview-starlight-code',
  codeAsString: true,
  supportsFrames: true,
  terminalLanguages: TERMINAL_LANGUAGES,
  showLangBadgeWithTitle: false,
})

// public props derive from the base implementation; `code` is required
// (unsupported Starlight props like mark/locale are deliberately absent)
export type CodeProps = Omit<BaseCodeBlockProps, 'code'> & { code: string }

export default Code
