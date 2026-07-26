// src/browser/eval/evaluateModule.ts
// evaluate Trusted Mode function-body & CJS-style module code

import type { ModuleRuntime } from '../types'
import { normalizeError } from '../../internal/errors'
import { createEvaluationFailedError } from '../errors'

// evaluate function-body or CJS-style module code
// pass runtime via arguments[0]; return default export or module.exports
export function evaluateModule(
  code: string,
  moduleId: string,
  runtime: ModuleRuntime
): Record<string, unknown>
{
  // cjs-style module context
  const module = { exports: {} as Record<string, unknown> }
  const exports = module.exports

  try
  {
    // create the function
    // MDX function-body read from arguments[0]
    // we pass runtime as first arg & also inject require as local variable for CJS compat
    const fn = new Function(
      'runtime',
      'exports',
      'module',
      '__filename',
      // inject require as local variable for CJS compatibility
      `const require = runtime.require;\n${code}`
    )

    // execute the function
    const result = fn(runtime, exports, module, moduleId)

    // MDX function-body return { default: MDXContent }
    // CJS modules populate module.exports
    // return whichever is populated
    if (result !== undefined)
    {
      return result
    }

    return module.exports
  }
  catch (error: unknown)
  {
    // route through shared factory; preserves cause chain & original stack
    const originalError = normalizeError(error)
    throw createEvaluationFailedError(moduleId, originalError)
  }
}
