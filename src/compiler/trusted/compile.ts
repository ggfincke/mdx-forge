// src/compiler/trusted/compile.ts
// MDX transpilation w/ layout injection & React root wrapping for Trusted Mode

import { compile } from '@mdx-js/mdx';
import hasDefaultExport from './hasDefaultExport';

import { extractFrontmatter } from '../pipeline/common/mdx-common';
import { buildTrustedPluginPipeline } from '../plugins/builder';
import { loadPluginsFromConfig } from '../plugins/loader';
import { generateComponentImports } from './component-mapper';
import { getLogger } from '../internal/logging';
import { getDocumentDir, toImportSpecifierLiteral } from '../internal/path';
import { resolveDocumentFormat } from '../internal/format';
import { warnMarkdownModeIgnoredConfig } from '../pipeline/common/pipeline-warnings';

import type { CompilerConfig, MdxTranspileResult } from '../types';

// strip MDX 3's module-level default export so the content component can be
// re-wrapped; anchor to line start so prose/string literals are untouched
const stripDefaultMdxExport = (compiledMDX: string): string =>
  compiledMDX
    .replace(/^export default function MDXContent/m, 'function MDXContent')
    .replace(/^export default MDXContent;?$/m, '');

// resolved layout source shared by the mdx-source & compiled-js wrap paths
// custom: an import specifier literal; host: the createLayout options string
type LayoutResolution =
  | { kind: 'custom'; specifier: string }
  | { kind: 'host'; options: string }
  | null;

// resolve which layout applies from config (custom file vs host styles)
// centralizes the customLayoutFilePath try/catch/warn & useHostMarkdownStyles
// branching; callers format their own output (source prepend vs js import/expr)
const resolveLayout = (
  config: CompilerConfig,
  onResolveError: (err: unknown) => void
): LayoutResolution => {
  const { customLayoutFilePath, useHostMarkdownStyles, useWhiteBackground } =
    config;

  if (customLayoutFilePath) {
    try {
      const dir = getDocumentDir(config);
      const specifier = toImportSpecifierLiteral(customLayoutFilePath, dir);
      return { kind: 'custom', specifier };
    } catch (err) {
      onResolveError(err);
      return null;
    }
  }
  if (useHostMarkdownStyles) {
    const options = useWhiteBackground ? '{ forceLightTheme: true }' : '{}';
    return { kind: 'host', options };
  }
  return null;
};

// inject MDX layout styles based on configuration
const injectMDXStyles = (mdxText: string, config: CompilerConfig): string => {
  const log = getLogger(config.logger);
  const layout = resolveLayout(config, (err) =>
    log.warn(
      `Failed to load custom layout from ${config.customLayoutFilePath}: ${err}`
    )
  );

  if (!layout) {
    return mdxText;
  }

  if (layout.kind === 'custom') {
    return `import Layout from ${layout.specifier};

export default Layout;

${mdxText}`;
  }
  return `import { createLayout } from 'vscode-markdown-layout';

export default createLayout(${layout.options});

${mdxText}`;
};

// wrap compiled MDX output (webview owns React root & handles rendering, wrap w/ MDXProvider if components provided)
const wrapCompiledMdx = (
  compiledMDX: string,
  componentsObject?: string
): string => {
  if (componentsObject && componentsObject !== '{}') {
    // remove original "export default" to avoid duplicate exports (MDX 3 output)
    const strippedMDX = stripDefaultMdxExport(compiledMDX);

    // wrap w/ MDXProvider to make custom components available as shortcodes
    return `
// MDX 3 compiled output w/ custom components
import React from 'react';
import { MDXProvider } from '@mdx-js/react';
${strippedMDX}

const _MDXComponents = ${componentsObject};
const _OriginalDefault = MDXContent;
export default function MDXContentWithComponents(props) {
  return React.createElement(MDXProvider, { components: _MDXComponents },
    React.createElement(_OriginalDefault, props)
  );
}
`;
  }
  return `
// MDX 3 compiled output
import React from 'react';
${compiledMDX}
`;
};

// resolve the layout import statement & expression for markdown wrapping
// mirrors injectMDXStyles, but emitted at the compiled-JS level (markdown
// source cannot carry the ESM that injectMDXStyles relies on)
const resolveMarkdownLayout = (
  config: CompilerConfig
): { layoutImport: string; layoutExpr: string } | null => {
  const log = getLogger(config.logger);
  const layout = resolveLayout(config, (err) =>
    log.warn(
      `Failed to resolve custom layout ${config.customLayoutFilePath}: ${err}`
    )
  );

  if (!layout) {
    return null;
  }

  if (layout.kind === 'custom') {
    return {
      layoutImport: `import _MDXLayoutComponent from ${layout.specifier};`,
      layoutExpr: '_MDXLayoutComponent',
    };
  }
  return {
    layoutImport: `import { createLayout } from 'vscode-markdown-layout';`,
    layoutExpr: `createLayout(${layout.options})`,
  };
};

// wrap compiled markdown output, re-attaching the layout at the JS level
// (markdown is parsed as CommonMark so the layout cannot be injected as source)
const wrapCompiledMd = (
  compiledMDX: string,
  config: CompilerConfig
): string => {
  const layout = resolveMarkdownLayout(config);
  if (!layout) {
    return `
// markdown compiled output (no layout)
import React from 'react';
${compiledMDX}
`;
  }

  // strip the default export so the content component can be wrapped
  const strippedMDX = stripDefaultMdxExport(compiledMDX);

  return `
// markdown compiled output w/ layout
import React from 'react';
${layout.layoutImport}
${strippedMDX}

const _MDXLayout = ${layout.layoutExpr};
const _MDXInner = MDXContent;
export default function MDXContentWithLayout(props) {
  return React.createElement(_MDXLayout, props,
    React.createElement(_MDXInner, props)
  );
}
`;
};

// transpile MDX to JavaScript & inject layout if no default export
export async function compileTrusted(
  mdxText: string,
  _isEntry: boolean,
  config: CompilerConfig
): Promise<MdxTranspileResult> {
  const log = getLogger(config.logger);

  // extract frontmatter before compilation
  const { content, frontmatter } = extractFrontmatter(mdxText);

  // .md compiles as lenient CommonMark; .mdx parses JSX/ESM
  // markdown mode cannot use ESM, so layout & component injection are mdx-only
  const documentFormat = resolveDocumentFormat(config);
  const isMdx = documentFormat === 'mdx';

  // plain markdown (.md) can't carry JSX components or ESM imports, so the
  // configured component map & builtin shims do not apply; warn if any are set
  if (!isMdx) {
    warnMarkdownModeIgnoredConfig(
      {
        components: config.configFile?.config?.components,
        builtinComponents: config.componentsBuiltins ?? true,
      },
      log
    );
  }

  let mdxTextToCompile: string;
  if (isMdx && !hasDefaultExport(content)) {
    mdxTextToCompile = injectMDXStyles(content, config);
  } else {
    mdxTextToCompile = content;
  }

  // load custom plugins from config
  const customPlugins = await loadPluginsFromConfig(
    config.configFile ?? undefined,
    config
  );

  // log aggregated plugin loading errors (individual errors logged via ErrorReporter)
  if (customPlugins.errorCount > 0) {
    log.warn(
      `Failed to load ${customPlugins.errorCount} custom plugin(s). Check console for details.`
    );
  }

  // generate component imports from config & built-in shims (mdx only)
  // plain markdown has no JSX components & cannot carry ESM imports
  const documentDir = getDocumentDir(config);
  const builtinsEnabled = config.componentsBuiltins ?? true;

  log.debug(
    `mdxPreviewConfig: ${config.configFile ? JSON.stringify(config.configFile.config) : 'undefined'}`
  );
  log.debug(`documentDir: ${documentDir}`);
  log.debug(`builtinsEnabled: ${builtinsEnabled}`);
  log.debug(`documentFormat: ${documentFormat}`);

  const componentImports = isMdx
    ? generateComponentImports(
        config.configFile ?? undefined,
        documentDir,
        config,
        {
          builtinsEnabled,
        }
      )
    : { hasComponents: false, imports: '', componentsObject: '{}' };

  log.debug(
    `componentImports.hasComponents: ${componentImports.hasComponents}`
  );

  // prepend component imports to MDX source (before compilation)
  if (componentImports.hasComponents) {
    log.debug('Prepending component imports to MDX source');
    mdxTextToCompile = componentImports.imports + '\n\n' + mdxTextToCompile;
  }

  // build plugin pipeline (merges built-in & custom plugins)
  const { remarkPlugins, rehypePlugins } = buildTrustedPluginPipeline(
    customPlugins,
    config.diagramBehavior
  );

  const compiled = await compile(mdxTextToCompile, {
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
  });

  // markdown re-attaches the layout at the JS level; mdx wraps as before
  const code = isMdx
    ? wrapCompiledMdx(
        compiled.toString(),
        componentImports.hasComponents
          ? componentImports.componentsObject
          : undefined
      )
    : wrapCompiledMd(compiled.toString(), config);

  return {
    code,
    frontmatter: frontmatter as Record<string, unknown>,
  };
}
