// tests/browser/evaluate-module.test.ts
// unit tests for evaluateModule error handling w/ stack preservation

import { describe, it, expect, vi } from 'vitest'
import { evaluateModule } from '../../src/browser/eval/evaluateModule'
import { ModuleError } from '../../src/browser/errors'
import type { ModuleRuntime } from '../../src/browser/types'

function createMockRuntime(): ModuleRuntime
{
  return {
    Fragment: 'Fragment',
    jsx: vi.fn(),
    jsxs: vi.fn(),
    require: vi.fn(),
  }
}

describe('evaluateModule', () =>
{
  describe('successful evaluation', () =>
  {
    it('should evaluate CJS module and return exports', () =>
    {
      const code = 'module.exports = { foo: "bar" };'
      const runtime = createMockRuntime()

      const result = evaluateModule(code, 'test-module.js', runtime)

      expect(result).toEqual({ foo: 'bar' })
    })

    it('should evaluate MDX function-body style and return result', () =>
    {
      const code = 'return { default: "component" };'
      const runtime = createMockRuntime()

      const result = evaluateModule(code, 'test.mdx', runtime)

      expect(result).toEqual({ default: 'component' })
    })

    it('should make require available from runtime', () =>
    {
      const mockRequire = vi.fn().mockReturnValue({ imported: true })
      const runtime = createMockRuntime()
      runtime.require = mockRequire

      const code = 'const dep = require("./dep"); module.exports = dep;'
      const result = evaluateModule(code, 'test.js', runtime)

      expect(mockRequire).toHaveBeenCalledWith('./dep')
      expect(result).toEqual({ imported: true })
    })
  })

  describe('error handling with stack preservation', () =>
  {
    it('should throw a ModuleError via the shared factory w/ cause (ES2022)', () =>
    {
      const code = 'throw new Error("original error message");'
      const runtime = createMockRuntime()

      try
      {
        evaluateModule(code, 'error-test.js', runtime)
        expect.unreachable('evaluateModule should throw')
      }
      catch (error: unknown)
      {
        const err = error as ModuleError & { cause?: Error }

        expect(err).toBeInstanceOf(ModuleError)
        expect(err.message).toBe('Failed to evaluate module "error-test.js"')
        expect(err.data.code).toBe('EVALUATION_FAILED')
        expect(err.data.moduleId).toBe('error-test.js')
        expect(err.cause).toBeInstanceOf(Error)
        expect(err.cause?.message).toBe('original error message')
      }
    })

    it('should include original stack in error stack', () =>
    {
      const code = 'throw new Error("stack test error");'
      const runtime = createMockRuntime()

      try
      {
        evaluateModule(code, 'stack-test.js', runtime)
      }
      catch (error: unknown)
      {
        const err = error as Error
        expect(err.stack).toContain('caused by:')
        expect(err.stack).toContain('stack test error')
      }
    })

    it('should handle string errors (not Error instances)', () =>
    {
      const code = 'throw "string error";'
      const runtime = createMockRuntime()

      try
      {
        evaluateModule(code, 'string-error.js', runtime)
      }
      catch (error: unknown)
      {
        const err = error as ModuleError & { cause?: Error }

        expect(err).toBeInstanceOf(ModuleError)
        expect(err.message).toBe('Failed to evaluate module "string-error.js"')
        expect(err.cause).toBeInstanceOf(Error)
        expect(err.cause?.message).toBe('string error')
      }
    })
  })
})
