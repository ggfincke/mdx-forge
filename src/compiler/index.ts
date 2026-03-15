// src/compiler/index.ts
// barrel exports for compiler module

export { compileSafe } from './safe/compile';
export { compileTrusted } from './trusted/compile';

// frontmatter extraction utilities
export {
  extractFrontmatter,
  extractNextraFrontmatter,
} from './pipeline/common/mdx-common';

// known generic component set for diagnostics
export { KNOWN_GENERIC_COMPONENTS } from './pipeline/remark/generic-components';

// callout & alert type constants for completions
export { VALID_CALLOUT_TYPES, type CalloutType } from '../internal/callout';
export { GITHUB_ALERT_TYPES } from './pipeline/remark/github-alerts';

// plugin loading & merging
export { loadPluginsFromConfig, mergePlugins } from './plugins/loader';

export * from './types';
