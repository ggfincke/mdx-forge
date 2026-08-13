// plugins/render/src/lint.ts
// canonical MDX analysis w/ plugin frontmatter diagnostics

import { analyzeMdxDocument } from 'mdx-forge/diagnostics/analyze'
import type { Diagnostic } from './diagnostics.js'
import {
  buildMissingFrontmatterDiagnostic,
  normalizeCompileError,
  suggestMatch,
} from './diagnostics.js'
import type { FrameworkId, FrontmatterField } from './registry.js'
import { getFrontmatterSchema } from './registry.js'
import { fromCoreDiagnostic } from './core-engine.js'

export interface LintResult
{
  frontmatter: Record<string, unknown>
  content: string
  diagnostics: Diagnostic[]
  // populated when canonical analysis cannot parse the source
  fatal?: Diagnostic
}

// --- frontmatter lint -------------------------------------------------------

function typeOfFrontmatterValue(value: unknown): FrontmatterField['type']
{
  if (Array.isArray(value))
  {
    return 'array'
  }
  if (value === null)
  {
    return 'object'
  }
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean')
  {
    return t as FrontmatterField['type']
  }
  return 'object'
}

export function lintFrontmatter(
  frontmatter: Record<string, unknown>,
  framework: FrameworkId
): Diagnostic[]
{
  const schema = getFrontmatterSchema(framework)
  const fieldsByName = new Map(schema.fields.map((f) => [f.name, f]))
  const out: Diagnostic[] = []

  // required-missing checks upgrade to errors (callers decide whether to fail)
  for (const field of schema.fields)
  {
    if (field.required && !(field.name in frontmatter))
    {
      out.push(buildMissingFrontmatterDiagnostic(field.name, framework))
    }
  }

  for (const [name, value] of Object.entries(frontmatter))
  {
    const field = fieldsByName.get(name)
    if (!field)
    {
      if (schema.allowUnknown === false)
      {
        out.push({
          kind: 'unknown-frontmatter',
          severity: 'warning',
          message: `Unknown frontmatter field "${name}" for framework "${framework}".`,
          field: name,
          suggestion: suggestMatch(
            name,
            schema.fields.map((f) => f.name)
          ),
        })
      }
      continue
    }
    const actual = typeOfFrontmatterValue(value)
    if (actual !== field.type)
    {
      out.push({
        kind: 'invalid-frontmatter-type',
        severity: 'warning',
        message: `Frontmatter field "${name}" should be ${field.type}, got ${actual}.`,
        field: name,
      })
      continue
    }
    if (
      field.values &&
      typeof value === 'string' &&
      !field.values.includes(value)
    )
    {
      out.push({
        kind: 'invalid-frontmatter-type',
        severity: 'warning',
        message: `Frontmatter field "${name}" value "${value}" is not one of ${field.values.join(', ')}.`,
        field: name,
        suggestion: suggestMatch(value, field.values),
      })
    }
  }

  return out
}

function frontmatterFatal(err: unknown): Diagnostic
{
  return {
    kind: 'mdx-syntax',
    severity: 'error',
    message: `frontmatter parse failed: ${err instanceof Error ? err.message : String(err)}`,
  }
}

// one core parse feeds component, member & prop rules w/ file-relative
// positions; frontmatter schema lint stays plugin-owned
export async function lintMdxSource(
  source: string,
  framework: FrameworkId
): Promise<LintResult>
{
  const result = analyzeMdxDocument(source, { framework })
  if (result.parseError?.phase === 'frontmatter')
  {
    return {
      frontmatter: {},
      content: source,
      diagnostics: [],
      fatal: frontmatterFatal(result.parseError.error),
    }
  }
  const frontmatter = result.frontmatter
  const content = result.content
  const frontmatterDiagnostics = lintFrontmatter(frontmatter, framework)
  if (result.parseError)
  {
    return {
      frontmatter,
      content,
      diagnostics: frontmatterDiagnostics,
      fatal: normalizeCompileError(result.parseError.error, {
        source,
        framework,
      }),
    }
  }
  const componentDiagnostics: Diagnostic[] = []
  for (const diag of result.diagnostics)
  {
    const mapped = fromCoreDiagnostic(diag, framework)
    if (mapped)
    {
      componentDiagnostics.push(mapped)
    }
  }
  return {
    frontmatter,
    content,
    diagnostics: [...frontmatterDiagnostics, ...componentDiagnostics],
  }
}
