// src/compiler/safe-document/props.ts
// decode & validate closed component & intrinsic props

import { DIAGNOSTIC_CODES } from '../../diagnostics/types';
import { addSafeDocumentDiagnostic, allowSafeDocumentUrl } from './internal';
import type {
  SafeDocumentCompileContext,
  SafeDocumentMdastNode,
  SafeDocumentMdxAttribute,
} from './internal';
import { readSafeLiteral } from './literal';
import { isForbiddenProp, validateSafeDocumentValue } from './schema';
import type {
  SafeDocumentComponentSchema,
  SafeDocumentElementTag,
  SafeDocumentJsonValue,
  SafeDocumentValueSchema,
} from './types';

const ELEMENT_SCHEMAS: Partial<
  Record<SafeDocumentElementTag, SafeDocumentComponentSchema>
> = {
  a: {
    props: {
      href: { type: 'string', format: 'url' },
      title: { type: 'string' },
    },
    requiredProps: ['href'],
  },
  code: {
    props: {
      language: { type: 'string' },
      meta: { type: 'string' },
    },
  },
  img: {
    props: {
      alt: { type: 'string' },
      src: { type: 'string', format: 'url' },
      title: { type: 'string' },
    },
    requiredProps: ['alt', 'src'],
  },
  li: { props: { checked: { type: 'boolean' } } },
  ol: { props: { start: { type: 'number', integer: true } } },
  td: {
    props: {
      align: { type: 'string', enum: ['left', 'right', 'center'] },
    },
  },
  th: {
    props: {
      align: { type: 'string', enum: ['left', 'right', 'center'] },
    },
  },
};

interface ReadPropsOptions {
  kind: 'component' | 'element';
  name: string;
  schema: SafeDocumentComponentSchema;
}

export function diagnoseDiscardedComponentProps(
  node: SafeDocumentMdastNode,
  name: string,
  context: SafeDocumentCompileContext
): void {
  const options: ReadPropsOptions = {
    kind: 'component',
    name,
    schema: {},
  };
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== 'mdxJsxAttribute') {
      unsupportedExpression(attribute, options, context, 'spread');
      continue;
    }
    if (typeof attribute.value !== 'object' || attribute.value === null) {
      continue;
    }
    const result = readSafeLiteral(attribute.value.data?.estree);
    if (!result.ok) {
      unsupportedExpression(attribute, options, context, result.reason);
    }
  }
}

export function readSafeComponentProps(
  node: SafeDocumentMdastNode,
  name: string,
  schema: SafeDocumentComponentSchema,
  context: SafeDocumentCompileContext
): Record<string, SafeDocumentJsonValue> {
  return readProps(node, { kind: 'component', name, schema }, context);
}

export function readSafeElementProps(
  node: SafeDocumentMdastNode,
  tag: SafeDocumentElementTag,
  context: SafeDocumentCompileContext
): {
  props: Record<string, SafeDocumentJsonValue>;
  required: boolean;
} {
  const schema = ELEMENT_SCHEMAS[tag] ?? {};
  const props = readProps(
    node,
    {
      kind: 'element',
      name: tag,
      schema,
    },
    context
  );
  return {
    props,
    required: (schema.requiredProps ?? []).every((name) =>
      Object.hasOwn(props, name)
    ),
  };
}

function readProps(
  node: SafeDocumentMdastNode,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): Record<string, SafeDocumentJsonValue> {
  const props: Record<string, SafeDocumentJsonValue> = {};
  const seen = new Set<string>();
  for (const attribute of node.attributes ?? []) {
    if (
      attribute.type !== 'mdxJsxAttribute' ||
      typeof attribute.name !== 'string'
    ) {
      unsupportedExpression(attribute, options, context, 'spread');
      continue;
    }
    const name = attribute.name;
    if (
      isForbiddenProp(name) ||
      (options.kind === 'element' && /^on/i.test(name))
    ) {
      unsupportedAttribute(attribute, options, context);
      continue;
    }
    if (seen.has(name)) {
      addSafeDocumentDiagnostic(
        context,
        DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
        'safe-document/duplicate-prop',
        `duplicate prop ${options.name}.${name}`,
        attribute.position,
        { componentName: options.name, propName: name }
      );
      continue;
    }
    seen.add(name);

    const schema =
      options.schema.props && Object.hasOwn(options.schema.props, name)
        ? options.schema.props[name]
        : undefined;
    if (!schema) {
      unknownAttribute(attribute, options, context);
      continue;
    }
    const value = readAttributeValue(attribute, options, context);
    if (!value.ok) {
      continue;
    }
    const reason = validateSafeDocumentValue(value.value, schema);
    if (reason) {
      invalidValue(attribute, options, name, reason, context);
      continue;
    }
    if (
      !allowSafeDocumentValueUrls(
        value.value,
        schema,
        name,
        attribute,
        options,
        context
      )
    ) {
      continue;
    }
    props[name] = value.value;
  }

  for (const name of options.schema.requiredProps ?? []) {
    if (!Object.hasOwn(props, name)) {
      addSafeDocumentDiagnostic(
        context,
        DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP,
        'safe-document/missing-required-prop',
        `missing required prop ${options.name}.${name}`,
        node.position,
        { componentName: options.name, propName: name }
      );
    }
  }
  return props;
}

function allowSafeDocumentValueUrls(
  value: SafeDocumentJsonValue,
  schema: SafeDocumentValueSchema,
  path: string,
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): boolean {
  switch (schema.type) {
    case 'string':
      return (
        schema.format !== 'url' ||
        allowSafeDocumentUrl(
          value as string,
          { kind: options.kind, name: options.name, prop: path },
          attribute.position,
          context
        )
      );
    case 'array':
      return allowSafeDocumentArrayUrls(
        value as SafeDocumentJsonValue[],
        schema.items,
        path,
        attribute,
        options,
        context
      );
    case 'object':
      return allowSafeDocumentObjectUrls(
        value as Record<string, SafeDocumentJsonValue>,
        schema.properties,
        path,
        attribute,
        options,
        context
      );
    default:
      return true;
  }
}

function allowSafeDocumentArrayUrls(
  value: SafeDocumentJsonValue[],
  schema: SafeDocumentValueSchema,
  path: string,
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): boolean {
  let allowed = true;
  for (let index = 0; index < value.length; index++) {
    if (
      !allowSafeDocumentValueUrls(
        value[index]!,
        schema,
        `${path}[${index}]`,
        attribute,
        options,
        context
      )
    ) {
      allowed = false;
    }
  }
  return allowed;
}

function allowSafeDocumentObjectUrls(
  value: Record<string, SafeDocumentJsonValue>,
  schema: Readonly<Record<string, SafeDocumentValueSchema>>,
  path: string,
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): boolean {
  let allowed = true;
  for (const [name, child] of Object.entries(value)) {
    if (
      !allowSafeDocumentValueUrls(
        child,
        schema[name]!,
        `${path}.${name}`,
        attribute,
        options,
        context
      )
    ) {
      allowed = false;
    }
  }
  return allowed;
}

function readAttributeValue(
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): { ok: true; value: SafeDocumentJsonValue } | { ok: false } {
  if (attribute.value === null || attribute.value === undefined) {
    return { ok: true, value: true };
  }
  if (typeof attribute.value === 'string') {
    return { ok: true, value: attribute.value };
  }
  const result = readSafeLiteral(attribute.value.data?.estree);
  if (result.ok) {
    return result;
  }
  unsupportedExpression(attribute, options, context, result.reason);
  return { ok: false };
}

function unsupportedExpression(
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext,
  reason: string
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
    'safe-document/unsupported-expression',
    `unsupported expression in ${options.name}: ${reason}`,
    attribute.position,
    { kind: 'prop-expression', name: options.name, reason }
  );
}

function unsupportedAttribute(
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.UNSUPPORTED_ATTRIBUTE,
    'safe-document/unsupported-attribute',
    `unsupported attribute ${options.name}.${attribute.name ?? ''}`,
    attribute.position,
    {
      componentName: options.name,
      propName: attribute.name ?? '',
    }
  );
}

function unknownAttribute(
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  context: SafeDocumentCompileContext
): void {
  addSafeDocumentDiagnostic(
    context,
    options.kind === 'component'
      ? DIAGNOSTIC_CODES.UNKNOWN_PROP
      : DIAGNOSTIC_CODES.UNSUPPORTED_ATTRIBUTE,
    options.kind === 'component'
      ? 'safe-document/unknown-prop'
      : 'safe-document/unsupported-attribute',
    `unknown ${options.kind === 'component' ? 'prop' : 'attribute'} ${options.name}.${attribute.name ?? ''}`,
    attribute.position,
    {
      componentName: options.name,
      propName: attribute.name ?? '',
    }
  );
}

function invalidValue(
  attribute: SafeDocumentMdxAttribute,
  options: ReadPropsOptions,
  name: string,
  reason: string,
  context: SafeDocumentCompileContext
): void {
  addSafeDocumentDiagnostic(
    context,
    DIAGNOSTIC_CODES.INVALID_PROP_VALUE,
    'safe-document/invalid-prop-value',
    `invalid prop ${options.name}.${name}: ${reason}`,
    attribute.position,
    { componentName: options.name, propName: name, reason }
  );
}
