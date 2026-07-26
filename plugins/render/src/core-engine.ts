// plugins/render/src/core-engine.ts
// feature-detected bridge to the unified mdx-forge diagnostics engine w/

// MCP-schema adaptation; older cores (0.6.x) fall back to the legacy lint

import type { Diagnostic, DiagnosticKind, Severity } from './diagnostics.js'
import { suggestMatch } from './diagnostics.js'
import { allComponentNamesForFramework, type FrameworkId } from './registry.js'

// structural view of the extended core analyze API; resolved dynamically
// because the locked minimum core (0.6.2) does not export the subpath
interface CorePoint
{
  line: number
  column: number
}

interface CoreDiagnostic
{
  code: string
  ruleId: string
  severity: string
  message: string
  range?: { start: CorePoint; end: CorePoint }
  data?: Record<string, unknown>
}

export interface CoreAnalyzeResult
{
  diagnostics: CoreDiagnostic[]
  frontmatter: Record<string, unknown>
  content: string
  bodyStartLine: number
  bodyStartColumn: number
  parseError?: { phase: 'frontmatter' | 'mdx'; error: unknown }
}

export interface CoreAnalyzeEngine
{
  analyzeMdxDocument: (
    source: string,
    ctx: { framework: string }
  ) => CoreAnalyzeResult
}

let enginePromise: Promise<CoreAnalyzeEngine | null> | undefined

async function resolveEngine(): Promise<CoreAnalyzeEngine | null>
{
  // dynamic specifier keeps NodeNext typecheck green against 0.6.2 typings
  const specifier = 'mdx-forge/diagnostics/analyze'
  try
  {
    const mod = (await import(specifier)) as Partial<CoreAnalyzeEngine>
    return typeof mod.analyzeMdxDocument === 'function'
      ? (mod as CoreAnalyzeEngine)
      : null
  }
  catch
  {
    return null
  }
}

// memoized: the installed core cannot change within one server process
export function loadCoreEngine(): Promise<CoreAnalyzeEngine | null>
{
  enginePromise ??= resolveEngine()
  return enginePromise
}

// stable MDXF codes -> legacy MCP diagnostic kinds; unknown-component keeps
// its historical error severity, everything else stays a warning
const KIND_BY_CODE: Readonly<
  Record<string, { kind: DiagnosticKind; severity: Severity }>
> = {
  MDXF001: { kind: 'unknown-component', severity: 'error' },
  MDXF002: { kind: 'invalid-prop', severity: 'warning' },
  MDXF003: { kind: 'invalid-prop-value', severity: 'warning' },
  MDXF004: { kind: 'deprecated-alias', severity: 'warning' },
  MDXF005: { kind: 'deprecated-alias', severity: 'warning' },
  MDXF006: { kind: 'missing-required-prop', severity: 'warning' },
  MDXF007: { kind: 'invalid-prop-value', severity: 'warning' },
  MDXF008: { kind: 'unknown-component', severity: 'error' },
}

function str(value: unknown): string | undefined
{
  return typeof value === 'string' ? value : undefined
}

function strings(value: unknown): string[]
{
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
}

function suggestionFor(
  diag: CoreDiagnostic,
  framework: FrameworkId
): string | undefined
{
  const data = diag.data ?? {}
  switch (diag.code)
  {
    case 'MDXF001':
    {
      const semantic = strings(data.suggestions)[0]
      const name = str(data.componentName)
      return (
        semantic ??
        (name
          ? suggestMatch(name, allComponentNamesForFramework(framework))
          : undefined)
      )
    }
    case 'MDXF002':
    {
      const prop = str(data.propName)
      return prop ? suggestMatch(prop, strings(data.knownProps)) : undefined
    }
    case 'MDXF003':
    {
      const values = strings(data.values)
      const value = str(data.value)
      return (value ? suggestMatch(value, values) : undefined) ?? values[0]
    }
    case 'MDXF004':
    case 'MDXF005':
      return str(data.canonical)
    case 'MDXF008':
    {
      const member = str(data.memberName)
      return member
        ? suggestMatch(member, strings(data.allowedMembers))
        : undefined
    }
    default:
      return undefined
  }
}

// translate one core diagnostic into the public MCP shape; diagnostics
// from rules this schema predates are dropped rather than mislabeled
export function fromCoreDiagnostic(
  diag: CoreDiagnostic,
  framework: FrameworkId
): Diagnostic | undefined
{
  const mapping = KIND_BY_CODE[diag.code]
  if (!mapping)
  {
    return undefined
  }
  const data = diag.data ?? {}
  const componentName = str(data.componentName)
  const message =
    diag.code === 'MDXF001' && componentName
      ? `Component <${componentName}> is not in the "${framework}" shim registry.`
      : diag.message
  return {
    kind: mapping.kind,
    severity: mapping.severity,
    message,
    component: componentName,
    prop: str(data.propName),
    line: diag.range?.start.line,
    column: diag.range?.start.column,
    suggestion: suggestionFor(diag, framework),
  }
}
