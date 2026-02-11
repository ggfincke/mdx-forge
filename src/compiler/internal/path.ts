// src/compiler/internal/path.ts
// path normalization & resolution utilities

import * as path from 'path';
import type { CompilerConfig } from '../types';

function normalizePathSeparators(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function toAbsolutePath(inputPath: string, baseDir: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(baseDir, inputPath);
}

export function toRelativeImportPath(
  absolutePath: string,
  fromDir: string
): string {
  let relativePath = path.relative(fromDir, absolutePath);
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
    relativePath = `./${relativePath}`;
  }
  return normalizePathSeparators(relativePath);
}

// get canonical document filesystem path (w/ backwards-compatible fallback)
export function getDocumentPath(config: CompilerConfig): string {
  return config.documentPath ?? config.docFsPath ?? '';
}

// get document directory (explicit or derived from document path)
export function getDocumentDir(config: CompilerConfig): string {
  if (config.documentDir) {
    return config.documentDir;
  }
  return path.dirname(getDocumentPath(config));
}

// get document URI for trust validation (w/ backwards-compatible fallback)
export function getDocumentUri(config: CompilerConfig): string | undefined {
  return config.documentUri ?? config.docUri;
}
