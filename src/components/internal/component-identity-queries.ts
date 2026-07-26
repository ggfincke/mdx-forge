// src/components/internal/component-identity-queries.ts
// query canonical component identity w/o loading authoring metadata

import {
  COMPONENT_IDENTITY_DEFINITIONS,
  FRAMEWORK_COMPONENTS,
  GENERIC_COMPONENTS,
  type GenericComponentName,
} from './component-identity';
import { SHIM_PREFIX, type Framework } from '../registry/types';

const ALL_GENERIC_NAMES: readonly string[] = Object.freeze(
  Object.entries(GENERIC_COMPONENTS).flatMap(([name, config]) => [
    name,
    ...config.aliases,
  ])
);
const GENERIC_NAME_SET: ReadonlySet<string> = new Set(ALL_GENERIC_NAMES);

export function getAllGenericComponentNames(): string[] {
  return [...ALL_GENERIC_NAMES];
}

export function getGenericComponentSet(): Set<string> {
  return new Set(GENERIC_NAME_SET);
}

export function getGenericComponentAliases(
  name: GenericComponentName
): string[] {
  return [...(GENERIC_COMPONENTS[name]?.aliases ?? [])];
}

export function getPrimaryGenericComponentNames(): GenericComponentName[] {
  return Object.keys(GENERIC_COMPONENTS) as GenericComponentName[];
}

export function getCanonicalComponentName(
  nameOrAlias: string
): string | undefined {
  if (Object.hasOwn(GENERIC_COMPONENTS, nameOrAlias)) {
    return nameOrAlias;
  }

  for (const [name, config] of Object.entries(GENERIC_COMPONENTS)) {
    if (config.aliases.includes(nameOrAlias)) {
      return name;
    }
  }

  return undefined;
}

export function getFrameworkComponents<F extends Framework>(
  framework: F
): readonly string[] {
  return [...FRAMEWORK_COMPONENTS[framework]];
}

export function isGenericComponent(name: string): boolean {
  return GENERIC_NAME_SET.has(name);
}

export function isFrameworkComponent(
  name: string,
  framework?: Framework
): boolean {
  if (framework) {
    return FRAMEWORK_COMPONENTS[framework]?.includes(name) ?? false;
  }

  for (const components of Object.values(FRAMEWORK_COMPONENTS)) {
    if (components.includes(name)) {
      return true;
    }
  }
  return false;
}

export function getSemanticAlias(name: string): string | undefined {
  const lowerName = name.toLowerCase();
  for (const definition of COMPONENT_IDENTITY_DEFINITIONS) {
    if (definition.kind !== 'component') {
      continue;
    }
    if (
      'semanticAliases' in definition &&
      (definition.semanticAliases as readonly string[]).includes(lowerName)
    ) {
      return definition.name;
    }
  }
  return undefined;
}

export function getGenericComponentSnippets(): Array<{
  name: string;
  template: string;
  doc: string;
}> {
  const results: Array<{ name: string; template: string; doc: string }> = [];
  for (const definition of COMPONENT_IDENTITY_DEFINITIONS) {
    if (definition.kind !== 'component' || definition.framework !== 'generic') {
      continue;
    }
    if (
      definition.snippetTemplate !== undefined &&
      definition.snippetDoc !== undefined
    ) {
      results.push({
        name: definition.name,
        template: definition.snippetTemplate,
        doc: definition.snippetDoc,
      });
    }
  }
  return results;
}

export function getGenericShimPath(componentName: string): string {
  return `${SHIM_PREFIX}/generic/${componentName}`;
}

export function getFrameworkShimPath(
  framework: Framework,
  componentName: string
): string {
  return `${SHIM_PREFIX}/${framework}/${componentName}`;
}
