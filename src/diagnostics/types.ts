// src/diagnostics/types.ts
// shared host-agnostic diagnostic contract (zero-dependency leaf)

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

// 1-based line & column (unist convention); offset is 0-based char index
export interface DiagnosticPoint {
  line: number;
  column: number;
  offset?: number;
}

export interface DiagnosticRange {
  start: DiagnosticPoint;
  end: DiagnosticPoint;
}

// stable machine codes; once shipped a code is never reassigned or repurposed
export const DIAGNOSTIC_CODES = {
  UNKNOWN_COMPONENT: 'MDXF001',
  UNKNOWN_PROP: 'MDXF002',
  INVALID_ENUM_VALUE: 'MDXF003',
  DEPRECATED_PROP: 'MDXF004',
  DEPRECATED_ALIAS: 'MDXF005',
  MISSING_REQUIRED_PROP: 'MDXF006',
  INVALID_PROP_VALUE: 'MDXF007',
  UNKNOWN_COMPOUND_MEMBER: 'MDXF008',
  INVALID_FRONTMATTER: 'MDXF020',
  DUPLICATE_HEADING_ID: 'MDXF021',
  BROKEN_LINK: 'MDXF030',
  BROKEN_ANCHOR: 'MDXF031',
  MISSING_ASSET: 'MDXF032',
  MDX_PARSE_ERROR: 'MDXF100',
  PLUGIN_LOAD_ERROR: 'MDXF101',
  UNSUPPORTED_IN_SAFE_MODE: 'MDXF110',
  UNSAFE_URL: 'MDXF111',
  UNSUPPORTED_ELEMENT: 'MDXF112',
  UNSUPPORTED_ATTRIBUTE: 'MDXF113',
  UNSUPPORTED_RAW_HTML: 'MDXF114',
} as const;

export type DiagnosticCode =
  (typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

// payloads keyed by code; each fix consumer reads its slot
export interface UnknownComponentData {
  componentName: string;
  suggestions: string[];
}

// prop rules (MDXF002-MDXF007) carry enough context for host suggestions
export interface PropDiagnosticData {
  componentName: string;
  propName: string;
  knownProps?: string[];
  value?: string;
  values?: string[];
  canonical?: string;
  expectedType?: string;
}

// compound-member rule (MDXF008) payload
export interface CompoundMemberData {
  componentName: string;
  rootName: string;
  memberName: string;
  allowedMembers: string[];
}

export interface Diagnostic {
  code: DiagnosticCode;
  ruleId: string;
  severity: DiagnosticSeverity;
  message: string;
  source: 'mdx-forge';
  range?: DiagnosticRange;
  data?:
    | UnknownComponentData
    | PropDiagnosticData
    | CompoundMemberData
    | Record<string, unknown>;
}
