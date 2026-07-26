// src/compiler/safe/compile.ts
// safe MDX parser w/ AST transformation only (no code execution)

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMdx from 'remark-mdx'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root, Parent, RootContent } from 'mdast'
import { extractFrontmatter } from '../pipeline/common/mdx-common'
import { resolveDocumentFormat } from '../internal/format'
import {
  getSafeRemarkPlugins,
  getSafeRehypePluginSets,
} from '../plugins/builder'
import {
  warnIgnoredSafeModeConfig,
  warnMarkdownModeIgnoredConfig,
} from '../pipeline/common/pipeline-warnings'
import remarkGenericComponents from '../pipeline/remark/generic-components'
import { isGenericComponent } from '../../components/internal/component-identity-queries'
import { escapeHtml } from '../pipeline/transforms/utils'
import { getLogger } from '../internal/logging'

import type {
  CompilerConfig,
  UnknownBehavior,
  SafeHTMLResult,
  MdxJsxElement,
  MdxJsxAttribute,
} from '../types'
import {
  EXPRESSION_PLACEHOLDER,
  JSX_PLACEHOLDER,
  UNKNOWN_COMPONENT_PLACEHOLDER,
  UNKNOWN_COMPONENT_EMPTY,
  UNKNOWN_COMPONENT_HEADER,
  UNKNOWN_ICON,
  UNKNOWN_HINT,
  UNKNOWN_COMPONENT_CONTENT,
} from '../internal/css-classes'

// regex to detect lowercase-initial element names (HTML intrinsic elements)
const LOWERCASE_START = /^[a-z]/

// check if a JSX element name is a standard HTML intrinsic element
// (lowercase first char, no dots — matches JSX/React convention)
function isHtmlElement(name: string | null): boolean
{
  if (!name)
  {
    return false
  }
  return LOWERCASE_START.test(name) && !name.includes('.')
}

// convert static MDX JSX attributes to hast hProperties
// string literals & boolean shorthand only; expressions stay skipped in Safe Mode
function toHProperties(node: MdxJsxElement): Record<string, unknown>
{
  const props: Record<string, unknown> = {}
  for (const attr of node.attributes as MdxJsxAttribute[])
  {
    if (attr.type !== 'mdxJsxAttribute')
    {
      continue
    }
    // boolean shorthand: <div hidden />
    if (attr.value === null)
    {
      props[attr.name] = true
      continue
    }
    if (typeof attr.value === 'string')
    {
      props[attr.name] = attr.value
    }
  }
  return props
}

// convert an intrinsic JSX element to a structural mdast node w/ hast metadata
// children stay real mdast nodes so Markdown semantics survive to the HTML sink
function toIntrinsicElementNode(node: MdxJsxElement): RootContent
{
  return {
    type: 'safeHtmlElement',
    data: {
      hName: node.name || 'div',
      hProperties: toHProperties(node),
    },
    children: node.children ?? [],
  } as unknown as RootContent
}

// block-level intrinsic tags that must not stay nested inside a paragraph
// (the raw-HTML parser would split the <p> & leave empty paragraph artifacts)
const BLOCK_LEVEL_INTRINSICS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'dialog',
  'div',
  'dl',
  'fieldset',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])

// unwrap a paragraph wrapping exactly one block-level intrinsic JSX element
// (plus whitespace); returns the structural replacement or null
function unwrapBlockJsxParagraph(paragraph: Parent): RootContent | null
{
  let jsxNode: MdxJsxElement | null = null
  for (const child of paragraph.children)
  {
    if (child.type === 'mdxJsxTextElement')
    {
      const candidate = child as unknown as MdxJsxElement
      if (
        jsxNode ||
        !isHtmlElement(candidate.name) ||
        !BLOCK_LEVEL_INTRINSICS.has(candidate.name ?? '')
      )
      {
        return null
      }
      jsxNode = candidate
      continue
    }
    if (
      child.type === 'text' &&
      typeof (child as { value?: unknown }).value === 'string' &&
      !(child as { value: string }).value.trim()
    )
    {
      continue
    }
    return null
  }
  return jsxNode ? toIntrinsicElementNode(jsxNode) : null
}

// options for remarkStripMdx plugin
interface RemarkStripMdxOptions
{
  unknownBehavior?: UnknownBehavior
  builtinsEnabled?: boolean
  componentNameResolver?: (name: string) => string | undefined
}

// remark plugin to strip MDX-specific nodes (replaces JSX elements & expressions based on behavior)
function remarkStripMdx(options: RemarkStripMdxOptions = {})
{
  const {
    unknownBehavior = 'placeholder',
    builtinsEnabled = true,
    componentNameResolver,
  } = options

  return (tree: Root) =>
  {
    const nodesToRemove = new Map<Parent, Set<object>>()

    const markForRemoval = (parent: Parent, node: object): void =>
    {
      const removals = nodesToRemove.get(parent)
      if (removals)
      {
        removals.add(node)
      }
      else
      {
        nodesToRemove.set(parent, new Set([node]))
      }
    }

    visit(tree, (node, index, parent) =>
    {
      if (index === undefined || parent === undefined)
      {
        return
      }

      // remove import/export declarations (mdxjsEsm nodes)
      if (node.type === 'mdxjsEsm')
      {
        markForRemoval(parent as Parent, node)
        return
      }

      // unwrap paragraphs that only wrap a block-level intrinsic JSX element
      if (node.type === 'paragraph')
      {
        const replacement = unwrapBlockJsxParagraph(node as Parent)
        if (replacement)
        {
          ;(parent as Parent).children[index] = replacement
        }
        return
      }

      // handle JSX elements (both block-level & inline components)
      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      )
      {
        const jsxNode = node as unknown as MdxJsxElement
        const name = jsxNode.name || 'Component'
        const isFlow = node.type === 'mdxJsxFlowElement'

        // pass through standard HTML elements structurally (children stay AST)
        if (isHtmlElement(jsxNode.name))
        {
          ;(parent as Parent).children[index] = toIntrinsicElementNode(jsxNode)
          return
        }

        const isKnownComponent = builtinsEnabled && isGenericComponent(name)
        const resolvedName = componentNameResolver?.(name) ?? name

        const replacement = createJsxReplacement(
          jsxNode,
          resolvedName,
          unknownBehavior,
          isKnownComponent,
          isFlow
        )

        if (replacement === null)
        {
          markForRemoval(parent as Parent, node)
        }
        else if (Array.isArray(replacement))
        {
          ;(parent as Parent).children.splice(index, 1, ...replacement)
        }
        else
        {
          ;(parent as Parent).children[index] = replacement
        }
        return
      }

      // replace expressions {expression} w/ placeholder (flow gets paragraph wrapper)
      if (
        node.type === 'mdxFlowExpression' ||
        node.type === 'mdxTextExpression'
      )
      {
        const htmlNode: RootContent = {
          type: 'html',
          value: `<span class="${EXPRESSION_PLACEHOLDER}" title="JavaScript expression (requires Trusted Mode)">{...}</span>`,
        } as RootContent
        ;(parent as Parent).children[index] =
          node.type === 'mdxFlowExpression'
            ? ({ type: 'paragraph', children: [htmlNode] } as RootContent)
            : htmlNode
        return
      }
    })

    // compact each affected sibling list once
    for (const [parent, removals] of nodesToRemove)
    {
      parent.children = parent.children.filter((child) => !removals.has(child))
    }
  }
}

// create block-level placeholder for unknown JSX flow element
function createFlowPlaceholder(
  node: MdxJsxElement,
  escapedName: string,
  hint: string
): RootContent
{
  const hasChildren = node.children && node.children.length > 0

  if (hasChildren)
  {
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
    } as RootContent
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
  }
}

// create inline placeholder for unknown JSX text element
function createInlinePlaceholder(
  node: MdxJsxElement,
  escapedName: string,
  hint: string
): RootContent | RootContent[]
{
  const placeholder = {
    type: 'html',
    value: `<span class="${JSX_PLACEHOLDER}" title="JSX component ${hint}">&lt;${escapedName} /&gt;</span>`,
  } as RootContent

  if (!node.children || node.children.length === 0)
  {
    return placeholder
  }

  return [
    placeholder,
    {
      type: 'unknownComponentContent' as RootContent['type'],
      data: {
        hName: 'span',
        hProperties: {
          className: [UNKNOWN_COMPONENT_CONTENT],
        },
      },
      children: node.children,
    } as RootContent,
  ]
}

// create replacement for JSX element based on unknownBehavior
function createJsxReplacement(
  node: MdxJsxElement,
  name: string,
  behavior: UnknownBehavior,
  isKnownComponent: boolean,
  isFlowElement: boolean
): RootContent | RootContent[] | null
{
  const escapedName = escapeHtml(name)

  switch (behavior)
  {
    case 'strip':
      return null

    case 'raw':
      if (node.children && node.children.length > 0)
      {
        return node.children as unknown as RootContent[]
      }
      return null

    case 'placeholder':
    default:
    {
      const hint = isKnownComponent
        ? '(builtin component - transform failed)'
        : '(unknown component)'

      return isFlowElement
        ? createFlowPlaceholder(node, escapedName, hint)
        : createInlinePlaceholder(node, escapedName, hint)
    }
  }
}

// compile MDX to safe static HTML (strip frontmatter, parse AST, remove dangerous nodes, & convert to HTML)
export async function compileSafe(
  mdxText: string,
  config: CompilerConfig
): Promise<SafeHTMLResult>
{
  const log = getLogger(config.logger)

  // warn if custom plugins are configured but will be ignored in Safe Mode
  if (config.configFile)
  {
    warnIgnoredSafeModeConfig(config.configFile.config, log)
  }
  // extract frontmatter before compilation
  const { content, frontmatter, bodyStartLine } = extractFrontmatter(mdxText)

  // get configuration for builtins & unknown behavior settings
  const builtinsEnabled = config.componentsBuiltins ?? true
  const unknownBehavior: UnknownBehavior =
    config.componentsUnknownBehavior ?? 'placeholder'

  // get rehype plugin sets from plugin-builder
  const { fenceMeta, raw, preMath, math, postMath } = getSafeRehypePluginSets(
    config.diagramBehavior
  )

  // build unified pipeline w/ shared plugins via plugin-builder
  const remarkPlugins = getSafeRemarkPlugins()

  // .md compiles as lenient CommonMark (no remark-mdx); .mdx parses JSX/ESM
  const isMdx = resolveDocumentFormat(config) === 'mdx'

  // for plain markdown (.md) the MDX unknown-component handling is inert, so a
  // host relying on it for containment isn't silently left unprotected; pass the
  // effective behavior (placeholder by default) so the default case still warns
  if (!isMdx)
  {
    warnMarkdownModeIgnoredConfig(
      {
        componentsUnknownBehavior:
          config.componentsUnknownBehavior ?? 'placeholder',
        componentNameResolver: config.componentNameResolver,
      },
      log
    )
  }

  // stage 1: parse markdown/MDX & apply remark plugins
  // remark-mdx is only added for MDX so plain markdown (e.g. `<1`) stays literal
  const baseProcessor = unified().use(remarkParse)
  if (isMdx)
  {
    baseProcessor.use(remarkMdx)
  }
  baseProcessor
    // transform known generic components to semantic HTML (before stripping)
    .use(remarkGenericComponents, { enabled: builtinsEnabled })
    // strip unknown JSX elements based on configured behavior (no-op for md)
    .use(remarkStripMdx, {
      unknownBehavior,
      builtinsEnabled,
      componentNameResolver: config.componentNameResolver,
    })
    .use(remarkPlugins)

  // stage 2: convert to rehype & apply rehype plugins
  // rehype-raw parses raw HTML nodes into proper HAST elements
  const rehypeProcessor = baseProcessor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use([fenceMeta, raw, ...preMath, math, ...postMath])

  // stage 3: stringify to HTML
  const processor = rehypeProcessor.use(rehypeStringify, {
    allowDangerousHtml: true,
  })

  const result = await processor.process({
    value: content,
    data: { sourceLineOffset: bodyStartLine - 1 },
  })

  return {
    html: String(result),
    frontmatter: frontmatter as Record<string, unknown>,
  }
}
