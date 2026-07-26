// src/diagnostics/analyze/rules/prop-validation.ts
// validate JSX props against registry metadata (MDXF002-MDXF007)

import type { Diagnostic } from '../../types'
import { DIAGNOSTIC_CODES } from '../../types'
import type { ComponentPropSpec } from '../../../components/registry'
import type { DetectedAttribute, DetectedComponent } from '../parse'

// standard DOM escape hatches allowed on every component even when undeclared
const UNIVERSAL_ATTRS = new Set([
  'className',
  'class',
  'style',
  'id',
  'key',
  'ref',
  'title',
  'role',
  'tabIndex',
  'hidden',
  'lang',
  'dir',
  'draggable',
  'contentEditable',
])

// real event-prop grammar: on followed by an uppercase letter (onClick),
// so names like "only" are validated instead of silently accepted
const EVENT_PROP = /^on[A-Z]/

function isUniversallyAllowedProp(name: string): boolean
{
  return (
    UNIVERSAL_ATTRS.has(name) ||
    name.startsWith('data-') ||
    name.startsWith('aria-') ||
    EVENT_PROP.test(name)
  )
}

function literalStringExpression(
  value: string | undefined
): string | undefined
{
  const expression = value?.trim()
  if (!expression)
  {
    return undefined
  }

  const quoted = /^(['"])((?:\\.|(?!\1)[^\\\r\n])*)\1$/.exec(expression)
  if (quoted)
  {
    return quoted[2]
  }

  const template = /^`((?:\\.|[^\\`\r\n])*)`$/.exec(expression)
  if (!template)
  {
    return undefined
  }
  for (let index = 0; index < template[1].length; index += 1)
  {
    if (template[1][index] === '\\')
    {
      index += 1
      continue
    }
    if (template[1][index] === '$' && template[1][index + 1] === '{')
    {
      return undefined
    }
  }
  return template[1]
}

// resolve static string values for enum checks; skip dynamic expressions
function literalStringValue(attr: DetectedAttribute): string | undefined
{
  if (attr.kind === 'string')
  {
    return attr.value
  }
  if (attr.kind === 'expression')
  {
    return attr.staticValue ?? literalStringExpression(attr.value)
  }
  return undefined
}

function propDiagnostic(
  code: (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES],
  ruleId: string,
  message: string,
  component: DetectedComponent,
  data: Record<string, unknown>
): Diagnostic
{
  return {
    code,
    ruleId,
    severity: 'warning',
    source: 'mdx-forge',
    range: component.range,
    message,
    data,
  }
}

function validatePropValue(
  attr: DetectedAttribute,
  prop: ComponentPropSpec,
  component: DetectedComponent
): Diagnostic | undefined
{
  const name = component.name
  const base = { componentName: name, propName: prop.name }

  // boolean shorthand is always valid for boolean/node props, invalid otherwise
  if (attr.kind === 'shorthand')
  {
    if (prop.type === 'boolean' || prop.type === 'node')
    {
      return undefined
    }
    return propDiagnostic(
      DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
      'invalid-prop-value',
      `Prop "${prop.name}" on <${name}> expects ${prop.type}, got boolean shorthand.`,
      component,
      { ...base, expectedType: prop.type }
    )
  }

  // enum validation — only when a literal string is statically readable
  if (prop.type === 'enum' && prop.values)
  {
    const literal = literalStringValue(attr)
    if (literal === undefined)
    {
      return undefined
    }
    const aliased = prop.valueAliases?.[literal]
    if (aliased !== undefined)
    {
      return propDiagnostic(
        DIAGNOSTIC_CODES.DEPRECATED_ALIAS,
        'deprecated-alias',
        `Value "${literal}" for prop "${prop.name}" is an alias for "${aliased}".`,
        component,
        { ...base, canonical: aliased }
      )
    }
    if (!prop.values.includes(literal))
    {
      return propDiagnostic(
        DIAGNOSTIC_CODES.INVALID_ENUM_VALUE,
        'invalid-enum-value',
        `Value "${literal}" is not valid for prop "${prop.name}" on <${name}>. Expected one of: ${prop.values.join(', ')}.`,
        component,
        { ...base, value: literal, values: [...prop.values] }
      )
    }
    return undefined
  }

  // warn only when numeric string props cannot be coerced (width="100" is fine)
  if (
    prop.type === 'number' &&
    attr.kind === 'string' &&
    Number.isNaN(Number(attr.value))
  )
  {
    return propDiagnostic(
      DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
      'invalid-prop-value',
      `Prop "${prop.name}" on <${name}> expects a number; got "${attr.value}".`,
      component,
      { ...base, expectedType: 'number' }
    )
  }

  if (prop.type === 'boolean')
  {
    // string values like open="false" are truthy strings, not booleans
    if (attr.kind === 'string')
    {
      return propDiagnostic(
        DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
        'invalid-prop-value',
        `Prop "${prop.name}" on <${name}> expects a boolean; got string "${attr.value}". Use ${prop.name}={${attr.value === 'false' ? 'false' : 'true'}}.`,
        component,
        { ...base, expectedType: 'boolean' }
      )
    }
    if (attr.kind === 'expression')
    {
      const expr = (attr.value ?? '').trim()
      if (expr !== 'true' && expr !== 'false')
      {
        return propDiagnostic(
          DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
          'invalid-prop-value',
          `Prop "${prop.name}" on <${name}> expects a boolean expression.`,
          component,
          { ...base, expectedType: 'boolean' }
        )
      }
    }
  }

  if (prop.deprecated)
  {
    return propDiagnostic(
      DIAGNOSTIC_CODES.DEPRECATED_PROP,
      'deprecated-prop',
      `Prop "${prop.name}" on <${name}> is deprecated${
        prop.deprecatedIn ? ` in ${prop.deprecatedIn}` : ''
      }.`,
      component,
      { ...base, canonical: prop.replacement }
    )
  }

  return undefined
}

// order per element: unknown props (attr order), missing required, value checks
export function analyzeComponentProps(
  component: DetectedComponent,
  props: readonly ComponentPropSpec[]
): Diagnostic[]
{
  const out: Diagnostic[] = []
  const known = new Set(props.map((p) => p.name))
  const knownProps = [...known]
  const byName = new Map<string, DetectedAttribute>()
  const hasUnresolvedSpread = component.attributes.some(
    (attr) => attr.kind === 'spread'
  )

  for (const attr of component.attributes)
  {
    // spread attributes can carry anything -> bail out of that slot
    if (attr.kind === 'spread' || attr.name === undefined)
    {
      continue
    }
    byName.set(attr.name, attr)
    if (known.has(attr.name) || isUniversallyAllowedProp(attr.name))
    {
      continue
    }
    out.push(
      propDiagnostic(
        DIAGNOSTIC_CODES.UNKNOWN_PROP,
        'unknown-prop',
        `Unknown prop "${attr.name}" on <${component.name}>.`,
        component,
        {
          componentName: component.name,
          propName: attr.name,
          knownProps,
        }
      )
    )
  }

  for (const prop of props)
  {
    if (prop.required && !byName.has(prop.name) && !hasUnresolvedSpread)
    {
      out.push(
        propDiagnostic(
          DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP,
          'missing-required-prop',
          `Required prop "${prop.name}" is missing on <${component.name}>.`,
          component,
          { componentName: component.name, propName: prop.name }
        )
      )
    }
  }

  for (const prop of props)
  {
    const attr = byName.get(prop.name)
    if (!attr)
    {
      continue
    }
    const diag = validatePropValue(attr, prop, component)
    if (diag)
    {
      out.push(diag)
    }
  }

  return out
}
