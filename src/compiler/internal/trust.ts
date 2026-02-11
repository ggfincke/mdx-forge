// src/compiler/internal/trust.ts
// trusted mode guard utility

import type { CompilerConfig } from '../types';
import { getDocumentPath, getDocumentUri } from './path';

export function requireTrustedMode(
  config: CompilerConfig,
  operation: string,
  onDenied?: (error: Error) => void
): boolean {
  if (!config.trustValidator) {
    return true;
  }

  const decision = config.trustValidator.isTrusted({
    operation,
    documentPath: getDocumentPath(config),
    documentUri: getDocumentUri(config),
  });

  if (decision.canExecute) {
    return true;
  }

  onDenied?.(
    new Error(
      decision.reason ??
        `Operation "${operation}" requires a trusted document context.`
    )
  );
  return false;
}
