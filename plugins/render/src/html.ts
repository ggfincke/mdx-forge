// plugins/render/src/html.ts
// strip executable HTML from screenshot-mode Safe Mode output

import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toHtml } from 'hast-util-to-html';
import type { Properties, RootContent } from 'hast';

const BLOCKED_TAG_NAMES = new Set([
  'base',
  'embed',
  'frame',
  'frameset',
  'iframe',
  'meta',
  'object',
  'portal',
  'script',
]);
const URL_PROPERTY_NAMES = new Set(['formaction', 'href', 'src', 'xlinkhref']);

export function sanitizeScreenshotHtml(bodyHtml: string): string {
  const tree = fromHtmlIsomorphic(bodyHtml, { fragment: true });
  tree.children = sanitizeChildNodes(tree.children);
  return toHtml(tree);
}

function sanitizeChildNodes<T extends RootContent>(children: T[]): T[] {
  const sanitized: T[] = [];

  for (const child of children) {
    const next = sanitizeNode(child);
    if (next) {
      sanitized.push(next);
    }
  }

  return sanitized;
}

function sanitizeNode<T extends RootContent>(node: T): T | null {
  if (node.type !== 'element') {
    return node;
  }
  if (BLOCKED_TAG_NAMES.has(node.tagName)) {
    return null;
  }

  node.properties = sanitizeProperties(node.properties);
  node.children = sanitizeChildNodes(node.children);
  return node;
}

function sanitizeProperties(properties: Properties): Properties {
  const sanitized: Properties = {};

  for (const [name, value] of Object.entries(properties)) {
    const normalizedName = name.toLowerCase();
    if (normalizedName.startsWith('on') || normalizedName === 'srcdoc') {
      continue;
    }
    if (
      URL_PROPERTY_NAMES.has(normalizedName) &&
      hasJavascriptProtocol(value)
    ) {
      continue;
    }
    sanitized[name] = value;
  }

  return sanitized;
}

function hasJavascriptProtocol(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => hasJavascriptProtocol(entry));
  }
  if (typeof value !== 'string') {
    return false;
  }

  return value
    .replace(/[\u0000-\u0020]+/g, '')
    .toLowerCase()
    .startsWith('javascript:');
}
