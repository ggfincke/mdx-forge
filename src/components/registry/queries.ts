// src/components/registry/queries.ts
// expose identity & metadata queries over the derived registry

import { COMPONENT_REGISTRY } from './registry-data';
import type {
  ComponentAuthoringMetadata,
  ComponentDefinition,
  ComponentRegistryEntry,
  FrameworkId,
} from './types';

export {
  getAllGenericComponentNames,
  getCanonicalComponentName,
  getFrameworkComponents,
  getFrameworkShimPath,
  getGenericComponentAliases,
  getGenericComponentSet,
  getGenericComponentSnippets,
  getGenericShimPath,
  getPrimaryGenericComponentNames,
  getSemanticAlias,
  isFrameworkComponent,
  isGenericComponent,
} from '../internal/component-identity-queries';

const REGISTRY_ENTRIES: readonly ComponentRegistryEntry[] = COMPONENT_REGISTRY;

function isComponentEntry(
  entry: ComponentRegistryEntry
): entry is ComponentDefinition {
  return entry.kind === 'component';
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
