// src/compiler/trusted/compile.ts
// trusted mdx transpilation w/ post-compile layout wrapping

import { compile } from '@mdx-js/mdx'
import remarkDetectDefaultExport from './hasDefaultExport'

import { extractFrontmatter } from '../pipeline/common/mdx-common'
import { buildTrustedPluginPipeline } from '../plugins/builder'
import { loadPluginsFromConfig } from '../plugins/loader'
import { generateComponentImports } from './component-mapper'
import { createUniqueIdentifier } from './identifier'
import { getLogger } from '../internal/logging'
import { getDocumentDir, toImportSpecifierLiteral } from '../internal/path'
import { resolveDocumentFormat } from '../internal/format'
import { warnMarkdownModeIgnoredConfig } from '../pipeline/common/pipeline-warnings'

import type { CompilerConfig, MdxTranspileResult } from '../types'
import type { Pluggable } from 'unified'

type LayoutResolution =
  | { kind: 'custom'; specifier: string }
  | { kind: 'host'; options: string }
  | null

interface CompiledLayout
{
  layoutImport: string
  layoutExpr: string
}

// strip MDX 3's module-level default export so the content component can be
// re-wrapped; anchor to line start so prose/string literals are untouched
const stripDefaultMdxExport = (compiledMDX: string): string =>
  compiledMDX
    .replace(/^export default function MDXContent/m, 'function MDXContent')
    .replace(/^export default MDXContent;?$/m, '')

// derive offsets from the exact prefix so generated import counts can vary
const prependMdxSource = (mdxText: string, prefix: string) => ({
  mdxText: prefix + mdxText,
  prependedLineCount: prefix.split('\n').length - 1,
})

// resolve which layout applies from config (custom file vs host styles)
// centralizes the customLayoutFilePath try/catch/warn & useHostMarkdownStyles
// branching; callers format their own compiled-JS import & expression
const resolveLayout = (
  config: CompilerConfig,
  onResolveError: (err: unknown) => void
): LayoutResolution =>
{
  const { customLayoutFilePath, useHostMarkdownStyles, useWhiteBackground } =
    config

  if (customLayoutFilePath)
  {
    try
    {
      const dir = getDocumentDir(config)
      const specifier = toImportSpecifierLiteral(customLayoutFilePath, dir)
      return { kind: 'custom', specifier }
    }
    catch (err)
    {
      onResolveError(err)
      return null
    }
  }
  if (useHostMarkdownStyles)
  {
    const options = useWhiteBackground ? '{ forceLightTheme: true }' : '{}'
    return { kind: 'host', options }
  }
  return null
}

// bind a configured MDX layout against canonical compiled identifiers
const createCompiledLayout = (
  layout: Exclude<LayoutResolution, null>,
  source: string
): CompiledLayout =>
{
  const base = layout.kind === 'custom' ? 'Layout' : 'createLayout'
  const identifier = createUniqueIdentifier(source, base)
  if (layout.kind === 'custom')
  {
    return {
      layoutImport: `import ${identifier} from ${layout.specifier};`,
      layoutExpr: identifier,
    }
  }
  return {
    layoutImport:
      identifier === 'createLayout'
        ? `import { createLayout } from 'vscode-markdown-layout';`
        : `import { createLayout as ${identifier} } from 'vscode-markdown-layout';`,
    layoutExpr: `${identifier}(${layout.options})`,
  }
}

// wrap compiled MDX w/ provider outermost & configured layout inside it
const wrapCompiledMdx = (
  compiledMDX: string,
  componentsObject: string | undefined,
  layout: Exclude<LayoutResolution, null> | null
): string =>
{
  const hasComponents = Boolean(componentsObject && componentsObject !== '{}')
  if (!hasComponents && !layout)
  {
    // automatic JSX runtime output needs no classic React import
    return `
// MDX 3 compiled output
${compiledMDX}
`
  }

  // remove original "export default" to avoid duplicate exports
  const strippedMDX = stripDefaultMdxExport(compiledMDX)
  const initialScanSource = strippedMDX + (componentsObject ?? '')
  const compiledLayout = layout
    ? createCompiledLayout(layout, initialScanSource)
    : null
  const scanSource =
    initialScanSource +
    (compiledLayout
      ? compiledLayout.layoutImport + compiledLayout.layoutExpr
      : '')
  const reactVar = createUniqueIdentifier(scanSource, 'React')

  if (hasComponents)
  {
    const providerVar = createUniqueIdentifier(scanSource, 'MDXProvider')
    const componentsVar = createUniqueIdentifier(scanSource, '_MDXComponents')
    const wrapperVar = createUniqueIdentifier(
      scanSource,
      'MDXContentWithComponents'
    )
    if (compiledLayout)
    {
      const layoutVar = createUniqueIdentifier(scanSource, '_MDXLayout')

      return `
// MDX 3 compiled output w/ custom components & layout
import ${reactVar} from 'react';
import { MDXProvider as ${providerVar} } from '@mdx-js/react';
${compiledLayout.layoutImport}
${strippedMDX}

const ${componentsVar} = ${componentsObject};
const ${layoutVar} = ${compiledLayout.layoutExpr};
export default function ${wrapperVar}(props) {
  return ${reactVar}.createElement(${providerVar}, { components: ${componentsVar} },
    ${reactVar}.createElement(${layoutVar}, props,
      ${reactVar}.createElement(_createMdxContent, props)
    )
  );
}
`
    }

    const originalVar = createUniqueIdentifier(scanSource, '_OriginalDefault')

    // wrap w/ MDXProvider to make custom components available as shortcodes
    return `
// MDX 3 compiled output w/ custom components
import ${reactVar} from 'react';
import { MDXProvider as ${providerVar} } from '@mdx-js/react';
${strippedMDX}

const ${componentsVar} = ${componentsObject};
const ${originalVar} = MDXContent;
export default function ${wrapperVar}(props) {
  return ${reactVar}.createElement(${providerVar}, { components: ${componentsVar} },
    ${reactVar}.createElement(${originalVar}, props)
  );
}
`
  }

  const resolvedLayout = compiledLayout as CompiledLayout
  const layoutVar = createUniqueIdentifier(scanSource, '_MDXLayout')
  const wrapperVar = createUniqueIdentifier(scanSource, 'MDXContentWithLayout')

  return `
// MDX 3 compiled output w/ layout
import ${reactVar} from 'react';
${resolvedLayout.layoutImport}
${strippedMDX}

const ${layoutVar} = ${resolvedLayout.layoutExpr};
export default function ${wrapperVar}(props) {
  return ${reactVar}.createElement(${layoutVar}, props,
    ${reactVar}.createElement(_createMdxContent, props)
  );
}
`
}

// resolve the layout import statement & expression for markdown wrapping
// mirrors injectMDXStyles, but emitted at the compiled-JS level (markdown
// source cannot carry the ESM that injectMDXStyles relies on)
const resolveMarkdownLayout = (
  config: CompilerConfig
): { layoutImport: string; layoutExpr: string } | null =>
{
  const log = getLogger(config.logger)
  const layout = resolveLayout(config, (err) =>
    log.warn(
      `Failed to resolve custom layout ${config.customLayoutFilePath}: ${err}`
    )
  )

  if (!layout)
  {
    return null
  }

  if (layout.kind === 'custom')
  {
    return {
      layoutImport: `import _MDXLayoutComponent from ${layout.specifier};`,
      layoutExpr: '_MDXLayoutComponent',
    }
  }
  return {
    layoutImport: `import { createLayout } from 'vscode-markdown-layout';`,
    layoutExpr: `createLayout(${layout.options})`,
  }
}

// wrap compiled markdown output, re-attaching the layout at the JS level
// (markdown is parsed as CommonMark so the layout cannot be injected as source)
const wrapCompiledMd = (
  compiledMDX: string,
  config: CompilerConfig
): string =>
{
  const layout = resolveMarkdownLayout(config)
  if (!layout)
  {
    // automatic JSX runtime output needs no classic React import
    return `
// markdown compiled output (no layout)
${compiledMDX}
`
  }

  // strip the default export so the content component can be wrapped
  const strippedMDX = stripDefaultMdxExport(compiledMDX)

  // markdown carries no authored ESM, but keep bindings hygienic anyway
  const scanSource = strippedMDX + layout.layoutImport + layout.layoutExpr
  const reactVar = createUniqueIdentifier(scanSource, 'React')
  const layoutVar = createUniqueIdentifier(scanSource, '_MDXLayout')
  const innerVar = createUniqueIdentifier(scanSource, '_MDXInner')
  const wrapperVar = createUniqueIdentifier(scanSource, 'MDXContentWithLayout')

  return `
// markdown compiled output w/ layout
import ${reactVar} from 'react';
${layout.layoutImport}
${strippedMDX}

const ${layoutVar} = ${layout.layoutExpr};
const ${innerVar} = MDXContent;
export default function ${wrapperVar}(props) {
  return ${reactVar}.createElement(${layoutVar}, props,
    ${reactVar}.createElement(${innerVar}, props)
  );
}
`
}

// transpile MDX to JavaScript & wrap configured layouts after compilation
export async function compileTrusted(
  mdxText: string,
  _isEntry: boolean,
  config: CompilerConfig
): Promise<MdxTranspileResult>
{
  const log = getLogger(config.logger)

  // extract frontmatter before compilation
  const { content, frontmatter, bodyStartLine } = extractFrontmatter(mdxText)

  // .md compiles as lenient CommonMark; .mdx parses JSX/ESM
  // markdown mode cannot use ESM, so layout & component injection are mdx-only
  const documentFormat = resolveDocumentFormat(config)
  const isMdx = documentFormat === 'mdx'

  // plain markdown (.md) can't carry JSX components or ESM imports, so the
  // configured component map & builtin shims do not apply; warn if any are set
  if (!isMdx)
  {
    warnMarkdownModeIgnoredConfig(
      {
        components: config.configFile?.config?.components,
        builtinComponents: config.componentsBuiltins ?? true,
      },
      log
    )
  }

  let mdxTextToCompile = content
  let sourceLineOffset = bodyStartLine - 1

  // load custom plugins from config
  const customPlugins = await loadPluginsFromConfig(
    config.configFile ?? undefined,
    config
  )

  // log aggregated plugin loading errors (individual errors logged via ErrorReporter)
  if (customPlugins.errorCount > 0)
  {
    log.warn(
      `Failed to load ${customPlugins.errorCount} custom plugin(s). Check console for details.`
    )
  }

  // generate component imports from config & built-in shims (mdx only)
  // plain markdown has no JSX components & cannot carry ESM imports
  const documentDir = getDocumentDir(config)
  const builtinsEnabled = config.componentsBuiltins ?? true

  log.debug(
    `mdxPreviewConfig: ${config.configFile ? JSON.stringify(config.configFile.config) : 'undefined'}`
  )
  log.debug(`documentDir: ${documentDir}`)
  log.debug(`builtinsEnabled: ${builtinsEnabled}`)
  log.debug(`documentFormat: ${documentFormat}`)

  const componentImports = isMdx
    ? generateComponentImports(
        config.configFile ?? undefined,
        documentDir,
        config,
        {
          builtinsEnabled,
        }
      )
    : { hasComponents: false, imports: '', componentsObject: '{}' }

  log.debug(`componentImports.hasComponents: ${componentImports.hasComponents}`)

  // prepend component imports to MDX source (before compilation)
  if (componentImports.hasComponents)
  {
    log.debug('Prepending component imports to MDX source')
    const componentPrefix = componentImports.imports + '\n\n'
    const componentInjection = prependMdxSource(
      mdxTextToCompile,
      componentPrefix
    )
    mdxTextToCompile = componentInjection.mdxText
    sourceLineOffset -= componentInjection.prependedLineCount
  }

  // build plugin pipeline (merges built-in & custom plugins)
  const { remarkPlugins, rehypePlugins } = buildTrustedPluginPipeline(
    customPlugins,
    config.diagramBehavior
  )
  if (isMdx)
  {
    remarkPlugins.unshift(remarkDetectDefaultExport as Pluggable)
  }

  const compiled = await compile(
    {
      value: mdxTextToCompile,
      data: { sourceLineOffset },
    },
    {
      // lenient CommonMark for .md, strict MDX for .mdx
      format: documentFormat,
      outputFormat: 'program',
      development: false,
      jsx: false,
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      // enable MDXProvider context reading (MDX will call useMDXComponents() to get components)
      providerImportSource: '@mdx-js/react',
      // remark plugins: GFM, GitHub alerts, math (shared w/ Safe Mode) & custom
      remarkPlugins,
      // rehype plugins: raw HTML, diagram placeholders, math, syntax, anchors, lazy images & custom
      rehypePlugins,
    }
  )

  // authored MDX defaults retain sole layout ownership
  const mdxLayout =
    isMdx && compiled.data.hasAuthoredDefaultExport !== true
      ? resolveLayout(config, (err) =>
          log.warn(
            `Failed to load custom layout from ${config.customLayoutFilePath}: ${err}`
          )
        )
      : null

  // both formats attach configured layouts after canonical JS generation
  const code = isMdx
    ? wrapCompiledMdx(
        compiled.toString(),
        componentImports.hasComponents
          ? componentImports.componentsObject
          : undefined,
        mdxLayout
      )
    : wrapCompiledMd(compiled.toString(), config)

  return {
    code,
    frontmatter: frontmatter as Record<string, unknown>,
  }
}
