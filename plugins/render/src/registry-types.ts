// plugins/render/src/registry-types.ts
// shared registry types for component metadata & render-plugin lookups

import type {
  ComponentAuthoringMetadata,
  ComponentOpenPropsPolicy,
  ComponentPropSpec,
} from 'mdx-forge/components/registry'
import type { FrameworkId as CssFrameworkId } from './css.js'

export type { ComponentOpenPropsPolicy }

export type FrameworkId = CssFrameworkId

export type ComponentKey = `${FrameworkId}:${string}`

export type PropType = ComponentPropSpec['type']

export type PropSpec = ComponentPropSpec

export type ChildrenKind = NonNullable<
  ComponentAuthoringMetadata['childrenKind']
>

export interface ComponentMetadata
{
  summary: string
  example: string
  props: readonly PropSpec[]
  childrenKind?: ChildrenKind
  openProps?: ComponentOpenPropsPolicy
}

export interface ComponentSpec extends ComponentMetadata
{
  framework: FrameworkId
  name: string
  aliases: readonly string[]
  importSpecifier?: string
  importSpecifiers: readonly string[]
}

export interface RegistryIdentity
{
  kind: 'component' | 'barrel'
  framework: FrameworkId
  name: string
  aliases: readonly string[]
  importSpecifiers: readonly string[]
  shimPath: string
  exportNames?: readonly string[]
}

export type FrontmatterFieldType =
  'string' | 'number' | 'boolean' | 'array' | 'object'

export interface FrontmatterField
{
  name: string
  type: FrontmatterFieldType
  required?: boolean
  description?: string
  values?: readonly string[]
}

export interface FrontmatterSchema
{
  framework: FrameworkId
  fields: readonly FrontmatterField[]
  allowUnknown?: boolean
}
