// src/compiler/index.ts
// barrel exports for compiler module

export { compileSafe } from './safe/compile';
export { compileSafeDocument } from './safe-document/compile';
export { compileTrusted } from './trusted/compile';
export * from './safe-document/types';

// frontmatter extraction utilities
export {
  extractFrontmatter,
  extractNextraFrontmatter,
} from './pipeline/common/mdx-common';

// no-eval frontmatter parser; hosts must route diagnostics parses through this
export { safeMatter } from '../internal/frontmatter';

// known generic component set for diagnostics
export { KNOWN_GENERIC_COMPONENTS } from './pipeline/remark/generic-components';

// callout & alert type constants for completions
export { VALID_CALLOUT_TYPES, type CalloutType } from '../internal/callout';
export { GITHUB_ALERT_TYPES } from './pipeline/remark/github-alerts';

// plugin loading & merging
export { loadPluginsFromConfig, mergePlugins } from './plugins/loader';

export * from './types';
