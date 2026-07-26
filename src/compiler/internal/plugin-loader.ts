// src/compiler/internal/plugin-loader.ts
// dynamic plugin loading via require/import

import * as path from 'path'
import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import type { PluginLoader } from '../types'

const resolverCache = new Map<string, ReturnType<typeof createRequire>>()

function resolvePluginPath(specifier: string, fromDir: string): string
{
  let resolver = resolverCache.get(fromDir)
  if (!resolver)
  {
    resolver = createRequire(path.join(fromDir, '__mdx_forge_resolver__.js'))
    resolverCache.set(fromDir, resolver)
  }
  return resolver.resolve(specifier)
}

async function loadPluginModule(resolvedPath: string): Promise<unknown>
{
  // prefer dynamic import for ESM support; fall back to require for CJS
  try
  {
    return await import(pathToFileURL(resolvedPath).href)
  }
  catch
  {
    // in CJS bundles use native require; otherwise create require
    const req =
      typeof require === 'function' ? require : createRequire(import.meta.url)
    return req(resolvedPath)
  }
}

export const DEFAULT_PLUGIN_LOADER: PluginLoader = {
  resolve: resolvePluginPath,
  load: loadPluginModule,
}

// clear cached config-directory resolvers alongside the plugin load cache
export function clearDefaultPluginResolverCache(): void
{
  resolverCache.clear()
}
