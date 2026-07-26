// src/browser/errors.ts
// error types & factory for browser module system
// ! cross-repo: MIT mirror of GPL contracts ModuleError E-codes, parallel taxonomy pinned by tests, do not merge

export type ModuleErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'CIRCULAR_DEPENDENCY'
  | 'FETCH_FAILED'
  | 'EVALUATION_FAILED'
  | 'MODULE_DEPTH_EXCEEDED'
  | 'STALE_GENERATION';

export interface ModuleErrorData {
  code: ModuleErrorCode;
  moduleId?: string;
  request?: string;
  parentId?: string;
  depth?: number;
  importChain?: string[];
}

export class ModuleError extends Error {
  readonly data: ModuleErrorData;

  constructor(message: string, data: ModuleErrorData, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ModuleError';
    this.data = data;
  }
}

export function createModuleNotFoundError(
  request: string,
  parentId: string
): ModuleError {
  return new ModuleError(
    `Module not found: "${request}" (required by "${parentId}")`,
    {
      code: 'MODULE_NOT_FOUND',
      request,
      parentId,
    }
  );
}

export function createCircularDependencyError(
  moduleId: string,
  parentId?: string,
  importChain?: string[]
): ModuleError {
  const chainText = importChain?.map((id) => `"${id}"`).join(' -> ');
  const message = chainText
    ? `Circular dependency detected: ${chainText}`
    : `Circular dependency detected for "${moduleId}"`;

  return new ModuleError(message, {
    code: 'CIRCULAR_DEPENDENCY',
    moduleId,
    parentId,
    importChain,
  });
}

export function createEvaluationFailedError(
  moduleId: string,
  cause?: Error
): ModuleError {
  const error = new ModuleError(
    `Failed to evaluate module "${moduleId}"`,
    {
      code: 'EVALUATION_FAILED',
      moduleId,
    },
    cause
  );

  // preserve original stack for display so wrapping does not hide it
  if (cause?.stack) {
    error.stack = `${error.message}\n    caused by: ${cause.stack}`;
  }

  return error;
}

export function createStaleGenerationError(moduleId: string): ModuleError {
  return new ModuleError(
    `Module load for "${moduleId}" was superseded by a cache reset`,
    {
      code: 'STALE_GENERATION',
      moduleId,
    }
  );
}

export function createModuleDepthExceededError(
  moduleId: string,
  depth: number
): ModuleError {
  return new ModuleError(
    `Module load depth exceeded for "${moduleId}" at depth ${depth}`,
    {
      code: 'MODULE_DEPTH_EXCEEDED',
      moduleId,
      depth,
    }
  );
}
