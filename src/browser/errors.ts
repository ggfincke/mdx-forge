// src/browser/errors.ts
// error types & factory for browser module system

export type ModuleErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'CIRCULAR_DEPENDENCY'
  | 'FETCH_FAILED'
  | 'EVALUATION_FAILED'
  | 'MODULE_DEPTH_EXCEEDED';

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

export function isModuleErrorData(value: unknown): value is ModuleErrorData {
  return typeof value === 'object' && value !== null && 'code' in value;
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

export function createFetchFailedError(
  request: string,
  parentId: string,
  cause?: Error
): ModuleError {
  return new ModuleError(
    `Failed to fetch "${request}" (requested by "${parentId}")`,
    {
      code: 'FETCH_FAILED',
      request,
      parentId,
    },
    cause
  );
}

export function createEvaluationFailedError(
  moduleId: string,
  cause?: Error
): ModuleError {
  return new ModuleError(
    `Failed to evaluate module "${moduleId}"`,
    {
      code: 'EVALUATION_FAILED',
      moduleId,
    },
    cause
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
