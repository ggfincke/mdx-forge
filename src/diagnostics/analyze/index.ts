// src/diagnostics/analyze/index.ts
// render-free MDX analysis -> Diagnostic[]

import type { Diagnostic } from '../types';
import type { FrameworkId } from '../../components/registry';
import { getComponentMetadata } from '../../components/registry';
import { extractFrontmatter } from '../../compiler/pipeline/common/mdx-common';
import { parseMdxForAnalysis, type DetectedComponent } from './parse';
import {
  analyzeUnknownComponents,
  classifyComponentSource,
  type ClassifyContext,
} from './rules/unknown-component';
import { analyzeCompoundMember } from './rules/compound-member';
import { analyzeComponentProps } from './rules/prop-validation';

export {
  analyzeUnknownComponents,
  classifyComponentSource,
} from './rules/unknown-component';
export { analyzeCompoundMember } from './rules/compound-member';
export { analyzeComponentProps } from './rules/prop-validation';
export type {
  ClassifyContext,
  ComponentSource,
} from './rules/unknown-component';
export type { DetectedAttribute, DetectedComponent } from './parse';

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

export interface AnalyzeParseError {
  phase: 'frontmatter' | 'mdx';
  error: unknown;
}

// document-level result where one frontmatter + one MDX parse feeds every rule
// parse failures surface as parseError instead of MDXF100 (deferred v1 contract)
export interface AnalyzeDocumentResult {
  diagnostics: Diagnostic[];
  frontmatter: Record<string, unknown>;
  content: string;
  bodyStartLine: number;
  bodyStartColumn: number;
  parseError?: AnalyzeParseError;
}

// per-component ladder keeps diagnostics in document order: unknown root,
// then compound-member validity, then prop rules for known specs
function analyzeComponent(
  component: DetectedComponent,
  ctx: ClassifyContext
): Diagnostic[] {
  const source = classifyComponentSource(component.root, ctx);
  if (source === 'unknown') {
    return analyzeUnknownComponents([component], ctx);
  }
  if (component.members.length > 0) {
    // members of imported/config roots are host-owned; skip validation
    if (source === 'import' || source === 'config') {
      return [];
    }
    const diag = analyzeCompoundMember(component);
    return diag ? [diag] : [];
  }
  if (source === 'import' || source === 'config') {
    return [];
  }
  const metadata =
    (ctx.framework !== 'generic'
      ? getComponentMetadata(ctx.framework, component.name)
      : undefined) ?? getComponentMetadata('generic', component.name);
  if (!metadata) {
    return [];
  }
  return analyzeComponentProps(component, metadata.props);
}

export function analyzeMdxDocument(
  source: string,
  ctx: AnalyzeContext
): AnalyzeDocumentResult {
  const result: AnalyzeDocumentResult = {
    diagnostics: [],
    frontmatter: {},
    content: source,
    bodyStartLine: 1,
    bodyStartColumn: 1,
  };

  try {
    const { content, frontmatter, bodyStartLine, bodyStartColumn } =
      extractFrontmatter(source);
    result.frontmatter = frontmatter;
    result.content = content;
    result.bodyStartLine = bodyStartLine;
    result.bodyStartColumn = bodyStartColumn;
  } catch (error) {
    result.parseError = { phase: 'frontmatter', error };
    return result;
  }

  try {
    const parsed = parseMdxForAnalysis(
      result.content,
      result.bodyStartLine,
      result.bodyStartColumn
    );
    const classifyCtx: ClassifyContext = {
      imports: parsed.imports,
      configComponents: new Set(ctx.configComponents ?? []),
      framework: ctx.framework,
    };
    for (const component of parsed.components) {
      result.diagnostics.push(...analyzeComponent(component, classifyCtx));
    }
  } catch (error) {
    result.parseError = { phase: 'mdx', error };
    result.diagnostics = [];
  }

  return result;
}

// convenience entry for standalone callers (CLI, MCP, tests): safe frontmatter
// extraction + one parse + every enabled rule; parse failures return []
export function analyzeMdx(source: string, ctx: AnalyzeContext): Diagnostic[] {
  const result = analyzeMdxDocument(source, ctx);
  return result.parseError ? [] : result.diagnostics;
}
