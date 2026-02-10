// src/compiler/internal/logging.ts
// compiler logger factory & noop logger

import type { CompilerLogger } from '../types';

const noop = () => {};

export const NOOP_LOGGER: CompilerLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

export function getLogger(logger?: CompilerLogger): CompilerLogger {
  return logger ?? NOOP_LOGGER;
}
