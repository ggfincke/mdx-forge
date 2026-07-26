// src/compiler/safe-document/types.ts
// public JSON-only structured document contract

import { DIAGNOSTIC_CODES } from '../../diagnostics/types'
import type {
  DiagnosticRange,
  DiagnosticSeverity,
} from '../../diagnostics/types'

export const SAFE_DOCUMENT_VERSION = 1 as const

export type SafeDocumentJsonPrimitive = string | number | boolean | null
export type SafeDocumentJsonValue =
  | SafeDocumentJsonPrimitive
  | SafeDocumentJsonValue[]
  | { [key: string]: SafeDocumentJsonValue }

export type SafeDocumentElementTag =
  | 'a'
  | 'blockquote'
  | 'br'
  | 'code'
  | 'del'
  | 'em'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'hr'
  | 'img'
  | 'li'
  | 'ol'
  | 'p'
  | 'pre'
  | 'strong'
  | 'table'
  | 'tbody'
  | 'td'
  | 'th'
  | 'thead'
  | 'tr'
  | 'ul'

export interface SafeDocumentRootNode
{
  type: 'root'
  children: SafeDocumentNode[]
  source?: DiagnosticRange
}

export interface SafeDocumentTextNode
{
  type: 'text'
  value: string
  source?: DiagnosticRange
}

interface SafeDocumentElementNodeBase<
  TTag extends SafeDocumentElementTag,
  TProps extends object,
>
{
  type: 'element'
  tag: TTag
  props: TProps
  children: SafeDocumentNode[]
  source?: DiagnosticRange
}

type SafeDocumentEmptyProps = Record<string, never>

export interface SafeDocumentLinkProps
{
  href: string
  title?: string
}

export interface SafeDocumentImageProps
{
  src: string
  alt: string
  title?: string
}

export interface SafeDocumentCodeProps
{
  language?: string
  meta?: string
}

export interface SafeDocumentOrderedListProps
{
  start?: number
}

export interface SafeDocumentListItemProps
{
  checked?: boolean
}

export interface SafeDocumentTableCellProps
{
  align?: 'left' | 'right' | 'center'
}

type SafeDocumentPropFreeTag = Exclude<
  SafeDocumentElementTag,
  'a' | 'code' | 'img' | 'li' | 'ol' | 'td' | 'th'
>

export type SafeDocumentElementNode =
  | SafeDocumentElementNodeBase<'a', SafeDocumentLinkProps>
  | SafeDocumentElementNodeBase<'code', SafeDocumentCodeProps>
  | SafeDocumentElementNodeBase<'img', SafeDocumentImageProps>
  | SafeDocumentElementNodeBase<'li', SafeDocumentListItemProps>
  | SafeDocumentElementNodeBase<'ol', SafeDocumentOrderedListProps>
  | SafeDocumentElementNodeBase<'td' | 'th', SafeDocumentTableCellProps>
  | SafeDocumentElementNodeBase<SafeDocumentPropFreeTag, SafeDocumentEmptyProps>

export interface SafeDocumentComponentNode
{
  type: 'component'
  name: string
  props: Record<string, SafeDocumentJsonValue>
  children: SafeDocumentNode[]
  source?: DiagnosticRange
}

export interface SafeDocumentUnknownComponentNode
{
  type: 'unknownComponent'
  name: string
  children: SafeDocumentNode[]
  source?: DiagnosticRange
}

export type SafeDocumentNode =
  | SafeDocumentTextNode
  | SafeDocumentElementNode
  | SafeDocumentComponentNode
  | SafeDocumentUnknownComponentNode

export type SafeDocumentDiagnosticCode =
  | typeof DIAGNOSTIC_CODES.UNKNOWN_COMPONENT
  | typeof DIAGNOSTIC_CODES.UNKNOWN_PROP
  | typeof DIAGNOSTIC_CODES.INVALID_PROP_VALUE
  | typeof DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP
  | typeof DIAGNOSTIC_CODES.INVALID_FRONTMATTER
  | typeof DIAGNOSTIC_CODES.BROKEN_LINK
  | typeof DIAGNOSTIC_CODES.MDX_PARSE_ERROR
  | typeof DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE
  | typeof DIAGNOSTIC_CODES.UNSAFE_URL
  | typeof DIAGNOSTIC_CODES.UNSUPPORTED_ELEMENT
  | typeof DIAGNOSTIC_CODES.UNSUPPORTED_ATTRIBUTE
  | typeof DIAGNOSTIC_CODES.UNSUPPORTED_RAW_HTML

export interface SafeDocumentDiagnostic
{
  code: SafeDocumentDiagnosticCode
  ruleId: string
  severity: DiagnosticSeverity
  message: string
  source: 'mdx-forge'
  range?: DiagnosticRange
  data?: Record<string, SafeDocumentJsonValue>
}

export interface SafeDocument
{
  version: typeof SAFE_DOCUMENT_VERSION
  frontmatter: Record<string, SafeDocumentJsonValue>
  root: SafeDocumentRootNode
  diagnostics: SafeDocumentDiagnostic[]
}

export interface SafeDocumentStringSchema
{
  type: 'string'
  enum?: readonly string[]
  format?: 'url'
  maxLength?: number
}

export interface SafeDocumentNumberSchema
{
  type: 'number'
  integer?: boolean
  minimum?: number
  maximum?: number
}

export interface SafeDocumentBooleanSchema
{
  type: 'boolean'
}

export interface SafeDocumentNullSchema
{
  type: 'null'
}

export interface SafeDocumentArraySchema
{
  type: 'array'
  items: SafeDocumentValueSchema
  maxItems?: number
}

export interface SafeDocumentObjectSchema
{
  type: 'object'
  properties: Readonly<Record<string, SafeDocumentValueSchema>>
  required?: readonly string[]
  additionalProperties?: false
  maxProperties?: number
}

export type SafeDocumentValueSchema =
  | SafeDocumentStringSchema
  | SafeDocumentNumberSchema
  | SafeDocumentBooleanSchema
  | SafeDocumentNullSchema
  | SafeDocumentArraySchema
  | SafeDocumentObjectSchema

export type SafeDocumentChildrenPolicy = 'none' | 'optional' | 'required'

export interface SafeDocumentComponentSchema
{
  props?: Readonly<Record<string, SafeDocumentValueSchema>>
  requiredProps?: readonly string[]
  children?: SafeDocumentChildrenPolicy
}

export type SafeDocumentUnknownComponentPolicy = 'reject' | 'inert'
export type SafeDocumentRawHtmlPolicy = 'reject' | 'allow'

export interface SafeDocumentUrlContext
{
  kind: 'element' | 'component'
  name: string
  prop: string
}

export interface SafeDocumentCompileOptions
{
  components?: Readonly<Record<string, SafeDocumentComponentSchema>>
  unknownComponents?: SafeDocumentUnknownComponentPolicy
  rawHtml?: SafeDocumentRawHtmlPolicy
  allowUrl?: (url: string, context: SafeDocumentUrlContext) => boolean
}
