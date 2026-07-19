// src/compiler/safe-document/convert.ts
// convert fixed Markdown & MDX AST nodes into closed document data

import { DIAGNOSTIC_CODES } from '../../diagnostics/types';
import {
  addSafeDocumentDiagnostic,
  allowSafeDocumentUrl,
  toSafeDocumentRange,
} from './internal';
import type {
  SafeDocumentCompileContext,
  SafeDocumentMdastNode,
} from './internal';
import {
  diagnoseDiscardedComponentProps,
  readSafeComponentProps,
  readSafeElementProps,
} from './props';
import type {
  SafeDocumentComponentSchema,
  SafeDocumentElementNode,
  SafeDocumentElementTag,
  SafeDocumentJsonValue,
  SafeDocumentNode,
} from './types';

const SAFE_ELEMENT_TAGS = new Set<SafeDocumentElementTag>([
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);
const VOID_ELEMENT_TAGS = new Set<SafeDocumentElementTag>(['br', 'hr', 'img']);
const MAX_DOCUMENT_DEPTH = 64;
const MAX_DOCUMENT_NODES = 10_000;

export function collectSafeDocumentDefinitions(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): boolean {
  const stack: Array<{ depth: number; node: SafeDocumentMdastNode }> = [
    { depth: 0, node },
  ];
  let nodes = 0;
  while (stack.length > 0) {
    const current = stack.pop()!;
    nodes++;
    if (nodes > MAX_DOCUMENT_NODES) {
      documentLimitDiagnostic(
        current.node,
        context,
        'nodes',
        MAX_DOCUMENT_NODES
      );
      return false;
    }
    if (current.depth > MAX_DOCUMENT_DEPTH) {
      documentLimitDiagnostic(
        current.node,
        context,
        'depth',
        MAX_DOCUMENT_DEPTH
      );
      return false;
    }
    if (current.node.type === 'definition' && current.node.identifier) {
      const identifier = current.node.identifier.toLowerCase();
      if (current.node.url && !context.definitions.has(identifier)) {
        context.definitions.set(identifier, {
          url: current.node.url,
          ...(current.node.title ? { title: current.node.title } : {}),
          ...(current.node.position ? { position: current.node.position } : {}),
        });
      }
    }
    const children = current.node.children ?? [];
    for (let index = children.length - 1; index >= 0; index--) {
      stack.push({ depth: current.depth + 1, node: children[index]! });
    }
  }
  return true;
}

export function convertSafeDocumentChildren(
  children: readonly SafeDocumentMdastNode[],
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  return children.flatMap((node) => convertNode(node, context));
}

function convertNode(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  switch (node.type) {
    case 'text':
      return [text(node.value ?? '', node, context)];
    case 'paragraph':
      return [element('p', {}, node, context)];
    case 'heading':
      return [element(headingTag(node.depth), {}, node, context)];
    case 'blockquote':
      return [element('blockquote', {}, node, context)];
    case 'emphasis':
      return [element('em', {}, node, context)];
    case 'strong':
      return [element('strong', {}, node, context)];
    case 'delete':
      return [element('del', {}, node, context)];
    case 'inlineCode':
      return [
        element('code', {}, node, context, [
          text(node.value ?? '', node, context),
        ]),
      ];
    case 'code':
      return [convertCode(node, context)];
    case 'break':
      return [element('br', {}, node, context, [])];
    case 'thematicBreak':
      return [element('hr', {}, node, context, [])];
    case 'list':
      return [convertList(node, context)];
    case 'listItem':
      return [convertListItem(node, context)];
    case 'link':
      return convertLink(node, context);
    case 'image':
      return convertImage(node, context);
    case 'linkReference':
      return convertLinkReference(node, context);
    case 'imageReference':
      return convertImageReference(node, context);
    case 'definition':
      return [];
    case 'table':
      return [convertTable(node, context)];
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement':
      return convertMdxElement(node, context);
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
    case 'mdxjsEsm':
      unsupportedSyntax(node, context);
      return [];
    case 'html':
      addSafeDocumentDiagnostic(
        context,
        DIAGNOSTIC_CODES.UNSUPPORTED_RAW_HTML,
        'safe-document/unsupported-raw-html',
        'raw HTML is not supported',
        node.position,
        { kind: 'raw-html' }
      );
      return [];
    default:
      addSafeDocumentDiagnostic(
        context,
        DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
        'safe-document/unsupported-markdown',
        `unsupported Markdown node ${node.type}`,
        node.position,
        { kind: node.type }
      );
      return convertSafeDocumentChildren(node.children ?? [], context);
  }
}

function convertCode(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentElementNode {
  const props: Record<string, SafeDocumentJsonValue> = {};
  if (node.lang) {
    props.language = node.lang;
  }
  if (node.meta) {
    props.meta = node.meta;
  }
  const code = element('code', props, node, context, [
    text(node.value ?? '', node, context),
  ]);
  return element('pre', {}, node, context, [code]);
}

function convertList(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentElementNode {
  if (!node.ordered) {
    return element('ul', {}, node, context);
  }
  const props: Record<string, SafeDocumentJsonValue> = {};
  if (typeof node.start === 'number' && node.start !== 1) {
    props.start = node.start;
  }
  return element('ol', props, node, context);
}

function convertListItem(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentElementNode {
  const props: Record<string, SafeDocumentJsonValue> = {};
  if (typeof node.checked === 'boolean') {
    props.checked = node.checked;
  }
  return element('li', props, node, context);
}

function convertLink(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const children = convertSafeDocumentChildren(node.children ?? [], context);
  const url = node.url ?? '';
  if (
    !allowSafeDocumentUrl(
      url,
      { kind: 'element', name: 'a', prop: 'href' },
      node.position,
      context
    )
  ) {
    return children;
  }
  const props: Record<string, SafeDocumentJsonValue> = { href: url };
  if (node.title) {
    props.title = node.title;
  }
  return [element('a', props, node, context, children)];
}

function convertImage(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const url = node.url ?? '';
  if (
    !allowSafeDocumentUrl(
      url,
      { kind: 'element', name: 'img', prop: 'src' },
      node.position,
      context
    )
  ) {
    return [];
  }
  const props: Record<string, SafeDocumentJsonValue> = {
    alt: node.alt ?? '',
    src: url,
  };
  if (node.title) {
    props.title = node.title;
  }
  return [element('img', props, node, context, [])];
}

function convertLinkReference(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const children = convertSafeDocumentChildren(node.children ?? [], context);
  const definition = findDefinition(node, context);
  if (!definition) {
    return children;
  }
  const linked: SafeDocumentMdastNode = {
    ...node,
    type: 'link',
    url: definition.url,
    title: definition.title,
  };
  return convertLink(linked, context);
}

function convertImageReference(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const definition = findDefinition(node, context);
  if (!definition) {
    return [];
  }
  const image: SafeDocumentMdastNode = {
    ...node,
    type: 'image',
    url: definition.url,
    title: definition.title,
  };
  return convertImage(image, context);
}

function findDefinition(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
) {
  const identifier = node.identifier?.toLowerCase() ?? '';
  const definition = context.definitions.get(identifier);
  if (!definition) {
    addSafeDocumentDiagnostic(
      context,
      DIAGNOSTIC_CODES.BROKEN_LINK,
      'safe-document/missing-definition',
      `missing link definition ${identifier}`,
      node.position,
      { identifier }
    );
  }
  return definition;
}

function convertTable(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentElementNode {
  const rows = node.children ?? [];
  const header = rows[0]
    ? [convertTableRow(rows[0], 'th', node.align ?? [], context)]
    : [];
  const body = rows
    .slice(1)
    .map((row) => convertTableRow(row, 'td', node.align ?? [], context));
  const children: SafeDocumentNode[] = [];
  if (header.length > 0) {
    children.push(element('thead', {}, node, context, header));
  }
  if (body.length > 0) {
    children.push(element('tbody', {}, node, context, body));
  }
  return element('table', {}, node, context, children);
}

function convertTableRow(
  row: SafeDocumentMdastNode,
  cellTag: 'th' | 'td',
  align: Array<'left' | 'right' | 'center' | null>,
  context: SafeDocumentCompileContext
): SafeDocumentElementNode {
  const cells = (row.children ?? []).map((cell, index) => {
    const props: Record<string, SafeDocumentJsonValue> = {};
    const alignment = align[index];
    if (alignment) {
      props.align = alignment;
    }
    return element(cellTag, props, cell, context);
  });
  return element('tr', {}, row, context, cells);
}

function convertMdxElement(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const name = node.name;
  if (!name || isIntrinsicName(name)) {
    return convertIntrinsic(node, name, context);
  }

  const components = context.options.components;
  const schema =
    components && Object.hasOwn(components, name)
      ? components[name]
      : undefined;
  const children = convertSafeDocumentChildren(node.children ?? [], context);
  if (!schema) {
    diagnoseDiscardedComponentProps(node, name, context);
    return convertUnknownComponent(node, name, children, context);
  }
  const props = readSafeComponentProps(node, name, schema, context);
  const componentChildren = validateChildren(
    node,
    name,
    children,
    schema,
    context
  );
  return [
    {
      type: 'component',
      name,
      props,
      children: componentChildren,
      ...(node.position
        ? { source: toSafeDocumentRange(node.position, context) }
        : {}),
    },
  ];
}

function convertIntrinsic(
  node: SafeDocumentMdastNode,
  name: string | null | undefined,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const children = convertSafeDocumentChildren(node.children ?? [], context);
  if (context.options.rawHtml !== 'allow') {
    addSafeDocumentDiagnostic(
      context,
      DIAGNOSTIC_CODES.UNSUPPORTED_RAW_HTML,
      'safe-document/unsupported-raw-html',
      `raw element ${name ?? 'fragment'} is not allowed`,
      node.position,
      { elementName: name ?? '' }
    );
    return children;
  }
  if (!name || !SAFE_ELEMENT_TAGS.has(name as SafeDocumentElementTag)) {
    addSafeDocumentDiagnostic(
      context,
      DIAGNOSTIC_CODES.UNSUPPORTED_ELEMENT,
      'safe-document/unsupported-element',
      `unsupported element ${name ?? 'fragment'}`,
      node.position,
      { elementName: name ?? '' }
    );
    return children;
  }

  const tag = name as SafeDocumentElementTag;
  const result = readSafeElementProps(node, tag, context);
  if (!result.required) {
    return tag === 'img' ? [] : children;
  }
  if (VOID_ELEMENT_TAGS.has(tag) && hasMeaningfulChildren(children)) {
    addSafeDocumentDiagnostic(
      context,
      DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
      'safe-document/unsupported-children',
      `void element ${tag} cannot contain children`,
      node.position,
      { elementName: tag, kind: 'void-element-children' }
    );
    return [element(tag, result.props, node, context, [])];
  }
  return [element(tag, result.props, node, context, children)];
}

function convertUnknownComponent(
  node: SafeDocumentMdastNode,
  name: string,
  children: SafeDocumentNode[],
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const inert = context.options.unknownComponents === 'inert';
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
    'safe-document/unknown-component',
    `unknown component ${name}`,
    node.position,
    { componentName: name, suggestions: [] },
    inert ? 'warning' : 'error'
  );
  if (!inert) {
    return children;
  }
  return [
    {
      type: 'unknownComponent',
      name,
      children,
      ...(node.position
        ? { source: toSafeDocumentRange(node.position, context) }
        : {}),
    },
  ];
}

function validateChildren(
  node: SafeDocumentMdastNode,
  name: string,
  children: SafeDocumentNode[],
  schema: SafeDocumentComponentSchema,
  context: SafeDocumentCompileContext
): SafeDocumentNode[] {
  const meaningful = hasMeaningfulChildren(children);
  if (schema.children === 'none' && meaningful) {
    childDiagnostic(node, name, 'component does not accept children', context);
    return [];
  }
  if (schema.children === 'required' && !meaningful) {
    childDiagnostic(node, name, 'component requires children', context);
  }
  return children;
}

function hasMeaningfulChildren(children: SafeDocumentNode[]): boolean {
  return children.some(
    (child) => child.type !== 'text' || child.value.trim().length > 0
  );
}

function childDiagnostic(
  node: SafeDocumentMdastNode,
  name: string,
  reason: string,
  context: SafeDocumentCompileContext
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
    'safe-document/invalid-children',
    `invalid children for ${name}: ${reason}`,
    node.position,
    { componentName: name, propName: 'children', reason }
  );
}

function unsupportedSyntax(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
    'safe-document/unsupported-syntax',
    `unsupported executable syntax ${node.type}`,
    node.position,
    { kind: node.type }
  );
}

function documentLimitDiagnostic(
  node: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext,
  kind: 'depth' | 'nodes',
  limit: number
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
    'safe-document/document-limit',
    `document ${kind} exceeds ${limit}`,
    node.position,
    { kind: `document-${kind}`, limit }
  );
}

function element(
  tag: SafeDocumentElementTag,
  props: Record<string, SafeDocumentJsonValue>,
  sourceNode: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext,
  children = convertSafeDocumentChildren(sourceNode.children ?? [], context)
): SafeDocumentElementNode {
  return {
    type: 'element',
    tag,
    props,
    children,
    ...(sourceNode.position
      ? { source: toSafeDocumentRange(sourceNode.position, context) }
      : {}),
  } as SafeDocumentElementNode;
}

function text(
  value: string,
  sourceNode: SafeDocumentMdastNode,
  context: SafeDocumentCompileContext
): SafeDocumentNode {
  return {
    type: 'text',
    value,
    ...(sourceNode.position
      ? { source: toSafeDocumentRange(sourceNode.position, context) }
      : {}),
  };
}

function headingTag(depth: number | undefined): SafeDocumentElementTag {
  const normalized = Math.min(6, Math.max(1, depth ?? 1));
  return `h${normalized}` as SafeDocumentElementTag;
}

function isIntrinsicName(name: string): boolean {
  return /^[a-z]/.test(name) || name.includes('-') || name.includes(':');
}
