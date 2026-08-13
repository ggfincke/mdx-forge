// plugins/render/src/core-engine.ts
// adapts canonical mdx-forge diagnostics to the MCP transport shape

import {
  DIAGNOSTIC_CODES,
  type Diagnostic as CoreDiagnostic,
} from 'mdx-forge/diagnostics'
import type { Diagnostic, DiagnosticKind, Severity } from './diagnostics.js'
import { suggestMatch } from './diagnostics.js'
import { allComponentNamesForFramework, type FrameworkId } from './registry.js'

// stable MDXF codes -> legacy MCP diagnostic kinds; unknown-component keeps
// its historical error severity, everything else stays a warning
const KIND_BY_CODE: Readonly<
  Partial<
    Record<CoreDiagnostic['code'], { kind: DiagnosticKind; severity: Severity }>
  >
> = {
  [DIAGNOSTIC_CODES.UNKNOWN_COMPONENT]: {
    kind: 'unknown-component',
    severity: 'error',
  },
  [DIAGNOSTIC_CODES.UNKNOWN_PROP]: {
    kind: 'invalid-prop',
    severity: 'warning',
  },
  [DIAGNOSTIC_CODES.INVALID_ENUM_VALUE]: {
    kind: 'invalid-prop-value',
    severity: 'warning',
  },
  [DIAGNOSTIC_CODES.DEPRECATED_PROP]: {
    kind: 'deprecated-alias',
    severity: 'warning',
  },
  [DIAGNOSTIC_CODES.DEPRECATED_ALIAS]: {
    kind: 'deprecated-alias',
    severity: 'warning',
  },
  [DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP]: {
    kind: 'missing-required-prop',
    severity: 'warning',
  },
  [DIAGNOSTIC_CODES.INVALID_PROP_VALUE]: {
    kind: 'invalid-prop-value',
    severity: 'warning',
  },
  [DIAGNOSTIC_CODES.UNKNOWN_COMPOUND_MEMBER]: {
    kind: 'unknown-component',
    severity: 'error',
  },
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
  const data = (diag.data ?? {}) as Record<string, unknown>
  switch (diag.code)
  {
    case DIAGNOSTIC_CODES.UNKNOWN_COMPONENT:
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
    case DIAGNOSTIC_CODES.UNKNOWN_PROP:
    {
      const prop = str(data.propName)
      return prop ? suggestMatch(prop, strings(data.knownProps)) : undefined
    }
    case DIAGNOSTIC_CODES.INVALID_ENUM_VALUE:
    {
      const values = strings(data.values)
      const value = str(data.value)
      return (value ? suggestMatch(value, values) : undefined) ?? values[0]
    }
    case DIAGNOSTIC_CODES.DEPRECATED_PROP:
    case DIAGNOSTIC_CODES.DEPRECATED_ALIAS:
      return str(data.canonical)
    case DIAGNOSTIC_CODES.UNKNOWN_COMPOUND_MEMBER:
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
  const data = (diag.data ?? {}) as Record<string, unknown>
  const componentName = str(data.componentName)
  const message =
    diag.code === DIAGNOSTIC_CODES.UNKNOWN_COMPONENT && componentName
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
