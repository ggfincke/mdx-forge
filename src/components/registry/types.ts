// src/components/registry/types.ts
// interface definitions for component registry (not derived from COMPONENT_REGISTRY)

// framework IDs used by shim registry
export type Framework = 'docusaurus' | 'starlight' | 'nextjs' | 'nextra';
export type FrameworkId = Framework | 'generic';
export type FrameworkSetting = 'auto' | FrameworkId;

// historical shim prefix kept for compatibility w/ existing preload ids/aliases
export const SHIM_PREFIX = '@mdx-preview/shims' as const;

export type ComponentKind = 'component' | 'barrel';

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
}

export interface ComponentBarrelDefinition extends ComponentDefinitionBase {
  kind: 'barrel';

  // export names
  exportNames: readonly string[];
}

export type ComponentRegistryEntry =
  | ComponentDefinition
  | ComponentBarrelDefinition;
