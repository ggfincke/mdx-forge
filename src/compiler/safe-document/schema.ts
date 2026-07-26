// src/compiler/safe-document/schema.ts
// normalize options & validate host component values against closed schemas

import { isReservedObjectKey } from '../../internal/object-key';
import type {
  SafeDocumentComponentSchema,
  SafeDocumentCompileOptions,
  SafeDocumentJsonValue,
  SafeDocumentValueSchema,
} from './types';

const MAX_SCHEMA_DEPTH = 16;
const COMPONENT_NAME = /^[A-Z_$][A-Za-z0-9_$]*(?:\.[A-Z_$][A-Za-z0-9_$]*)*$/;
const RESERVED_COMPONENT_PROPS = new Set([
  'children',
  'dangerouslySetInnerHTML',
  'key',
  'ref',
  'style',
  '__html',
]);

export function normalizeSafeDocumentOptions(
  options: SafeDocumentCompileOptions
): SafeDocumentCompileOptions {
  assertRecord(options, 'options');
  assertKnownKeys(options, [
    'allowUrl',
    'components',
    'rawHtml',
    'unknownComponents',
  ]);
  const normalized = safeRecord<SafeDocumentCompileOptions>();
  const unknownComponents = ownDataValue(
    options,
    'unknownComponents',
    'options.unknownComponents'
  );
  if (
    unknownComponents !== undefined &&
    unknownComponents !== 'reject' &&
    unknownComponents !== 'inert'
  ) {
    throw new TypeError('unknownComponents must be reject or inert');
  }
  if (unknownComponents !== undefined) {
    normalized.unknownComponents = unknownComponents;
  }
  const rawHtml = ownDataValue(options, 'rawHtml', 'options.rawHtml');
  if (rawHtml !== undefined && rawHtml !== 'reject' && rawHtml !== 'allow') {
    throw new TypeError('rawHtml must be reject or allow');
  }
  if (rawHtml !== undefined) {
    normalized.rawHtml = rawHtml;
  }
  const allowUrl = ownDataValue(options, 'allowUrl', 'options.allowUrl');
  if (allowUrl !== undefined && typeof allowUrl !== 'function') {
    throw new TypeError('allowUrl must be a function');
  }
  if (allowUrl !== undefined) {
    normalized.allowUrl = allowUrl as SafeDocumentCompileOptions['allowUrl'];
  }
  const components = ownDataValue(options, 'components', 'options.components');
  if (components !== undefined) {
    normalized.components = normalizeComponents(components);
  }
  return Object.freeze(normalized);
}

function normalizeComponents(
  components: unknown
): Readonly<Record<string, SafeDocumentComponentSchema>> {
  assertRecord(components, 'components');
  const normalized = safeRecord<Record<string, SafeDocumentComponentSchema>>();
  for (const [name, component] of ownDataEntries(components, 'components')) {
    if (!COMPONENT_NAME.test(name)) {
      throw new TypeError(`invalid host component name ${name}`);
    }
    assertRecord(component, `component ${name}`);
    assertKnownKeys(component, ['children', 'props', 'requiredProps']);
    const children = ownDataValue(
      component,
      'children',
      `component ${name}.children`
    );
    if (
      children !== undefined &&
      children !== 'none' &&
      children !== 'optional' &&
      children !== 'required'
    ) {
      throw new TypeError(`invalid children policy for ${name}`);
    }
    const propsValue = ownDataValue(
      component,
      'props',
      `component ${name}.props`
    );
    const props = safeRecord<Record<string, SafeDocumentValueSchema>>();
    if (propsValue !== undefined) {
      assertRecord(propsValue, `${name}.props`);
      for (const [prop, schema] of ownDataEntries(
        propsValue,
        `${name}.props`
      )) {
        if (isForbiddenProp(prop)) {
          throw new TypeError(`reserved prop ${name}.${prop}`);
        }
        props[prop] = normalizeSchema(schema, `${name}.${prop}`, 0, new Set());
      }
    }
    const requiredProps = normalizeStringArray(
      ownDataValue(
        component,
        'requiredProps',
        `component ${name}.requiredProps`
      ),
      `${name}.requiredProps`
    );
    for (const prop of requiredProps ?? []) {
      if (!Object.hasOwn(props, prop)) {
        throw new TypeError(`required prop ${name}.${prop} has no schema`);
      }
    }
    const normalizedComponent = safeRecord<SafeDocumentComponentSchema>();
    if (children !== undefined) {
      normalizedComponent.children = children;
    }
    if (propsValue !== undefined) {
      normalizedComponent.props = Object.freeze(props);
    }
    if (requiredProps !== undefined) {
      normalizedComponent.requiredProps = requiredProps;
    }
    normalized[name] = Object.freeze(normalizedComponent);
  }
  return Object.freeze(normalized);
}

export function isForbiddenProp(name: string): boolean {
  return (
    RESERVED_COMPONENT_PROPS.has(name) ||
    isReservedObjectKey(name) ||
    /^on[A-Z]/.test(name)
  );
}

export function validateSafeDocumentValue(
  value: SafeDocumentJsonValue,
  schema: SafeDocumentValueSchema
): string | null {
  switch (schema.type) {
    case 'string': {
      if (typeof value !== 'string') {
        return 'expected a string';
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return `string exceeds ${schema.maxLength} characters`;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        return `expected one of ${schema.enum.join(', ')}`;
      }
      return null;
    }
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'expected a finite number';
      }
      if (schema.integer && !Number.isInteger(value)) {
        return 'expected an integer';
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `expected a number >= ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `expected a number <= ${schema.maximum}`;
      }
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'expected a boolean';
    case 'null':
      return value === null ? null : 'expected null';
    case 'array':
      if (!Array.isArray(value)) {
        return 'expected an array';
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        return `array exceeds ${schema.maxItems} items`;
      }
      for (let index = 0; index < value.length; index++) {
        const reason = validateSafeDocumentValue(value[index]!, schema.items);
        if (reason) {
          return `item ${index}: ${reason}`;
        }
      }
      return null;
    case 'object':
      if (!isJsonObject(value)) {
        return 'expected an object';
      }
      return validateObject(value, schema);
    default:
      return 'unknown schema type';
  }
}

function validateObject(
  value: Record<string, SafeDocumentJsonValue>,
  schema: Extract<SafeDocumentValueSchema, { type: 'object' }>
): string | null {
  const entries = Object.entries(value);
  if (
    schema.maxProperties !== undefined &&
    entries.length > schema.maxProperties
  ) {
    return `object exceeds ${schema.maxProperties} properties`;
  }
  for (const name of schema.required ?? []) {
    if (!Object.hasOwn(value, name)) {
      return `missing required property ${name}`;
    }
  }
  for (const [name, child] of entries) {
    const childSchema = Object.hasOwn(schema.properties, name)
      ? schema.properties[name]
      : undefined;
    if (!childSchema) {
      return `unknown property ${name}`;
    }
    const reason = validateSafeDocumentValue(child, childSchema);
    if (reason) {
      return `${name}: ${reason}`;
    }
  }
  return null;
}

function isJsonObject(
  value: SafeDocumentJsonValue
): value is Record<string, SafeDocumentJsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSchema(
  schema: unknown,
  path: string,
  depth: number,
  ancestors: Set<object>
): SafeDocumentValueSchema {
  assertRecord(schema, path);
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new TypeError(`schema nesting exceeds depth ${MAX_SCHEMA_DEPTH}`);
  }
  if (ancestors.has(schema)) {
    throw new TypeError(`cyclic schema at ${path}`);
  }
  ancestors.add(schema);
  try {
    return normalizeSchemaShape(schema, path, depth, ancestors);
  } finally {
    ancestors.delete(schema);
  }
}

function normalizeSchemaShape(
  schema: object,
  path: string,
  depth: number,
  ancestors: Set<object>
): SafeDocumentValueSchema {
  const type = ownDataValue(schema, 'type', `${path}.type`);
  switch (type) {
    case 'string': {
      assertKnownKeys(schema, ['enum', 'format', 'maxLength', 'type']);
      const maxLength = ownDataValue(schema, 'maxLength', `${path}.maxLength`);
      assertNonNegativeInteger(maxLength, `${path}.maxLength`);
      const format = ownDataValue(schema, 'format', `${path}.format`);
      if (format !== undefined && format !== 'url') {
        throw new TypeError(`${path}.format must be url`);
      }
      const enumValues = normalizeStringArray(
        ownDataValue(schema, 'enum', `${path}.enum`),
        `${path}.enum`
      );
      return frozenSchema({
        type,
        ...(maxLength !== undefined ? { maxLength } : {}),
        ...(format !== undefined ? { format } : {}),
        ...(enumValues !== undefined ? { enum: enumValues } : {}),
      });
    }
    case 'number': {
      assertKnownKeys(schema, ['integer', 'maximum', 'minimum', 'type']);
      const minimum = ownDataValue(schema, 'minimum', `${path}.minimum`);
      const maximum = ownDataValue(schema, 'maximum', `${path}.maximum`);
      const integer = ownDataValue(schema, 'integer', `${path}.integer`);
      assertFinite(minimum, `${path}.minimum`);
      assertFinite(maximum, `${path}.maximum`);
      if (integer !== undefined && typeof integer !== 'boolean') {
        throw new TypeError(`${path}.integer must be a boolean`);
      }
      if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
        throw new TypeError(`${path}.minimum exceeds maximum`);
      }
      return frozenSchema({
        type,
        ...(integer !== undefined ? { integer } : {}),
        ...(minimum !== undefined ? { minimum } : {}),
        ...(maximum !== undefined ? { maximum } : {}),
      });
    }
    case 'boolean':
    case 'null':
      assertKnownKeys(schema, ['type']);
      return frozenSchema({ type });
    case 'array': {
      assertKnownKeys(schema, ['items', 'maxItems', 'type']);
      const maxItems = ownDataValue(schema, 'maxItems', `${path}.maxItems`);
      assertNonNegativeInteger(maxItems, `${path}.maxItems`);
      const items = normalizeSchema(
        ownDataValue(schema, 'items', `${path}.items`),
        `${path}.items`,
        depth + 1,
        ancestors
      );
      return frozenSchema({
        type,
        items,
        ...(maxItems !== undefined ? { maxItems } : {}),
      });
    }
    case 'object': {
      assertKnownKeys(schema, [
        'additionalProperties',
        'maxProperties',
        'properties',
        'required',
        'type',
      ]);
      const additionalProperties = ownDataValue(
        schema,
        'additionalProperties',
        `${path}.additionalProperties`
      );
      if (
        additionalProperties !== undefined &&
        additionalProperties !== false
      ) {
        throw new TypeError(`${path}.additionalProperties must be false`);
      }
      const maxProperties = ownDataValue(
        schema,
        'maxProperties',
        `${path}.maxProperties`
      );
      assertNonNegativeInteger(maxProperties, `${path}.maxProperties`);
      const propertiesValue = ownDataValue(
        schema,
        'properties',
        `${path}.properties`
      );
      assertRecord(propertiesValue, `${path}.properties`);
      const properties = safeRecord<Record<string, SafeDocumentValueSchema>>();
      for (const [name, child] of ownDataEntries(
        propertiesValue,
        `${path}.properties`
      )) {
        if (isReservedObjectKey(name)) {
          throw new TypeError(`reserved object key ${path}.${name}`);
        }
        properties[name] = normalizeSchema(
          child,
          `${path}.${name}`,
          depth + 1,
          ancestors
        );
      }
      const required = normalizeStringArray(
        ownDataValue(schema, 'required', `${path}.required`),
        `${path}.required`
      );
      for (const name of required ?? []) {
        if (!Object.hasOwn(properties, name)) {
          throw new TypeError(`required key ${path}.${name} has no schema`);
        }
      }
      return frozenSchema({
        type,
        properties: Object.freeze(properties),
        ...(required !== undefined ? { required } : {}),
        ...(additionalProperties !== undefined ? { additionalProperties } : {}),
        ...(maxProperties !== undefined ? { maxProperties } : {}),
      });
    }
    default:
      throw new TypeError(`unknown schema type at ${path}`);
  }
}

function assertKnownKeys(value: object, allowed: readonly string[]): void {
  const known = new Set(allowed);
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!known.has(key)) {
      throw new TypeError(`unknown schema option ${key}`);
    }
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError('schema options cannot use symbol keys');
  }
}

function assertRecord(value: unknown, path: string): asserts value is object {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${path} must be a plain object`);
  }
}

function normalizeStringArray(
  value: unknown,
  path: string
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must contain strings`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} cannot use symbol keys`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
    string,
    PropertyDescriptor
  >;
  const length = descriptors.length?.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new TypeError(`${path} must contain strings`);
  }
  const normalized: string[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !('value' in descriptor)) {
      throw new TypeError(`${path}[${index}] must be a data property`);
    }
    const item = descriptor.value;
    if (typeof item !== 'string') {
      throw new TypeError(`${path} must contain strings`);
    }
    normalized.push(item);
  }
  const expectedKeys = new Set([
    'length',
    ...normalized.map((_, index) => String(index)),
  ]);
  for (const key of Object.keys(descriptors)) {
    if (!expectedKeys.has(key)) {
      throw new TypeError(`${path} cannot use property ${key}`);
    }
  }
  return Object.freeze(normalized);
}

function assertFinite(
  value: unknown,
  path: string
): asserts value is number | undefined {
  if (
    value !== undefined &&
    (typeof value !== 'number' || !Number.isFinite(value))
  ) {
    throw new TypeError(`${path} must be finite`);
  }
}

function assertNonNegativeInteger(
  value: unknown,
  path: string
): asserts value is number | undefined {
  if (
    value !== undefined &&
    (typeof value !== 'number' || !Number.isInteger(value) || value < 0)
  ) {
    throw new TypeError(`${path} must be a non-negative integer`);
  }
}

function ownDataValue(value: object, key: string, path: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) {
    return undefined;
  }
  if (!('value' in descriptor)) {
    throw new TypeError(`${path} must be a data property`);
  }
  return descriptor.value;
}

function ownDataEntries(value: object, path: string): Array<[string, unknown]> {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError(`${path} cannot use symbol keys`);
  }
  return Object.getOwnPropertyNames(value).map((key) => [
    key,
    ownDataValue(value, key, `${path}.${key}`),
  ]);
}

function safeRecord<T extends object>(): T {
  return Object.create(null) as T;
}

function frozenSchema<T extends SafeDocumentValueSchema>(schema: T): T {
  return Object.freeze(Object.assign(safeRecord<T>(), schema));
}
