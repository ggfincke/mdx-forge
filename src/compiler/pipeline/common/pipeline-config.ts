// src/compiler/pipeline/common/pipeline-config.ts
// constants for MDX pipeline configuration

// MDX node types to preserve when parsing raw HTML (Trusted Mode only)
// these nodes must not be converted to HTML by rehype-raw
export const MDX_PASSTHROUGH_NODES = [
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
] as const;

// rehype-raw configuration w/ MDX passthrough
export const REHYPE_RAW_CONFIG = {
  passThrough: [...MDX_PASSTHROUGH_NODES],
} as const;
