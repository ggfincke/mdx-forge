// src/diagnostics/analyze/rules/compound-member.ts
// validate dotted JSX members against the known compound-member allowlist (MDXF008)

import type { Diagnostic } from '../../types';
import { DIAGNOSTIC_CODES } from '../../types';
import {
  findComponentEntry,
  type FrameworkId,
} from '../../../components/registry';
import type { DetectedComponent } from '../parse';

export function knownCompoundMembers(
  root: string,
  framework: FrameworkId = 'generic'
): readonly string[] {
  const entry =
    (framework !== 'generic'
      ? findComponentEntry(framework, root)
      : undefined) ?? findComponentEntry('generic', root);
  return [...(entry?.members ?? [])];
}

// callers run this only for member expressions whose root is a known
// builtin/framework component; imported & config roots are host-owned
export function analyzeCompoundMember(
  component: DetectedComponent,
  framework: FrameworkId = 'generic'
): Diagnostic | undefined {
  if (component.members.length === 0) {
    return undefined;
  }
  const allowed = knownCompoundMembers(component.root, framework);
  // single-segment members only; deeper paths are never registered
  if (
    component.members.length === 1 &&
    allowed.includes(component.members[0])
  ) {
    return undefined;
  }
  const memberName = component.members.join('.');
  const detail =
    allowed.length > 0
      ? `Known members: ${allowed.map((m) => `${component.root}.${m}`).join(', ')}.`
      : `<${component.root}> has no compound members.`;
  return {
    code: DIAGNOSTIC_CODES.UNKNOWN_COMPOUND_MEMBER,
    ruleId: 'unknown-compound-member',
    severity: 'warning',
    source: 'mdx-forge',
    range: component.range,
    message: `Unknown member "${memberName}" on <${component.root}>. ${detail}`,
    data: {
      componentName: component.name,
      rootName: component.root,
      memberName,
      allowedMembers: [...allowed],
    },
  };
}
