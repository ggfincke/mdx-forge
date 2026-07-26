// src/diagnostics/analyze/rules/unknown-component.ts
// classify JSX component sources & flag unknown components (MDXF001)

import type { Diagnostic } from '../../types'
import { DIAGNOSTIC_CODES } from '../../types'
import {
  getSemanticAlias,
  isFrameworkComponent,
  isGenericComponent,
  type FrameworkId,
} from '../../../components/registry'
import type { DetectedComponent } from '../parse'

export interface ClassifyContext
{
  imports: ReadonlySet<string>
  configComponents: ReadonlySet<string>
  framework: FrameworkId
}

export type ComponentSource =
  'import' | 'config' | 'builtin' | 'framework' | 'unknown'

// port of the extension ladder so every host shares one source of truth
export function classifyComponentSource(
  name: string,
  ctx: ClassifyContext
): ComponentSource
{
  if (ctx.imports.has(name))
  {
    return 'import'
  }
  if (ctx.configComponents.has(name))
  {
    return 'config'
  }
  if (isGenericComponent(name))
  {
    return 'builtin'
  }
  // skip framework lookup for generic docs; narrows FrameworkId -> Framework
  if (
    ctx.framework !== 'generic' &&
    isFrameworkComponent(name, ctx.framework)
  )
  {
    return 'framework'
  }
  return 'unknown'
}

export function analyzeUnknownComponents(
  components: readonly DetectedComponent[],
  ctx: ClassifyContext
): Diagnostic[]
{
  const out: Diagnostic[] = []
  for (const c of components)
  {
    // member expressions resolve through their root identifier (Tabs.Tab -> Tabs)
    if (classifyComponentSource(c.root, ctx) !== 'unknown')
    {
      continue
    }
    const canonical = getSemanticAlias(c.root)
    out.push({
      code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
      ruleId: 'unknown-component',
      severity: 'warning',
      source: 'mdx-forge',
      range: c.range,
      message: `Unknown component "${c.root}". Add it to .mdx-previewrc.json or use a built-in shim.`,
      data: {
        componentName: c.root,
        suggestions: canonical ? [canonical] : [],
      },
    })
  }
  return out
}
