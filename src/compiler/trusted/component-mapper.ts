// src/compiler/trusted/component-mapper.ts
// component name mapping for trusted compilation

import { getAllGenericComponentNames } from '../../components/internal/component-identity-queries'
import { getLogger } from '../internal/logging'
import { toAbsolutePath, toRelativeImportPath } from '../internal/path'
import { requireTrustedMode } from '../internal/trust'
import type { CompilerConfig, ResolvedConfig } from '../types'
import {
  createIgnoredComponentsWarning,
  emitWarning,
} from '../pipeline/common/pipeline-warnings'

interface ComponentImport
{
  componentName: string
  identifierBase: string
  source: string
}

// validated imports awaiting authored binding allocation
export interface ComponentImportsResult
{
  // import descriptors inserted by the early remark transform
  imports: ComponentImport[]
  // component object literal for MDX provider
  componentsObject: string
  // has components
  hasComponents: boolean
}

// options for component import generation
export interface ComponentImportsOptions
{
  // auto-inject shims
  builtinsEnabled?: boolean
}

// built-in generic component names derived from shared component registry
const BUILTIN_GENERIC_COMPONENTS = getAllGenericComponentNames()

// supported component keys: plain JS identifiers usable as MDX shortcodes
const VALID_COMPONENT_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/

// validate & resolve component import descriptors in Trusted Mode
export function generateComponentImports(
  config: ResolvedConfig | undefined,
  documentDir: string,
  compilerConfig: CompilerConfig,
  options: ComponentImportsOptions = {}
): ComponentImportsResult
{
  const log = getLogger(compilerConfig.logger)
  const { builtinsEnabled = true } = options

  log.debug(
    `Called with config: ${config ? JSON.stringify(config.config) : 'undefined'}`
  )
  log.debug(`documentDir: ${documentDir}`)
  log.debug(`builtinsEnabled: ${builtinsEnabled}`)

  const result: ComponentImportsResult = {
    imports: [],
    componentsObject: '{}',
    hasComponents: false,
  }

  // require Trusted Mode for component imports
  const canExecute = requireTrustedMode(
    compilerConfig,
    'generate component imports',
    () =>
    {
      const components = config?.config.components
      if (components && Object.keys(components).length > 0)
      {
        emitWarning(
          createIgnoredComponentsWarning(Object.keys(components)),
          log
        )
      }
    }
  )
  if (!canExecute)
  {
    return result
  }

  const imports: ComponentImport[] = []

  // track which component names are defined by user config (these take precedence)
  const userDefinedComponents = new Set<string>()

  // process user-defined components from config first
  const components = config?.config.components
  if (components && Object.keys(components).length > 0)
  {
    // reject unsupported keys before compilation so codegen stays hygienic
    const invalidNames = Object.keys(components).filter(
      (name) => !VALID_COMPONENT_KEY.test(name)
    )
    if (invalidNames.length > 0)
    {
      throw new Error(
        `Unsupported component name(s) in config: ${invalidNames.join(', ')}. ` +
          'Component names must be valid JavaScript identifiers ' +
          '(letters, digits, _ or $, not starting w/ a digit).'
      )
    }

    const configDir = config.configDir

    for (const [componentName, componentPath] of Object.entries(components))
    {
      userDefinedComponents.add(componentName)

      // resolve component path relative to config directory
      const absolutePath = toAbsolutePath(componentPath, configDir)

      // convert to relative import path from document directory
      const relativePath = toRelativeImportPath(absolutePath, documentDir)

      imports.push({
        componentName,
        identifierBase: `_component_${componentName}`,
        source: relativePath,
      })
    }
  }

  // add built-in generic shims (if enabled & not overridden by user config)
  if (builtinsEnabled)
  {
    for (const componentName of BUILTIN_GENERIC_COMPONENTS)
    {
      // skip if user has defined this component in config (user takes precedence)
      if (userDefinedComponents.has(componentName))
      {
        continue
      }

      imports.push({
        componentName,
        identifierBase: `_builtin_${componentName}`,
        source: componentName,
      })
    }
  }

  if (imports.length > 0)
  {
    result.imports = imports
    result.hasComponents = true

    const userCount = userDefinedComponents.size
    const builtinCount = imports.length - userCount

    if (userCount > 0 && builtinCount > 0)
    {
      log.info(
        `Generated imports for ${userCount} custom component(s) & ${builtinCount} built-in shim(s)`
      )
    }
    else if (userCount > 0)
    {
      log.info(`Generated imports for ${userCount} custom component(s)`)
    }
    else if (builtinCount > 0)
    {
      log.debug(`Injected ${builtinCount} built-in generic shim(s)`)
    }
  }
  else
  {
    log.debug('No imports generated')
  }

  return result
}
