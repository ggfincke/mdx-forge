// plugins/render/src/registry.ts
// render-plugin registry facade derived from mdx-forge component identity

import * as coreRegistry from 'mdx-forge/components/registry';
import { COMPONENT_METADATA as FALLBACK_COMPONENT_METADATA } from './component-metadata.js';
import { getFrontmatterSchema } from './frontmatter.js';
import type {
  ComponentKey,
  ComponentMetadata,
  ComponentSpec,
  FrameworkId,
  RegistryIdentity,
} from './registry-types.js';

export type {
  ChildrenKind,
  ComponentKey,
  ComponentMetadata,
  ComponentSpec,
  FrameworkId,
  FrontmatterField,
  FrontmatterFieldType,
  FrontmatterSchema,
  PropSpec,
  PropType,
  RegistryIdentity,
} from './registry-types.js';
export { getFrontmatterSchema } from './frontmatter.js';

const FRAMEWORKS: readonly FrameworkId[] = [
  'generic',
  'docusaurus',
  'starlight',
  'nextra',
  'nextjs',
];

interface CoreEntryBase {
  kind: 'component' | 'barrel';
  framework: FrameworkId;
  name: string;
  importSpecifiers: readonly string[];
  shimPath: string;
}

interface CoreComponentDefinition extends CoreEntryBase {
  kind: 'component';
  aliases: readonly string[];
  metadata?: CoreAuthoringMetadata;
}

interface CoreBarrelDefinition extends CoreEntryBase {
  kind: 'barrel';
  exportNames: readonly string[];
}

type CoreRegistryEntry = CoreComponentDefinition | CoreBarrelDefinition;

interface CoreComponentExample {
  code: string;
}

interface CoreAuthoringMetadata {
  summary: string;
  examples: readonly CoreComponentExample[];
  props: ComponentMetadata['props'];
  childrenKind?: ComponentMetadata['childrenKind'];
}

// load the public registry value without relying on declaration reexports
const CORE_REGISTRY = (
  coreRegistry as unknown as {
    COMPONENT_REGISTRY: readonly CoreRegistryEntry[];
  }
).COMPONENT_REGISTRY;

function isComponentEntry(
  entry: CoreRegistryEntry
): entry is CoreComponentDefinition {
  return entry.kind === 'component';
}

function componentKey(framework: FrameworkId, name: string): ComponentKey {
  return `${framework}:${name}`;
}

function firstImportSpecifier(entry: CoreRegistryEntry): string | undefined {
  return entry.importSpecifiers[0];
}

function toIdentity(entry: CoreRegistryEntry): RegistryIdentity {
  const identity: RegistryIdentity = {
    kind: entry.kind,
    framework: entry.framework,
    name: entry.name,
    aliases: isComponentEntry(entry) ? entry.aliases : [],
    importSpecifiers: [...entry.importSpecifiers],
    shimPath: entry.shimPath,
  };

  if (entry.kind === 'barrel') {
    identity.exportNames = [...entry.exportNames];
  }

  return identity;
}

function metadataFor(entry: CoreComponentDefinition): ComponentMetadata {
  if (entry.metadata) {
    return {
      summary: entry.metadata.summary,
      example: entry.metadata.examples[0]?.code ?? '',
      props: entry.metadata.props,
      childrenKind: entry.metadata.childrenKind,
    };
  }

  const key = componentKey(entry.framework, entry.name);
  const metadata = FALLBACK_COMPONENT_METADATA[key];
  if (!metadata) {
    throw new Error(`render plugin metadata missing for ${key}`);
  }
  return metadata;
}

function assertMetadataKeys(componentKeys: ReadonlySet<ComponentKey>): void {
  if (COMPONENTS_WITH_CORE_METADATA.size === componentKeys.size) {
    return;
  }

  for (const key of Object.keys(
    FALLBACK_COMPONENT_METADATA
  ) as ComponentKey[]) {
    if (!componentKeys.has(key)) {
      throw new Error(
        `render plugin metadata has no core component for ${key}`
      );
    }
  }
}

const COMPONENTS_WITH_CORE_METADATA = new Set<ComponentKey>();

function buildComponentSpecs(
  entries: readonly CoreRegistryEntry[]
): ComponentSpec[] {
  const componentKeys = new Set<ComponentKey>();
  const specs: ComponentSpec[] = [];

  for (const entry of entries) {
    if (!isComponentEntry(entry)) {
      continue;
    }

    const key = componentKey(entry.framework, entry.name);
    componentKeys.add(key);
    if (entry.metadata) {
      COMPONENTS_WITH_CORE_METADATA.add(key);
    }
    const metadata = metadataFor(entry);
    specs.push({
      framework: entry.framework,
      name: entry.name,
      aliases: [...entry.aliases],
      importSpecifier: firstImportSpecifier(entry),
      importSpecifiers: [...entry.importSpecifiers],
      summary: metadata.summary,
      example: metadata.example,
      props: metadata.props,
      childrenKind: metadata.childrenKind,
    });
  }

  assertMetadataKeys(componentKeys);
  return specs;
}

function groupByFramework<T extends { framework: FrameworkId }>(
  entries: readonly T[]
): Map<FrameworkId, T[]> {
  const grouped = new Map<FrameworkId, T[]>();
  for (const framework of FRAMEWORKS) {
    grouped.set(framework, []);
  }

  for (const entry of entries) {
    grouped.get(entry.framework)?.push(entry);
  }

  return grouped;
}

const REGISTRY_IDENTITIES: readonly RegistryIdentity[] =
  CORE_REGISTRY.map(toIdentity);
const COMPONENTS: readonly ComponentSpec[] = buildComponentSpecs(CORE_REGISTRY);
const IDENTITIES_BY_FRAMEWORK = groupByFramework(REGISTRY_IDENTITIES);
const BY_FRAMEWORK = groupByFramework(COMPONENTS);
const BY_KEY = new Map<ComponentKey, ComponentSpec>();

for (const spec of COMPONENTS) {
  const register = (name: string): void => {
    BY_KEY.set(componentKey(spec.framework, name), spec);
  };
  register(spec.name);
  for (const alias of spec.aliases) {
    register(alias);
  }
}

export function listFrameworks(): readonly FrameworkId[] {
  return FRAMEWORKS;
}

export function listRegistryIdentitiesForFramework(
  framework: FrameworkId
): readonly RegistryIdentity[] {
  return IDENTITIES_BY_FRAMEWORK.get(framework) ?? [];
}

export function listComponentsForFramework(
  framework: FrameworkId
): readonly ComponentSpec[] {
  return BY_FRAMEWORK.get(framework) ?? [];
}

export function findComponent(
  framework: FrameworkId,
  name: string
): ComponentSpec | undefined {
  return BY_KEY.get(componentKey(framework, name));
}

export function allComponentNamesForFramework(
  framework: FrameworkId
): readonly string[] {
  const names = new Set<string>();
  for (const spec of listComponentsForFramework(framework)) {
    names.add(spec.name);
    for (const alias of spec.aliases) {
      names.add(alias);
    }
  }
  return Array.from(names);
}

const INTRINSIC_PATTERN = /^[a-z]/;

export function isIntrinsicTag(name: string): boolean {
  return INTRINSIC_PATTERN.test(name) && !name.includes('.');
}

export function isCompoundChild(name: string): boolean {
  return name.includes('.');
}
