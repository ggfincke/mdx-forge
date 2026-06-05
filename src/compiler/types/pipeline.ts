// src/compiler/types/pipeline.ts
// type definitions for MDX pipeline configuration

import type { Pluggable } from 'unified';

// warning codes for MDX pipeline operations
export enum PipelineWarningCode {
  // Safe Mode warnings
  CUSTOM_PLUGINS_IGNORED = 'MDX001',
  CUSTOM_COMPONENTS_IGNORED = 'MDX002',

  // plain-markdown (.md) format warnings
  MARKDOWN_CONFIG_IGNORED = 'MDX009',
}

// structured warning object
export interface PipelineWarning {
  code: PipelineWarningCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

// result of loading plugins from config
export interface LoadedPlugins {
  // custom remark plugins
  remarkPlugins: Pluggable[];
  // custom rehype plugins
  rehypePlugins: Pluggable[];
  // failed plugin count
  errorCount: number;
}

// parsed plugin specification w/ separated name & options
export interface ParsedPluginSpec {
  // plugin name
  name: string;
  // plugin options
  options: Record<string, unknown> | undefined;
}
