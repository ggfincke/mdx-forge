// src/diagnostics/analyze/index.ts
// render-free MDX analysis -> Diagnostic[]

import type { Diagnostic } from '../types';
import type { FrameworkId } from '../../components/registry';
import { extractFrontmatter } from '../../compiler/pipeline/common/mdx-common';
import { parseMdxForAnalysis, type ParsedMdx } from './parse';
import { analyzeUnknownComponents } from './rules/unknown-component';

// re-export pure rules + parse types so hosts reuse them off this entry
export * from './parse';
export * from './rules/unknown-component';

export interface AnalyzeContext {
  // resolved framework for shim-aware classification ('generic' when unknown)
  framework: FrameworkId;
  // component names declared in .mdx-previewrc.json (host-supplied)
  configComponents?: readonly string[];
  // future: per-rule enablement & severity overrides
  rules?: Partial<
    Record<string, 'off' | 'hint' | 'info' | 'warning' | 'error'>
  >;
}

// convenience entry for standalone callers (CLI, MCP, tests): safe frontmatter
// extraction + one parse + every enabled rule
export function analyzeMdx(source: string, ctx: AnalyzeContext): Diagnostic[] {
  let parsed: ParsedMdx;
  try {
    const { content, bodyStartLine } = extractFrontmatter(source);
    parsed = parseMdxForAnalysis(content, bodyStartLine);
  } catch {
    // fatal MDX/frontmatter parse failures are a deferred Source-A concern (MDXF100)
    return [];
  }
  const classifyCtx = {
    imports: parsed.imports,
    configComponents: new Set(ctx.configComponents ?? []),
    framework: ctx.framework,
  };
  return [
    ...analyzeUnknownComponents(parsed.components, classifyCtx),
    // append later rules here; keep each pure & independently testable
  ];
}
