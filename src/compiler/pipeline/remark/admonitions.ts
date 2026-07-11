// src/compiler/pipeline/remark/admonitions.ts
// transform directive syntax (:::note, :::warning, etc.) to admonition HTML

import { visit } from 'unist-util-visit';
import type {
  Root,
  Parent,
  PhrasingContent,
  BlockContent,
  RootContent,
} from 'mdast';
import type { ContainerDirective } from 'mdast-util-directive';
import {
  CALLOUT_TYPE_ALIASES,
  type CalloutType,
  type CalloutStyleConfig,
  buildCalloutStyleMap,
} from '../../../internal/callout';
import { createCalloutCard } from '../transforms/utils';
import {
  PREVIEW_ADMONITION,
  PREVIEW_ADMONITION_NOTE,
  PREVIEW_ADMONITION_TIP,
  PREVIEW_ADMONITION_INFO,
  PREVIEW_ADMONITION_WARNING,
  PREVIEW_ADMONITION_DANGER,
  PREVIEW_ADMONITION_CAUTION,
  PREVIEW_ADMONITION_IMPORTANT,
  PREVIEW_ADMONITION_SUMMARY,
  PREVIEW_ADMONITION_HINT,
  PREVIEW_ADMONITION_SUCCESS,
  PREVIEW_ADMONITION_QUESTION,
  PREVIEW_ADMONITION_FAILURE,
  PREVIEW_ADMONITION_BUG,
  PREVIEW_ADMONITION_EXAMPLE,
  PREVIEW_ADMONITION_QUOTE,
  PREVIEW_ADMONITION_TODO,
  PREVIEW_ADMONITION_ATTENTION,
  PREVIEW_ADMONITION_HEADER,
  PREVIEW_ADMONITION_ICON,
  PREVIEW_ADMONITION_CONTENT,
} from '../../internal/css-classes';

// CSS class lookup for preview admonition types
const ADMONITION_CLASSES: Record<CalloutType, string> = {
  note: PREVIEW_ADMONITION_NOTE,
  tip: PREVIEW_ADMONITION_TIP,
  info: PREVIEW_ADMONITION_INFO,
  warning: PREVIEW_ADMONITION_WARNING,
  danger: PREVIEW_ADMONITION_DANGER,
  caution: PREVIEW_ADMONITION_CAUTION,
  important: PREVIEW_ADMONITION_IMPORTANT,
  summary: PREVIEW_ADMONITION_SUMMARY,
  hint: PREVIEW_ADMONITION_HINT,
  success: PREVIEW_ADMONITION_SUCCESS,
  question: PREVIEW_ADMONITION_QUESTION,
  failure: PREVIEW_ADMONITION_FAILURE,
  bug: PREVIEW_ADMONITION_BUG,
  example: PREVIEW_ADMONITION_EXAMPLE,
  quote: PREVIEW_ADMONITION_QUOTE,
  todo: PREVIEW_ADMONITION_TODO,
  attention: PREVIEW_ADMONITION_ATTENTION,
};

// admonition config derived from shared callout registry
const ADMONITION_TYPES: Record<string, CalloutStyleConfig> =
  buildCalloutStyleMap((type) => ADMONITION_CLASSES[type]);

// type guard for container directive
function isContainerDirective(node: unknown): node is ContainerDirective {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    node.type === 'containerDirective'
  );
}

// extract custom title from directive children (e.g., :::note[Custom Title])
function extractCustomTitle(node: ContainerDirective): string | null {
  // check attributes first (some parsers put it there)
  if (node.attributes && 'title' in node.attributes) {
    return node.attributes.title as string;
  }

  // check for directiveLabel in data
  const data = node.data as { directiveLabel?: boolean } | undefined;
  if (data?.directiveLabel) {
    // the label is in the first child if it's a paragraph w/ directiveLabel
    const firstChild = node.children?.[0];
    if (
      firstChild &&
      'type' in firstChild &&
      firstChild.type === 'paragraph' &&
      'data' in firstChild &&
      (firstChild.data as { directiveLabel?: boolean })?.directiveLabel
    ) {
      // extract text content from the label paragraph
      const labelNode = firstChild as Parent;
      const textContent = labelNode.children
        ?.filter(
          (child): child is { type: 'text'; value: string } =>
            'type' in child && child.type === 'text'
        )
        .map((child) => child.value)
        .join('');
      return textContent || null;
    }
  }

  return null;
}

// get the lowercased directive name
function getDirectiveName(node: ContainerDirective): string {
  return node.name ? node.name.toLowerCase() : '';
}

// resolve directive name to admonition config (handles aliases)
function resolveAdmonitionType(name: string): CalloutStyleConfig | undefined {
  // direct match
  if (name in ADMONITION_TYPES) {
    return ADMONITION_TYPES[name];
  }

  // alias match
  const canonical = CALLOUT_TYPE_ALIASES[name];
  if (canonical) {
    return ADMONITION_TYPES[canonical];
  }

  return undefined;
}

// create AST node for admonition via the shared createCalloutCard scaffold
function createAdmonitionNode(
  config: CalloutStyleConfig,
  title: string,
  children: Array<BlockContent | PhrasingContent>
): RootContent {
  // filter out directive label from children if present
  const contentChildren = children.filter((child) => {
    if ('data' in child) {
      const data = child.data as { directiveLabel?: boolean } | undefined;
      return !data?.directiveLabel;
    }
    return true;
  });

  return createCalloutCard({
    outerType: 'admonition',
    wrapperTag: 'div',
    outerClassNames: [PREVIEW_ADMONITION, config.className],
    additionalProps: { 'data-admonition-type': config.label.toLowerCase() },
    headerType: 'admonitionHeader',
    headerTag: 'div',
    headerClassName: PREVIEW_ADMONITION_HEADER,
    headerMode: 'split-icon-text',
    iconClassName: PREVIEW_ADMONITION_ICON,
    icon: config.icon,
    title,
    contentType: 'admonitionContent',
    contentClassName: PREVIEW_ADMONITION_CONTENT,
    contentChildren: contentChildren as RootContent[],
  });
}

// transform container directives to admonitions
export default function remarkAdmonitions() {
  return (tree: Root) => {
    visit(
      tree,
      (node: unknown): node is ContainerDirective => isContainerDirective(node),
      (
        node: ContainerDirective,
        index: number | undefined,
        parent: Parent | undefined
      ) => {
        if (index === undefined || !parent) {
          return;
        }

        const directiveName = getDirectiveName(node);

        // check if this is a supported admonition type (direct or alias)
        const admonitionType = resolveAdmonitionType(directiveName);
        if (!admonitionType) {
          // not an admonition directive, leave it alone
          return;
        }

        // extract custom title or use default
        const customTitle = extractCustomTitle(node);
        const title = customTitle || admonitionType.label;

        // create admonition node
        const admonitionNode = createAdmonitionNode(
          admonitionType,
          title,
          node.children as Array<BlockContent | PhrasingContent>
        );

        // replace the directive node w/ the admonition node
        parent.children.splice(
          index,
          1,
          admonitionNode as (typeof parent.children)[number]
        );
      }
    );
  };
}
