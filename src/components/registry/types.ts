// src/components/registry/types.ts
// interface definitions for component registry (not derived from COMPONENT_REGISTRY)

// framework IDs used by shim registry
export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';
export type FrameworkId = Framework | 'generic';
export type FrameworkSetting = 'auto' | FrameworkId;

// historical shim prefix kept for compatibility w/ existing preload ids/aliases
export const SHIM_PREFIX = '@mdx-preview/shims' as const;

export type ComponentKind = 'component' | 'barrel';
export type ComponentKey = `${FrameworkId}:${string}`;

export type ComponentPropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'function'
  | 'node'
  | 'enum'
  | 'union';

export interface ComponentPropSpec {
  name: string;
  type: ComponentPropType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  values?: readonly string[];
  valueAliases?: Readonly<Record<string, string>>;
  description?: string;
  deprecated?: boolean;
  deprecatedIn?: string;
  replacement?: string;
}

export type ComponentChildrenKind =
  'none' | 'text' | 'block' | 'tabitems' | 'steps';

export interface ComponentExample {
  code: string;
  title?: string;
  description?: string;
}

export type ComponentSafeModeSupport = 'full' | 'fallback' | 'unsupported';

export interface ComponentSafeModeMetadata {
  support: ComponentSafeModeSupport;
  fallback?: string;
}

export interface ComponentAliasMetadata {
  name: string;
  canonical: string;
  deprecated?: boolean;
  deprecatedIn?: string;
  replacement?: string;
  description?: string;
}

export interface ComponentOpenPropsPolicy {
  dom?: boolean;
  dataAttributes?: boolean;
  ariaAttributes?: boolean;
  eventHandlers?: boolean;
  unknown?: boolean;
}

export interface ComponentAuthoringMetadata {
  summary: string;
  props: readonly ComponentPropSpec[];
  examples: readonly ComponentExample[];
  childrenKind?: ComponentChildrenKind;
  safeMode: ComponentSafeModeMetadata;
  cssDeps?: readonly FrameworkId[];
  aliasDocs?: readonly ComponentAliasMetadata[];
  openProps?: ComponentOpenPropsPolicy;
}

export interface ComponentDefinitionBase {
  // canonical name
  name: string;

  // framework
  framework: FrameworkId;

  // import aliases
  importSpecifiers: readonly string[];

  // shim path
  shimPath: string;

  // host-specific preload ID (optional, computed by consumers)
  preloadId?: string;

  // host-specific webview import path (optional, computed by consumers)
  webviewImport?: string;

  // expose bare
  exposeAsBareImport?: boolean;
}

export interface ComponentDefinition extends ComponentDefinitionBase {
  kind: 'component';

  // aliases
  aliases: readonly string[];

  // compound component statics exposed by the runtime
  members?: readonly string[];

  // semantic aliases (e.g., "note" -> Callout, "accordion" -> Collapsible)
  semanticAliases?: readonly string[];

  // VS Code snippet template (uses $1, $2 placeholders)
  snippetTemplate?: string;

  // snippet documentation string
  snippetDoc?: string;

  // import kind
  importKind?: 'default' | 'named';

  // import name
  importName?: string;

  // authoring metadata
  metadata: ComponentAuthoringMetadata;
}

export interface ComponentBarrelDefinition extends ComponentDefinitionBase {
  kind: 'barrel';

  // export names
  exportNames: readonly string[];
}

export type ComponentRegistryEntry =
  ComponentDefinition | ComponentBarrelDefinition;
