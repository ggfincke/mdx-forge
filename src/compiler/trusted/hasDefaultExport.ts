// src/compiler/trusted/hasDefaultExport.ts
// detect real MDX ESM default exports via parsed mdxjsEsm estree nodes

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { safeMatter } from '../../internal/frontmatter';

// minimal estree shapes needed for default-export detection
interface EstreeExportSpecifier {
  type: string;
  exported?: { type: string; name?: string; value?: unknown };
}

interface EstreeStatement {
  type: string;
  specifiers?: EstreeExportSpecifier[];
}

interface MdxjsEsmNode {
  type: string;
  data?: { estree?: { body?: EstreeStatement[] } };
}

// true for `export { x as default }` & `export { default } from '...'` forms
const exportsDefaultName = (spec: EstreeExportSpecifier): boolean => {
  const exported = spec.exported;
  if (!exported) {
    return false;
  }
  if (exported.type === 'Identifier') {
    return exported.name === 'default';
  }
  return exported.value === 'default';
};

// check if MDX source has a module-level default export
// parses actual ESM nodes so fenced/prose `export default` never matches
const hasDefaultExport = (source: string): boolean => {
  const { content } = safeMatter(source);

  let children: unknown[];
  try {
    children = unified()
      .use(remarkParse)
      .use(remarkMdx)
      .parse(content).children;
  } catch {
    // invalid MDX: let the real compile surface the parse error
    return false;
  }

  for (const node of children as MdxjsEsmNode[]) {
    if (node.type !== 'mdxjsEsm') {
      continue;
    }
    for (const stmt of node.data?.estree?.body ?? []) {
      if (stmt.type === 'ExportDefaultDeclaration') {
        return true;
      }
      if (
        stmt.type === 'ExportNamedDeclaration' &&
        (stmt.specifiers ?? []).some(exportsDefaultName)
      ) {
        return true;
      }
    }
  }
  return false;
};

export default hasDefaultExport;
