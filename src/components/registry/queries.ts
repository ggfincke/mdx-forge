// src/components/registry/queries.ts
// query & lookup functions for the component registry

import {
  COMPONENT_REGISTRY,
  GENERIC_COMPONENTS,
  FRAMEWORK_COMPONENTS,
  type GenericComponentName,
} from './registry-data';
import {
  SHIM_PREFIX,
  type ComponentAuthoringMetadata,
  type ComponentDefinition,
  type ComponentRegistryEntry,
  type Framework,
  type FrameworkId,
} from './types';

// private immutable lookup state; public helpers return defensive copies
const ALL_GENERIC_NAMES: readonly string[] = Object.freeze(
  Object.entries(GENERIC_COMPONENTS).flatMap(([name, config]) => [
    name,
    ...config.aliases,
  ])
);
const GENERIC_NAME_SET: ReadonlySet<string> = new Set(ALL_GENERIC_NAMES);
const REGISTRY_ENTRIES: readonly ComponentRegistryEntry[] = COMPONENT_REGISTRY;
const FRAMEWORK_COMPONENTS_BY_ID: Readonly<Record<string, readonly string[]>> =
  FRAMEWORK_COMPONENTS;

function isComponentEntry(
  entry: ComponentRegistryEntry
): entry is ComponentDefinition {
  return entry.kind === 'component';
}

// get all generic component names including aliases
// returns a copy; mutation cannot alter canonical lookup state
export function getAllGenericComponentNames(): string[] {
  return [...ALL_GENERIC_NAMES];
}

// get Set of all generic component names for O(1) lookup
// returns a copy; mutation cannot alter canonical lookup state
export function getGenericComponentSet(): Set<string> {
  return new Set(GENERIC_NAME_SET);
}

// get aliases for a generic component by primary name
// returns a copy; mutation cannot alter registry data
export function getGenericComponentAliases(
  name: GenericComponentName
): string[] {
  return [...(GENERIC_COMPONENTS[name]?.aliases ?? [])];
}

// get primary generic component names only (no aliases)
export function getPrimaryGenericComponentNames(): GenericComponentName[] {
  return Object.keys(GENERIC_COMPONENTS) as GenericComponentName[];
}

// get canonical component name for alias
export function getCanonicalComponentName(
  nameOrAlias: string
): string | undefined {
  if (nameOrAlias in GENERIC_COMPONENTS) {
    return nameOrAlias;
  }

  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    if (config.aliases.includes(nameOrAlias)) {
      return name;
    }
  }

  return undefined;
}

// get component names for specific framework
export function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly string[] {
  return FRAMEWORK_COMPONENTS[framework];
}

export function getFrameworkComponentEntries(
  framework: FrameworkId
): readonly ComponentDefinition[] {
  const entries: ComponentDefinition[] = [];
  for (const entry of REGISTRY_ENTRIES) {
    if (isComponentEntry(entry) && entry.framework === framework) {
      entries.push(entry);
    }
  }
  return entries;
}

export function findComponentEntry(
  framework: FrameworkId,
  name: string
): ComponentDefinition | undefined {
  for (const entry of REGISTRY_ENTRIES) {
    if (!isComponentEntry(entry)) {
      continue;
    }
    if (entry.framework !== framework) {
      continue;
    }
    if (entry.name === name || entry.aliases.includes(name)) {
      return entry;
    }
  }
  return undefined;
}

export function getComponentMetadata(
  framework: FrameworkId,
  name: string
): ComponentAuthoringMetadata | undefined {
  return findComponentEntry(framework, name)?.metadata;
}

// check if component name is known generic component (including aliases)
export function isGenericComponent(name: string): boolean {
  return GENERIC_NAME_SET.has(name);
}

// check if component name is framework-specific component
export function isFrameworkComponent(
  name: string,
  framework?: Framework
): boolean {
  if (framework) {
    return FRAMEWORK_COMPONENTS_BY_ID[framework]?.includes(name) ?? false;
  }

  for (const components of Object.values(FRAMEWORK_COMPONENTS)) {
    if (components.includes(name)) {
      return true;
    }
  }
  return false;
}

// get canonical component name for a semantic alias (e.g., "note" -> "Callout")
export function getSemanticAlias(name: string): string | undefined {
  const lowerName = name.toLowerCase();
  for (const entry of REGISTRY_ENTRIES) {
    if (!isComponentEntry(entry)) {
      continue;
    }
    if (entry.semanticAliases?.includes(lowerName)) {
      return entry.name;
    }
  }
  return undefined;
}

// get generic component snippet data for completions
export function getGenericComponentSnippets(): Array<{
  name: string;
  template: string;
  doc: string;
}> {
  const results: Array<{ name: string; template: string; doc: string }> = [];
  for (const entry of REGISTRY_ENTRIES) {
    if (!isComponentEntry(entry) || entry.framework !== 'generic') {
      continue;
    }
    if (entry.snippetTemplate !== undefined && entry.snippetDoc !== undefined) {
      results.push({
        name: entry.name,
        template: entry.snippetTemplate,
        doc: entry.snippetDoc,
      });
    }
  }
  return results;
}

// get shim path for generic component
export function getGenericShimPath(componentName: string): string {
  return `${SHIM_PREFIX}/generic/${componentName}`;
}

// get shim path for framework component
export function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string {
  return `${SHIM_PREFIX}/${framework}/${componentName}`;
}
