// src/internal/errors.ts
// shared error utilities
// ! cross-repo duplicate: mirror runtime-utils normalization behavior

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

// extract error message w/ robust object check
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'Unknown error';
}

// extract stack trace from an unknown error value
function extractErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  if (error && typeof error === 'object' && 'stack' in error) {
    const stack = (error as { stack?: unknown }).stack;
    if (typeof stack === 'string') {
      return stack;
    }
  }
  return undefined;
}

// convert any value to Error, preserving Error-like messages & stacks
export function normalizeError(error: unknown): Error {
  if (isError(error)) {
    return error;
  }
  const normalized = new Error(extractErrorMessage(error));
  const stack = extractErrorStack(error);
  if (stack !== undefined) {
    normalized.stack = stack;
  }
  return normalized;
}
