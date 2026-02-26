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
import { CALLOUT_ICONS } from '../../../internal/icons';
import {
  CALLOUT_TITLES,
  type CalloutStyleConfig,
} from '../../../internal/callout';
import { createNode } from '../transforms/utils';
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

// supported admonition types (Docusaurus + Starlight + crossnote compatible)
const ADMONITION_TYPES: Record<string, CalloutStyleConfig> = {
  note: {
    className: PREVIEW_ADMONITION_NOTE,
    label: CALLOUT_TITLES.note,
    icon: CALLOUT_ICONS.note,
  },
  tip: {
    className: PREVIEW_ADMONITION_TIP,
    label: CALLOUT_TITLES.tip,
    icon: CALLOUT_ICONS.tip,
  },
  info: {
    className: PREVIEW_ADMONITION_INFO,
    label: CALLOUT_TITLES.info,
    icon: CALLOUT_ICONS.info,
  },
  warning: {
    className: PREVIEW_ADMONITION_WARNING,
    label: CALLOUT_TITLES.warning,
    icon: CALLOUT_ICONS.warning,
  },
  danger: {
    className: PREVIEW_ADMONITION_DANGER,
    label: CALLOUT_TITLES.danger,
    icon: CALLOUT_ICONS.danger,
  },
  caution: {
    className: PREVIEW_ADMONITION_CAUTION,
    label: CALLOUT_TITLES.caution,
    icon: CALLOUT_ICONS.caution,
  },
  important: {
    className: PREVIEW_ADMONITION_IMPORTANT,
    label: CALLOUT_TITLES.important,
    icon: CALLOUT_ICONS.important,
  },
  summary: {
    className: PREVIEW_ADMONITION_SUMMARY,
    label: CALLOUT_TITLES.summary,
    icon: CALLOUT_ICONS.summary,
  },
  hint: {
    className: PREVIEW_ADMONITION_HINT,
    label: CALLOUT_TITLES.hint,
    icon: CALLOUT_ICONS.hint,
  },
  success: {
    className: PREVIEW_ADMONITION_SUCCESS,
    label: CALLOUT_TITLES.success,
    icon: CALLOUT_ICONS.success,
  },
  question: {
    className: PREVIEW_ADMONITION_QUESTION,
    label: CALLOUT_TITLES.question,
    icon: CALLOUT_ICONS.question,
  },
  failure: {
    className: PREVIEW_ADMONITION_FAILURE,
    label: CALLOUT_TITLES.failure,
    icon: CALLOUT_ICONS.failure,
  },
  bug: {
    className: PREVIEW_ADMONITION_BUG,
    label: CALLOUT_TITLES.bug,
    icon: CALLOUT_ICONS.bug,
  },
  example: {
    className: PREVIEW_ADMONITION_EXAMPLE,
    label: CALLOUT_TITLES.example,
    icon: CALLOUT_ICONS.example,
  },
  quote: {
    className: PREVIEW_ADMONITION_QUOTE,
    label: CALLOUT_TITLES.quote,
    icon: CALLOUT_ICONS.quote,
  },
  todo: {
    className: PREVIEW_ADMONITION_TODO,
    label: CALLOUT_TITLES.todo,
    icon: CALLOUT_ICONS.todo,
  },
  attention: {
    className: PREVIEW_ADMONITION_ATTENTION,
    label: CALLOUT_TITLES.attention,
    icon: CALLOUT_ICONS.attention,
  },
};

// aliases map to canonical types above
const ADMONITION_ALIASES: Record<string, string> = {
  abstract: 'summary',
  tldr: 'summary',
  check: 'success',
  done: 'success',
  help: 'question',
  faq: 'question',
  fail: 'failure',
  missing: 'failure',
  snippet: 'example',
  cite: 'quote',
};

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

  // check for [Title] syntax in name
  const nameMatch = node.name?.match(/^(\w+)\[(.+)\]$/);
  if (nameMatch) {
    return nameMatch[2];
  }

  return null;
}

// get the directive name without custom title
function getDirectiveName(node: ContainerDirective): string {
  if (!node.name) {
    return '';
  }

  // handle :::note[Title] syntax
  const nameMatch = node.name.match(/^(\w+)(?:\[.+\])?$/);
  if (nameMatch) {
    return nameMatch[1].toLowerCase();
  }

  return node.name.toLowerCase();
}

// resolve directive name to admonition config (handles aliases)
function resolveAdmonitionType(name: string): CalloutStyleConfig | undefined {
  // direct match
  if (name in ADMONITION_TYPES) {
    return ADMONITION_TYPES[name];
  }

  // alias match
  const canonical = ADMONITION_ALIASES[name];
  if (canonical) {
    return ADMONITION_TYPES[canonical];
  }

  return undefined;
}

// create AST node for admonition using shared createNode() pattern
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

  return createNode({
    type: 'admonition',
    hName: 'div',
    className: [PREVIEW_ADMONITION, config.className],
    additionalProps: { 'data-admonition-type': config.label.toLowerCase() },
    children: [
      createNode({
        type: 'admonitionHeader',
        hName: 'div',
        className: PREVIEW_ADMONITION_HEADER,
        children: [
          {
            type: 'html',
            value: `<span class="${PREVIEW_ADMONITION_ICON}">${config.icon}</span>`,
          },
          { type: 'text', value: title },
        ],
      }),
      createNode({
        type: 'admonitionContent',
        hName: 'div',
        className: PREVIEW_ADMONITION_CONTENT,
        children: contentChildren as RootContent[],
      }),
    ],
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
