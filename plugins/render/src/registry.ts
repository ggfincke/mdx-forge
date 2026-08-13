// plugins/render/src/registry.ts
// render-plugin registry facade derived from mdx-forge component identity

import * as coreRegistry from 'mdx-forge/components/registry'
import type {
  ComponentKey,
  ComponentMetadata,
  ComponentSpec,
  FrameworkId,
  PropSpec,
  RegistryIdentity,
} from './registry-types.js'

export type {
  ChildrenKind,
  ComponentKey,
  ComponentMetadata,
  ComponentOpenPropsPolicy,
  ComponentSpec,
  FrameworkId,
  FrontmatterField,
  FrontmatterFieldType,
  FrontmatterSchema,
  PropSpec,
  PropType,
  RegistryIdentity,
} from './registry-types.js'
export { getFrontmatterSchema } from './frontmatter.js'

// minimal structural view of the core registry used only for the import cast
// barrel d.ts export* does not surface core types under NodeNext, so the
// entry shape is mirrored here until the published package fixes that
interface CoreAuthoringMetadata
{
  summary: string
  examples: readonly { code: string }[]
  props: ComponentMetadata['props']
  childrenKind?: ComponentMetadata['childrenKind']
  openProps?: ComponentMetadata['openProps']
}

interface CoreComponentDefinition
{
  kind: 'component'
  framework: FrameworkId
  name: string
  aliases: readonly string[]
  importSpecifiers: readonly string[]
  shimPath: string
  metadata: CoreAuthoringMetadata
}

interface CoreBarrelDefinition
{
  kind: 'barrel'
  framework: FrameworkId
  name: string
  importSpecifiers: readonly string[]
  shimPath: string
  exportNames: readonly string[]
}

type CoreRegistryEntry = CoreComponentDefinition | CoreBarrelDefinition

// the dist build infers COMPONENT_REGISTRY/FRAMEWORK_IDS as deeply-const
// readonly tuples, so a structural cast is required at this import boundary
const core = coreRegistry as unknown as {
  COMPONENT_REGISTRY: readonly CoreRegistryEntry[]
  FRAMEWORK_IDS: readonly FrameworkId[]
}

const CORE_REGISTRY = core.COMPONENT_REGISTRY
const FRAMEWORKS: readonly FrameworkId[] = core.FRAMEWORK_IDS

function isComponentEntry(
  entry: CoreRegistryEntry
): entry is CoreComponentDefinition
{
  return entry.kind === 'component'
}

function componentKey(framework: FrameworkId, name: string): ComponentKey
{
  return `${framework}:${name}`
}

function toIdentity(entry: CoreRegistryEntry): RegistryIdentity
{
  const identity: RegistryIdentity = {
    kind: entry.kind,
    framework: entry.framework,
    name: entry.name,
    aliases: isComponentEntry(entry) ? entry.aliases : [],
    importSpecifiers: [...entry.importSpecifiers],
    shimPath: entry.shimPath,
  }

  if (entry.kind === 'barrel')
  {
    identity.exportNames = [...entry.exportNames]
  }

  return identity
}

function specFromMetadata(entry: CoreComponentDefinition): ComponentSpec
{
  const metadata = entry.metadata
  return {
    framework: entry.framework,
    name: entry.name,
    aliases: [...entry.aliases],
    importSpecifier: entry.importSpecifiers[0],
    importSpecifiers: [...entry.importSpecifiers],
    summary: metadata.summary,
    example: metadata.examples[0]?.code ?? '',
    props: metadata.props,
    childrenKind: metadata.childrenKind,
    openProps: metadata.openProps,
  }
}

function describeProp(prop: PropSpec): Record<string, unknown>
{
  const out: Record<string, unknown> = {
    name: prop.name,
    type: prop.type,
  }
  if (prop.required)
  {
    out.required = true
  }
  if (prop.values)
  {
    out.values = prop.values
  }
  if (prop.valueAliases)
  {
    out.valueAliases = prop.valueAliases
  }
  if (prop.description)
  {
    out.description = prop.description
  }
  if (prop.deprecated)
  {
    out.deprecated = true
    if (prop.deprecatedIn)
    {
      out.deprecatedIn = prop.deprecatedIn
    }
  }
  return out
}

export function describeComponent(
  spec: ComponentSpec
): Record<string, unknown>
{
  return {
    framework: spec.framework,
    name: spec.name,
    aliases: spec.aliases ?? [],
    importSpecifier: spec.importSpecifier,
    importSpecifiers: spec.importSpecifiers,
    summary: spec.summary,
    example: spec.example,
    childrenKind: spec.childrenKind ?? 'block',
    openProps: spec.openProps,
    props: spec.props.map(describeProp),
  }
}

function buildComponentSpecs(
  entries: readonly CoreRegistryEntry[]
): ComponentSpec[]
{
  const specs: ComponentSpec[] = []
  for (const entry of entries)
  {
    if (!isComponentEntry(entry))
    {
      continue
    }
    specs.push(specFromMetadata(entry))
  }
  return specs
}

function groupByFramework<T extends { framework: FrameworkId }>(
  entries: readonly T[]
): Map<FrameworkId, T[]>
{
  const grouped = new Map<FrameworkId, T[]>()
  for (const framework of FRAMEWORKS)
  {
    grouped.set(framework, [])
  }

  for (const entry of entries)
  {
    grouped.get(entry.framework)?.push(entry)
  }

  return grouped
}

const REGISTRY_IDENTITIES: readonly RegistryIdentity[] =
  CORE_REGISTRY.map(toIdentity)
const COMPONENTS: readonly ComponentSpec[] = buildComponentSpecs(CORE_REGISTRY)
const IDENTITIES_BY_FRAMEWORK = groupByFramework(REGISTRY_IDENTITIES)
const BY_FRAMEWORK = groupByFramework(COMPONENTS)
const BY_KEY = new Map<ComponentKey, ComponentSpec>()

for (const spec of COMPONENTS)
{
  const register = (name: string): void =>
  {
    BY_KEY.set(componentKey(spec.framework, name), spec)
  }
  register(spec.name)
  for (const alias of spec.aliases)
  {
    register(alias)
  }
}

export function listFrameworks(): readonly FrameworkId[]
{
  return FRAMEWORKS
}

export function listRegistryIdentitiesForFramework(
  framework: FrameworkId
): readonly RegistryIdentity[]
{
  return IDENTITIES_BY_FRAMEWORK.get(framework) ?? []
}

export function listComponentsForFramework(
  framework: FrameworkId
): readonly ComponentSpec[]
{
  return BY_FRAMEWORK.get(framework) ?? []
}

export function findComponent(
  framework: FrameworkId,
  name: string
): ComponentSpec | undefined
{
  return BY_KEY.get(componentKey(framework, name))
}

export function allComponentNamesForFramework(
  framework: FrameworkId
): readonly string[]
{
  const names = new Set<string>()
  for (const spec of listComponentsForFramework(framework))
  {
    names.add(spec.name)
    for (const alias of spec.aliases)
    {
      names.add(alias)
    }
  }
  return Array.from(names)
}
