// src/compiler/pipeline/remark/github-alerts.ts
// custom remark plugin for GitHub-style blockquote alerts ([!NOTE], [!WARNING], etc.)

import { visit } from 'unist-util-visit'
import type { Root, Blockquote, Paragraph, Text, RootContent } from 'mdast'
import type { Parent } from 'unist'
import { GITHUB_ALERT_ICONS } from '../../../internal/icons'
import { createCalloutCard } from '../transforms/utils'
import {
  type CalloutStyleConfig,
  type CalloutType,
  CALLOUT_TITLES,
} from '../../../internal/callout'
import {
  GITHUB_ALERT,
  GITHUB_ALERT_TITLE,
  GITHUB_ALERT_CONTENT,
} from '../../internal/css-classes'

// alert type configuration
type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION'

// exported for completions
export const GITHUB_ALERT_TYPES: readonly AlertType[] = [
  'NOTE',
  'TIP',
  'IMPORTANT',
  'WARNING',
  'CAUTION',
] as const

// derive each alert config from the shared callout registry
// className/label come from the lowercased type + CALLOUT_TITLES
// the icon keeps the GitHub-specific override
function buildAlertConfig(): Record<AlertType, CalloutStyleConfig>
{
  const map = {} as Record<AlertType, CalloutStyleConfig>
  for (const type of GITHUB_ALERT_TYPES)
  {
    const calloutType = type.toLowerCase() as CalloutType
    map[type] = {
      className: calloutType,
      label: CALLOUT_TITLES[calloutType],
      icon: GITHUB_ALERT_ICONS[type],
    }
  }
  return map
}

const ALERT_CONFIG: Record<AlertType, CalloutStyleConfig> = buildAlertConfig()

// match [!TYPE] at start of first paragraph in blockquote
const ALERT_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i

// remark plugin that transforms GitHub-style blockquote alerts
export default function remarkGithubAlerts()
{
  return (tree: Root) =>
  {
    visit(tree, 'blockquote', (node: Blockquote, index, parent) =>
    {
      if (index === undefined || parent === undefined)
      {
        return
      }

      // check if first child is a paragraph
      const firstChild = node.children[0]
      if (!firstChild || firstChild.type !== 'paragraph')
      {
        return
      }

      // check if paragraph starts w/ [!TYPE]
      const paragraph = firstChild as Paragraph
      const firstTextNode = paragraph.children[0]
      if (!firstTextNode || firstTextNode.type !== 'text')
      {
        return
      }

      const text = firstTextNode as Text
      const match = text.value.match(ALERT_REGEX)
      if (!match)
      {
        return
      }

      const alertType = match[1].toUpperCase() as AlertType
      const config = ALERT_CONFIG[alertType]

      // remove the [!TYPE] prefix from text
      text.value = text.value.replace(ALERT_REGEX, '')

      // if the text is now empty, remove the text node
      if (text.value === '')
      {
        paragraph.children.shift()
      }

      // if paragraph is now empty (only had [!TYPE]), remove it
      if (paragraph.children.length === 0)
      {
        node.children.shift()
      }

      // replace the blockquote w/ a child-preserving alert node
      ;(parent as Parent).children[index] = createAlertNode(config, node)
    })
  }
}

// create an alert wrapper while preserving parsed markdown children
function createAlertNode(
  config: CalloutStyleConfig,
  node: Blockquote
): RootContent
{
  return createCalloutCard({
    outerType: 'githubAlert',
    wrapperTag: 'div',
    outerClassNames: [GITHUB_ALERT, `${GITHUB_ALERT}-${config.className}`],
    additionalProps: { role: 'note' },
    headerType: 'githubAlertTitle',
    headerTag: 'p',
    headerClassName: GITHUB_ALERT_TITLE,
    headerMode: 'combined-html',
    icon: config.icon,
    title: config.label,
    contentType: 'githubAlertContent',
    contentClassName: GITHUB_ALERT_CONTENT,
    contentChildren: node.children as RootContent[],
  })
}
