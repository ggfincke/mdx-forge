// src/components/registry/registry-data.ts
// derive the public registry from canonical component identity

import {
  COMPONENT_IDENTITY_DEFINITIONS,
  type ComponentIdentityDefinition,
  type ComponentIdentityEntry,
} from '../internal/component-identity';
import { COMPONENT_METADATA } from './component-metadata';
import { deepFreeze } from './freeze';
import type {
  ComponentAuthoringMetadata,
  ComponentDefinition,
  ComponentRegistryEntry,
} from './types';

export {
  FRAMEWORK_COMPONENTS,
  GENERIC_COMPONENTS,
  type DocusaurusComponent,
  type GenericComponentAlias,
  type GenericComponentName,
  type NextjsComponent,
  type NextraComponent,
  type StarlightComponent,
} from '../internal/component-identity';

type MetadataKeyFor<Identity extends ComponentIdentityEntry> =
  `${Identity['framework']}:${Identity['name']}`;

type RegistryEntryForIdentity<Identity extends ComponentIdentityDefinition> =
  Identity extends ComponentIdentityEntry
    ? Identity & {
        readonly metadata: MetadataKeyFor<Identity> extends keyof typeof COMPONENT_METADATA
          ? (typeof COMPONENT_METADATA)[MetadataKeyFor<Identity>]
          : never;
      }
    : Identity;

type ComponentRegistryTuple<
  Definitions extends readonly ComponentIdentityDefinition[],
> = {
  readonly [
    Index in keyof Definitions
  ]: Definitions[Index] extends ComponentIdentityDefinition
    ? RegistryEntryForIdentity<Definitions[Index]>
    : never;
};

function buildComponentEntry(
  identity: Omit<ComponentDefinition, 'metadata'>
): ComponentDefinition {
  const {
    name,
    aliases,
    semanticAliases,
    members,
    snippetTemplate,
    snippetDoc,
    framework,
    importSpecifiers,
    shimPath,
    preloadId,
    webviewImport,
    exposeAsBareImport,
    importKind,
    importName,
  } = identity;
  const metadata =
    COMPONENT_METADATA[
      `${framework}:${name}` as keyof typeof COMPONENT_METADATA
    ];

  return {
    kind: 'component',
    name,
    aliases,
    ...(semanticAliases === undefined ? {} : { semanticAliases }),
    ...(members === undefined ? {} : { members }),
    metadata: metadata as ComponentAuthoringMetadata,
    ...(snippetTemplate === undefined ? {} : { snippetTemplate }),
    ...(snippetDoc === undefined ? {} : { snippetDoc }),
    framework,
    importSpecifiers,
    shimPath,
    ...(preloadId === undefined ? {} : { preloadId }),
    ...(webviewImport === undefined ? {} : { webviewImport }),
    ...(exposeAsBareImport === undefined ? {} : { exposeAsBareImport }),
    ...(importKind === undefined ? {} : { importKind }),
    ...(importName === undefined ? {} : { importName }),
  };
}

function buildRegistryEntry(
  identity: ComponentIdentityDefinition
): ComponentRegistryEntry {
  return identity.kind === 'component'
    ? buildComponentEntry(identity)
    : { ...identity };
}

export const COMPONENT_REGISTRY = deepFreeze(
  COMPONENT_IDENTITY_DEFINITIONS.map(buildRegistryEntry)
) as unknown as ComponentRegistryTuple<typeof COMPONENT_IDENTITY_DEFINITIONS>;

export type ComponentRegistryEntryType = (typeof COMPONENT_REGISTRY)[number];
