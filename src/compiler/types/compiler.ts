// src/compiler/types/compiler.ts
// compiler configuration & option types

import type { Pluggable } from 'unified';

// how to handle unknown JSX components in Safe Mode
export type UnknownBehavior = 'strip' | 'placeholder' | 'raw';

// plugin specification format
export type PluginSpec = string | [string, Record<string, unknown>];

// plugin pipeline configuration
export interface PluginPipeline {
  remarkPlugins: Pluggable[];
  rehypePlugins: Pluggable[];
}

// component mapping from MDX component name to import path
export type ComponentMapping = Record<string, string>;

// config file schema subset used by the compiler
export interface MdxPreviewConfig {
  remarkPlugins?: PluginSpec[];
  rehypePlugins?: PluginSpec[];
  components?: ComponentMapping;
}

// resolved config metadata
export interface ResolvedConfig {
  config: MdxPreviewConfig;
  configPath: string;
  configDir: string;
}

// lightweight logger contract injected by consumers
export interface CompilerLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// trust validation contract injected by consumers
export interface TrustValidator {
  isTrusted(params: {
    documentPath: string;
    documentUri?: string;
    operation: string;
  }): { canExecute: boolean; reason?: string };
}

// module resolution/loading contract for custom plugins
export interface PluginLoader {
  resolve(specifier: string, fromDir: string): string;
  load(resolvedPath: string): Promise<unknown> | unknown;
}

// plugin loading error payload for consumers
export interface PluginLoadError {
  message: string;
  code: 'PLUGIN_LOAD_ERROR' | 'PLUGIN_INVALID_EXPORT';
  pluginName: string;
  cause?: Error;
}

// error reporting contract injected by consumers
export interface ErrorReporter {
  reportPluginError(error: PluginLoadError): void;
}

// how a document is parsed: lenient CommonMark, strict MDX, or auto-detect
// from the documentPath extension (.md -> md, otherwise mdx)
export type DocumentFormat = 'detect' | 'md' | 'mdx';

// how diagram fences (mermaid/plantuml/graphviz) are emitted
// 'placeholder' keeps empty data-attribute divs for renderer-owning hosts
// 'code' emits a visible, language-labeled code fallback for static hosts
export type DiagramBehavior = 'placeholder' | 'code';

// compiler configuration
export interface CompilerConfig {
  // canonical document path used for relative import generation
  documentPath: string;
  // optional explicit document directory (defaults to dirname(documentPath))
  documentDir?: string;
  // optional document URI for host-specific trust policies
  documentUri?: string;

  // parse mode; defaults to 'detect' (extension-based)
  format?: DocumentFormat;

  // diagram fence output; defaults to 'placeholder' (VS Code host contract)
  diagramBehavior?: DiagramBehavior;

  customLayoutFilePath?: string;
  useHostMarkdownStyles?: boolean;
  useWhiteBackground?: boolean;
  componentsBuiltins?: boolean;
  componentsUnknownBehavior?: UnknownBehavior;
  configFile?: ResolvedConfig | null;

  // injected host services
  logger?: CompilerLogger;
  trustValidator?: TrustValidator;
  pluginLoader?: PluginLoader;
  errorReporter?: ErrorReporter;

  // optional resolver for safe-mode component labels
  componentNameResolver?: (name: string) => string | undefined;
}

// result of extracting frontmatter from MDX text
export interface FrontmatterResult {
  content: string;
  frontmatter: Record<string, unknown>;
  // 1-based body line in the original doc; 1 w/o frontmatter
  bodyStartLine: number;
  // 1-based body column in the original doc; 1 w/o frontmatter
  bodyStartColumn: number;
}

// result of Trusted Mode transpilation
export interface MdxTranspileResult {
  code: string;
  frontmatter: Record<string, unknown>;
}

// result of Safe Mode HTML compilation
export interface SafeHTMLResult {
  html: string;
  frontmatter: Record<string, unknown>;
}

// Nextra page metadata extracted from frontmatter
export interface NextraPageMeta {
  title?: string;
  layout?: 'default' | 'full' | 'raw';
  description?: string;
  toc?: boolean;
}
