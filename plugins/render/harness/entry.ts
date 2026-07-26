// plugins/render/harness/entry.ts
// browser-side runtime for Trusted Mode: preload core modules + expose render API

import React from 'react'
import * as ReactDOM from 'react-dom'
import * as ReactDOMClient from 'react-dom/client'
import * as jsxRuntime from 'react/jsx-runtime'
import { MDXProvider, useMDXComponents } from '@mdx-js/react'
import {
  clearInjectedStyles,
  loadModule,
  registerPreloadEntries,
  registry,
  setModuleFetcher,
  configureRuntime,
  resetModules,
  type FetchResult,
} from 'mdx-forge/browser'

// resolved to mdx-forge/components/{framework} via esbuild `alias` at bundle time
// @ts-expect-error virtual module resolved by the bundler
import * as FRAMEWORK_SHIMS from 'virtual:mdx-forge-shims'

const SHIM_EXPORTS = FRAMEWORK_SHIMS as unknown as Record<string, unknown>

interface HarnessWindow extends Window
{
  // headless snapshot API: renders, returns innerHTML, unmounts
  __mdxForgeRender?: (
    code: string,
    dependencies: string[],
    entryId: string
  ) => Promise<{ html: string } | { error: string }>
  // interactive mount API: renders, stays mounted so event handlers fire
  __mdxForgeMount?: (
    code: string,
    dependencies: string[],
    entryId: string
  ) => Promise<{ ok: true } | { error: string }>
  // inline bootstrap can set these for auto-mount on load
  __MDX_FORGE_CODE__?: string
  __MDX_FORGE_DEPS__?: string[]
  __MDX_FORGE_ENTRY__?: string
}

const harnessWindow = window as HarnessWindow
let activeRoot: ReturnType<typeof ReactDOMClient.createRoot> | undefined

function installPreloads(): void
{
  registerPreloadEntries(registry, [
    {
      id: 'npm://react@18',
      exports: React,
      aliases: ['react', 'npm://react'],
    },
    {
      id: 'npm://react-dom@18',
      exports: ReactDOM,
      aliases: ['react-dom', 'npm://react-dom'],
    },
    {
      id: 'npm://react-dom/client@18',
      exports: ReactDOMClient,
      aliases: ['react-dom/client', 'npm://react-dom/client'],
    },
    {
      id: 'npm://react/jsx-runtime@18',
      exports: jsxRuntime,
      aliases: ['react/jsx-runtime', 'npm://react/jsx-runtime'],
    },
    {
      id: 'npm://@mdx-js/react@3',
      exports: {
        __esModule: true,
        MDXProvider,
        useMDXComponents,
      },
      aliases: ['@mdx-js/react', 'npm://@mdx-js/react'],
    },
  ])

  configureRuntime({
    runtime: {
      Fragment: (jsxRuntime as { Fragment: unknown }).Fragment,
      jsx: (jsxRuntime as { jsx: unknown }).jsx,
      jsxs: (jsxRuntime as { jsxs: unknown }).jsxs,
      useMDXComponents: useMDXComponents as () => Record<string, unknown>,
    },
  })
}

// reject custom module fetches so unknown imports surface immediately
function rejectFetcher(
  request: string,
  _isBare: boolean,
  parentId: string
): Promise<FetchResult | undefined>
{
  return Promise.reject(
    new Error(
      `unsupported import "${request}" from ${parentId}: render plugin does not ` +
        `resolve custom modules. Use JSX tags (<Tabs>, <Callout>, ...) for framework ` +
        `components instead of \`import\` statements.`
    )
  )
}

async function waitForRenderToSettle(container: HTMLElement): Promise<void>
{
  // flush two animation frames + a microtask tick for React 19 settle
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  // serialize a read to force stable innerHTML
  void container.offsetHeight
}

interface MountContext
{
  container: HTMLElement
  tree: React.ReactElement
}

async function buildMountContext(
  code: string,
  dependencies: string[],
  entryId: string
): Promise<MountContext | { error: string }>
{
  const container = document.getElementById('mdx-root')
  if (!container)
  {
    return { error: 'harness container #mdx-root missing' }
  }

  // clean slate: drop previously-evaluated user modules + injected CSS
  resetModules()
  clearInjectedStyles()
  container.innerHTML = ''

  const module = await loadModule(entryId, code, dependencies, rejectFetcher)
  const exports = module.exports as Record<string, unknown>
  const Component = (exports.default ?? exports) as
    ((props: unknown) => unknown) | undefined

  if (typeof Component !== 'function')
  {
    return {
      error: `MDX module did not export a component (got ${typeof Component}).`,
    }
  }

  const tree = React.createElement(
    MDXProvider,
    { components: SHIM_EXPORTS as Record<string, React.ComponentType> },
    React.createElement(
      Component as React.ComponentType<Record<string, unknown>>
    )
  )

  return { container, tree }
}

function createRootWithErrorCapture(
  container: HTMLElement,
  onCapture: (err: Error) => void
)
{
  return ReactDOMClient.createRoot(container, {
    onUncaughtError: (error) =>
    {
      onCapture(error instanceof Error ? error : new Error(String(error)))
    },
    onCaughtError: (error) =>
    {
      onCapture(error instanceof Error ? error : new Error(String(error)))
    },
    onRecoverableError: (error) =>
    {
      onCapture(error instanceof Error ? error : new Error(String(error)))
    },
  })
}

// shared scaffold: build context, mount w/ error capture, settle
async function renderToContainer(
  code: string,
  dependencies: string[],
  entryId: string,
  onCapture: (err: Error) => void,
  onRootCreated?: (root: ReturnType<typeof ReactDOMClient.createRoot>) => void
): Promise<
  | {
      container: HTMLElement
      root: ReturnType<typeof ReactDOMClient.createRoot>
    }
  | { error: string }
>
{
  const ctx = await buildMountContext(code, dependencies, entryId)
  if ('error' in ctx)
  {
    return ctx
  }

  const root = createRootWithErrorCapture(ctx.container, onCapture)
  onRootCreated?.(root)
  root.render(ctx.tree)
  await waitForRenderToSettle(ctx.container)

  return { container: ctx.container, root }
}

// render snapshot for MCP html field & PNG screenshot source
async function renderMdx(
  code: string,
  dependencies: string[],
  entryId: string
): Promise<{ html: string } | { error: string }>
{
  try
  {
    let captured: Error | undefined
    const mounted = await renderToContainer(
      code,
      dependencies,
      entryId,
      (err) =>
      {
        captured = err
      }
    )
    if ('error' in mounted)
    {
      return mounted
    }

    const html = mounted.container.innerHTML
    mounted.root.unmount()

    if (captured)
    {
      return { error: captured.message }
    }
    return { html }
  }
  catch (err)
  {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

// mount interactive tree so event handlers & hooks keep running
async function mountMdx(
  code: string,
  dependencies: string[],
  entryId: string
): Promise<{ ok: true } | { error: string }>
{
  try
  {
    // tear down any previous interactive mount before starting a new one
    if (activeRoot)
    {
      activeRoot.unmount()
      activeRoot = undefined
    }

    let captured: Error | undefined
    const mounted = await renderToContainer(
      code,
      dependencies,
      entryId,
      (err) =>
      {
        captured = err
      },
      (root) =>
      {
        activeRoot = root
      }
    )
    if ('error' in mounted)
    {
      return mounted
    }

    if (captured)
    {
      mounted.root.unmount()
      activeRoot = undefined
      return { error: captured.message }
    }
    return { ok: true }
  }
  catch (err)
  {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}

installPreloads()
setModuleFetcher(rejectFetcher)
harnessWindow.__mdxForgeRender = renderMdx
harnessWindow.__mdxForgeMount = mountMdx

// auto-mount preview server globals when bundle loads after #mdx-root
const autoCode = harnessWindow.__MDX_FORGE_CODE__
const autoDeps = harnessWindow.__MDX_FORGE_DEPS__
const autoEntry = harnessWindow.__MDX_FORGE_ENTRY__
if (
  typeof autoCode === 'string' &&
  Array.isArray(autoDeps) &&
  typeof autoEntry === 'string'
)
{
  mountMdx(autoCode, autoDeps, autoEntry).then((result) =>
  {
    if ('error' in result)
    {
      const container = document.getElementById('mdx-root')
      if (container)
      {
        const pre = document.createElement('pre')
        pre.style.color = 'crimson'
        pre.style.whiteSpace = 'pre-wrap'
        pre.textContent = `trusted render failed: ${result.error}`
        container.appendChild(pre)
      }
    }
  })
}
