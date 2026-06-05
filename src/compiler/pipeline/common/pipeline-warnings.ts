// src/compiler/pipeline/common/pipeline-warnings.ts
// consolidated warning codes & messages for MDX pipeline operations

import { getLogger } from '../../internal/logging';
import type { CompilerLogger } from '../../types';
import { PipelineWarningCode } from '../../types/pipeline';
import type { PipelineWarning } from '../../types/pipeline';

// re-export canonical type definitions from types/
export { PipelineWarningCode } from '../../types/pipeline';
export type { PipelineWarning } from '../../types/pipeline';

// create warning for custom plugins being ignored in Safe Mode
export function createIgnoredPluginsWarning(
  remarkCount: number,
  rehypeCount: number
): PipelineWarning {
  const total = remarkCount + rehypeCount;
  const details = [];
  if (remarkCount > 0) {
    details.push(`${remarkCount} remark`);
  }
  if (rehypeCount > 0) {
    details.push(`${rehypeCount} rehype`);
  }

  return {
    code: PipelineWarningCode.CUSTOM_PLUGINS_IGNORED,
    message:
      `Custom plugins from .mdx-previewrc.json are ignored in Safe Mode. ` +
      `${total} plugin(s) (${details.join(', ')}) will not be loaded. ` +
      `Enable Trusted Mode to use custom plugins.`,
    severity: 'warning',
    context: { remarkCount, rehypeCount, total },
  };
}

// create warning for custom components being ignored in Safe Mode
export function createIgnoredComponentsWarning(
  componentNames: string[]
): PipelineWarning {
  const count = componentNames.length;
  const names =
    count <= 3
      ? componentNames.join(', ')
      : `${componentNames.slice(0, 3).join(', ')}...`;

  return {
    code: PipelineWarningCode.CUSTOM_COMPONENTS_IGNORED,
    message:
      `Custom components configured but cannot load in Safe Mode. ` +
      `${count} component(s) (${names}) will be ignored.`,
    severity: 'warning',
    context: { count, componentNames },
  };
}

// create warning for component-containment config not applying to plain markdown
export function createMarkdownConfigIgnoredWarning(
  ignoredSettings: string[]
): PipelineWarning {
  return {
    code: PipelineWarningCode.MARKDOWN_CONFIG_IGNORED,
    message:
      `Document compiles as plain CommonMark (.md), so MDX component handling ` +
      `is not applied: ${ignoredSettings.join(', ')} ignored & raw HTML passes ` +
      `through verbatim. Use format:'mdx' for strict parsing or sanitize downstream.`,
    severity: 'warning',
    context: { ignoredSettings },
  };
}

// emit warning to the logging system
export function emitWarning(
  warning: PipelineWarning,
  logger?: CompilerLogger
): void {
  const log = getLogger(logger);
  const formattedMessage = `[${warning.code}] ${warning.message}`;

  switch (warning.severity) {
    case 'error':
      log.warn(formattedMessage);
      break;
    case 'warning':
      log.warn(formattedMessage);
      break;
    case 'info':
      log.info(formattedMessage);
      break;
  }
}

// emit warning for ignored Safe Mode configuration
export function warnIgnoredSafeModeConfig(
  config: {
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
    components?: Record<string, string>;
  },
  logger?: CompilerLogger
): void {
  const remarkCount = config.remarkPlugins?.length ?? 0;
  const rehypeCount = config.rehypePlugins?.length ?? 0;
  const hasPlugins = remarkCount > 0 || rehypeCount > 0;

  const componentNames = config.components
    ? Object.keys(config.components)
    : [];
  const hasComponents = componentNames.length > 0;

  if (hasPlugins) {
    emitWarning(createIgnoredPluginsWarning(remarkCount, rehypeCount), logger);
  }

  if (hasComponents) {
    emitWarning(createIgnoredComponentsWarning(componentNames), logger);
  }
}

// warn when component handling is active but inert for a plain-markdown (.md)
// document; covers safe-mode unknown handling (incl. the default), the name
// resolver, trusted-mode component maps & builtin shims
export function warnMarkdownModeIgnoredConfig(
  settings: {
    componentsUnknownBehavior?: unknown;
    componentNameResolver?: unknown;
    components?: Record<string, string>;
    builtinComponents?: boolean;
  },
  logger?: CompilerLogger
): void {
  const ignored: string[] = [];
  if (settings.componentsUnknownBehavior !== undefined) {
    ignored.push('componentsUnknownBehavior');
  }
  if (settings.componentNameResolver !== undefined) {
    ignored.push('componentNameResolver');
  }
  if (settings.components && Object.keys(settings.components).length > 0) {
    ignored.push('component mappings');
  }
  if (settings.builtinComponents) {
    ignored.push('builtin component shims');
  }
  if (ignored.length === 0) {
    return;
  }
  emitWarning(createMarkdownConfigIgnoredWarning(ignored), logger);
}
