// src/compiler/safe/compile.ts
// safe MDX parser w/ AST transformation only (no code execution)

import { unified } from 'unified';
import type { Pluggable } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import type {
  Root,
  Parent,
  RootContent,
  BlockContent,
  PhrasingContent,
} from 'mdast';
import { extractFrontmatter } from '../pipeline/common/mdx-common';
import {
  getSafeRemarkPlugins,
  getSafeRehypePluginSets,
} from '../plugins/builder';
import { warnIgnoredSafeModeConfig } from '../pipeline/common/pipeline-warnings';
import remarkGenericComponents, {
  KNOWN_GENERIC_COMPONENTS,
} from '../pipeline/remark/generic-components';
import { escapeHtml, isMdxJsxElement } from '../pipeline/transforms/utils';
import { getLogger } from '../internal/logging';

import type {
  CompilerConfig,
  UnknownBehavior,
  SafeHTMLResult,
  MdxJsxElement,
  MdxJsxAttribute,
} from '../types';
import {
  EXPRESSION_PLACEHOLDER,
  JSX_PLACEHOLDER,
  UNKNOWN_COMPONENT_PLACEHOLDER,
  UNKNOWN_COMPONENT_EMPTY,
  UNKNOWN_COMPONENT_HEADER,
  UNKNOWN_ICON,
  UNKNOWN_HINT,
  UNKNOWN_COMPONENT_CONTENT,
} from '../internal/css-classes';

// HTML void elements that don't need closing tags
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

// regex to detect lowercase-initial element names (HTML intrinsic elements)
const LOWERCASE_START = /^[a-z]/;

// check if a JSX element name is a standard HTML intrinsic element
// (lowercase first char, no dots — matches JSX/React convention)
function isHtmlElement(name: string | null): boolean {
  if (!name) {
    return false;
  }
  return LOWERCASE_START.test(name) && !name.includes('.');
}

// serialize MDX JSX attribute to HTML attribute string
function serializeAttribute(attr: MdxJsxAttribute): string {
  if (attr.type !== 'mdxJsxAttribute') {
    return '';
  }
  // boolean shorthand: <div hidden />
  if (attr.value === null) {
    return ` ${attr.name}`;
  }
  if (typeof attr.value === 'string') {
    return ` ${attr.name}="${escapeHtml(attr.value)}"`;
  }
  // expression values (e.g., {someVar}) - skip in Safe Mode
  return '';
}

// serialize a child AST node to HTML string
function serializeChildToHtml(child: BlockContent | PhrasingContent): string {
  if ('value' in child && typeof child.value === 'string') {
    return child.value;
  }
  if (isMdxJsxElement(child)) {
    return serializeJsxToHtml(child);
  }
  // nodes w/ children (e.g., paragraph wrapping inline elements)
  if ('children' in child && Array.isArray(child.children)) {
    return (child.children as Array<BlockContent | PhrasingContent>)
      .map((c) => serializeChildToHtml(c))
      .join('');
  }
  return '';
}

// serialize MDX JSX element back to raw HTML string
function serializeJsxToHtml(node: MdxJsxElement): string {
  const name = node.name || 'div';
  const attrs = node.attributes.map(serializeAttribute).join('');

  if (!node.children || node.children.length === 0) {
    if (VOID_ELEMENTS.has(name)) {
      return `<${name}${attrs}>`;
    }
    return `<${name}${attrs}></${name}>`;
  }

  // serialize children recursively
  const childrenHtml = node.children
    .map((child) => serializeChildToHtml(child))
    .join('');

  return `<${name}${attrs}>${childrenHtml}</${name}>`;
}

// options for remarkStripMdx plugin
interface RemarkStripMdxOptions {
  unknownBehavior?: UnknownBehavior;
  builtinsEnabled?: boolean;
  componentNameResolver?: (name: string) => string | undefined;
}

// remark plugin to strip MDX-specific nodes (replaces JSX elements & expressions based on behavior)
function remarkStripMdx(options: RemarkStripMdxOptions = {}) {
  const {
    unknownBehavior = 'placeholder',
    builtinsEnabled = true,
    componentNameResolver,
  } = options;

  return (tree: Root) => {
    const nodesToRemove: Array<{ parent: Parent; index: number }> = [];

    visit(tree, (node, index, parent) => {
      if (index === undefined || parent === undefined) {
        return;
      }

      // remove import/export declarations (mdxjsEsm nodes)
      if (node.type === 'mdxjsEsm') {
        nodesToRemove.push({ parent: parent as Parent, index });
        return;
      }

      // handle JSX elements (both block-level & inline components)
      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      ) {
        const jsxNode = node as unknown as MdxJsxElement;
        const name = jsxNode.name || 'Component';
        const isFlow = node.type === 'mdxJsxFlowElement';

        // pass through standard HTML elements as raw HTML
        if (isHtmlElement(jsxNode.name)) {
          const htmlNode: RootContent = {
            type: 'html',
            value: serializeJsxToHtml(jsxNode),
          } as RootContent;
          (parent as Parent).children[index] = htmlNode;
          return;
        }

        const isKnownComponent =
          builtinsEnabled && KNOWN_GENERIC_COMPONENTS.has(name);
        const resolvedName = componentNameResolver?.(name) ?? name;

        const replacement = createJsxReplacement(
          jsxNode,
          resolvedName,
          unknownBehavior,
          isKnownComponent,
          isFlow
        );

        if (replacement === null) {
          nodesToRemove.push({ parent: parent as Parent, index });
        } else if (Array.isArray(replacement)) {
          (parent as Parent).children.splice(index, 1, ...replacement);
        } else {
          (parent as Parent).children[index] = replacement;
        }
        return;
      }

      // replace flow expressions {expression} w/ placeholder
      if (node.type === 'mdxFlowExpression') {
        const placeholder: RootContent = {
          type: 'paragraph',
          children: [
            {
              type: 'html',
              value: `<span class="${EXPRESSION_PLACEHOLDER}" title="JavaScript expression (requires Trusted Mode)">{...}</span>`,
            },
          ],
        };
        (parent as Parent).children[index] = placeholder;
        return;
      }

      // replace text expressions w/ placeholder
      if (node.type === 'mdxTextExpression') {
        const placeholder: RootContent = {
          type: 'html',
          value: `<span class="${EXPRESSION_PLACEHOLDER}" title="JavaScript expression (requires Trusted Mode)">{...}</span>`,
        } as RootContent;
        (parent as Parent).children[index] = placeholder;
        return;
      }
    });

    // remove collected nodes (in reverse order to preserve indices)
    for (let i = nodesToRemove.length - 1; i >= 0; i--) {
      const { parent, index } = nodesToRemove[i];
      parent.children.splice(index, 1);
    }
  };
}

// create block-level placeholder for unknown JSX flow element
function createFlowPlaceholder(
  node: MdxJsxElement,
  escapedName: string,
  hint: string
): RootContent {
  const hasChildren = node.children && node.children.length > 0;

  if (hasChildren) {
    // placeholder wrapper w/ children inside
    return {
      type: 'unknownComponent' as RootContent['type'],
      data: {
        hName: 'div',
        hProperties: {
          className: [UNKNOWN_COMPONENT_PLACEHOLDER],
        },
      },
      children: [
        {
          type: 'html',
          value: `<div class="${UNKNOWN_COMPONENT_HEADER}"><span class="${UNKNOWN_ICON}">⚠</span><code>&lt;${escapedName}&gt;</code><span class="${UNKNOWN_HINT}">${hint}</span></div>`,
        },
        {
          type: 'unknownComponentContent' as RootContent['type'],
          data: {
            hName: 'div',
            hProperties: {
              className: [UNKNOWN_COMPONENT_CONTENT],
            },
          },
          children: node.children,
        } as RootContent,
      ],
    } as RootContent;
  }

  // self-closing component placeholder
  return {
    type: 'paragraph',
    children: [
      {
        type: 'html',
        value: `<div class="${UNKNOWN_COMPONENT_PLACEHOLDER} ${UNKNOWN_COMPONENT_EMPTY}"><div class="${UNKNOWN_COMPONENT_HEADER}"><span class="${UNKNOWN_ICON}">⚠</span><code>&lt;${escapedName} /&gt;</code><span class="${UNKNOWN_HINT}">${hint}</span></div></div>`,
      },
    ],
  };
}

// create inline placeholder for unknown JSX text element
function createInlinePlaceholder(
  escapedName: string,
  hint: string
): RootContent {
  return {
    type: 'html',
    value: `<span class="${JSX_PLACEHOLDER}" title="JSX component ${hint}">&lt;${escapedName} /&gt;</span>`,
  } as RootContent;
}

// create replacement for JSX element based on unknownBehavior
function createJsxReplacement(
  node: MdxJsxElement,
  name: string,
  behavior: UnknownBehavior,
  isKnownComponent: boolean,
  isFlowElement: boolean
): RootContent | RootContent[] | null {
  const escapedName = escapeHtml(name);

  switch (behavior) {
    case 'strip':
      return null;

    case 'raw':
      if (node.children && node.children.length > 0) {
        return node.children as unknown as RootContent[];
      }
      return null;

    case 'placeholder':
    default: {
      const hint = isKnownComponent
        ? '(builtin component - transform failed)'
        : '(unknown component)';

      return isFlowElement
        ? createFlowPlaceholder(node, escapedName, hint)
        : createInlinePlaceholder(escapedName, hint);
    }
  }
}

// unified processor type for dynamic plugin pipeline building
interface PluginPipeline {
  use(plugin: Pluggable, settings?: unknown): PluginPipeline;
  process(file: string): Promise<{ toString(): string }>;
}

// apply plugins from array to unified processor
function applyPlugins<T extends PluginPipeline>(
  processor: T,
  plugins: Pluggable[]
): T {
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      // plugin w/ options: [pluginFn, options]
      const [pluginFn, options] = plugin;
      processor.use(pluginFn as Pluggable, options);
    } else {
      processor.use(plugin);
    }
  }
  return processor;
}

// compile MDX to safe static HTML (strip frontmatter, parse AST, remove dangerous nodes, & convert to HTML)
export async function compileSafe(
  mdxText: string,
  config: CompilerConfig
): Promise<SafeHTMLResult> {
  const log = getLogger(config.logger);

  // warn if custom plugins are configured but will be ignored in Safe Mode
  if (config.configFile) {
    warnIgnoredSafeModeConfig(config.configFile.config, log);
  }
  // extract frontmatter before compilation
  const { content, frontmatter } = extractFrontmatter(mdxText);

  // get configuration for builtins & unknown behavior settings
  const builtinsEnabled = config.componentsBuiltins ?? true;
  const unknownBehavior: UnknownBehavior =
    config.componentsUnknownBehavior ?? 'placeholder';

  // get rehype plugin sets from plugin-builder
  const { raw, preMath, math, postMath } = getSafeRehypePluginSets();

  // build unified pipeline w/ shared plugins via plugin-builder
  const remarkPlugins = getSafeRemarkPlugins();

  // stage 1: parse MDX & apply remark plugins
  const remarkProcessor = applyPlugins(
    unified()
      .use(remarkParse)
      .use(remarkMdx)
      // transform known generic components to semantic HTML (before stripping)
      .use(remarkGenericComponents, { enabled: builtinsEnabled })
      // strip unknown JSX elements based on configured behavior
      .use(remarkStripMdx, {
        unknownBehavior,
        builtinsEnabled,
        componentNameResolver: config.componentNameResolver,
      }),
    remarkPlugins
  );

  // stage 2: convert to rehype & apply rehype plugins
  // rehype-raw parses raw HTML nodes into proper HAST elements
  const rehypeProcessor = applyPlugins(
    applyPlugins(
      applyPlugins(
        applyPlugins(
          remarkProcessor.use(remarkRehype, { allowDangerousHtml: true }),
          [raw]
        ),
        preMath
      ),
      [math]
    ),
    postMath
  );

  // stage 3: stringify to HTML
  const processor = rehypeProcessor.use(rehypeStringify, {
    allowDangerousHtml: true,
  });

  const result = await processor.process(content);

  return {
    html: String(result),
    frontmatter: frontmatter as Record<string, unknown>,
  };
}
