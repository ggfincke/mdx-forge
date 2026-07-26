// src/compiler/internal/path.ts
// path normalization & resolution utilities

import * as path from 'path'
import type { CompilerConfig } from '../types'

function normalizePathSeparators(filePath: string): string
{
  return filePath.replace(/\\/g, '/')
}

export function toAbsolutePath(inputPath: string, baseDir: string): string
{
  if (path.isAbsolute(inputPath))
  {
    return inputPath
  }
  return path.resolve(baseDir, inputPath)
}

export function toRelativeImportPath(
  absolutePath: string,
  fromDir: string
): string
{
  let relativePath = path.relative(fromDir, absolutePath)
  if (!relativePath.startsWith('.') && !relativePath.startsWith('/'))
  {
    relativePath = `./${relativePath}`
  }
  return normalizePathSeparators(relativePath)
}

// build a JSON-quoted ESM import specifier for a target path
// ! quote/escape via JSON.stringify so a crafted path can't break out of the
// generated import string & inject statements into emitted modules
export function toImportSpecifierLiteral(
  absolutePath: string,
  fromDir: string
): string
{
  return JSON.stringify(toRelativeImportPath(absolutePath, fromDir))
}

// get canonical document filesystem path
export function getDocumentPath(config: CompilerConfig): string
{
  return config.documentPath ?? ''
}

// get document directory (explicit or derived from document path)
export function getDocumentDir(config: CompilerConfig): string
{
  if (config.documentDir)
  {
    return config.documentDir
  }
  return path.dirname(getDocumentPath(config))
}

// get document URI for trust validation
export function getDocumentUri(config: CompilerConfig): string | undefined
{
  return config.documentUri
}
