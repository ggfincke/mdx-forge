// plugins/render/src/harness-page.ts
// per-framework Playwright page cache for Trusted Mode rendering

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import type { FrameworkId } from './css.js'

const __filename = fileURLToPath(import.meta.url)
const PLUGIN_ROOT = resolve(dirname(__filename), '..')

interface HarnessEntry
{
  page: Page
  ready: Promise<void>
}

type BrowserLauncher = () => Promise<Browser>

const defaultBrowserLauncher: BrowserLauncher = () =>
  chromium.launch({ headless: true })

let browserPromise: Promise<Browser> | undefined
let browserLauncher: BrowserLauncher = defaultBrowserLauncher
const pages = new Map<FrameworkId, Promise<HarnessEntry>>()
const pageQueues = new Map<FrameworkId, Promise<void>>()
let shuttingDown = false

async function getBrowser(): Promise<Browser>
{
  if (!browserPromise)
  {
    browserPromise = browserLauncher().catch((err) =>
    {
      browserPromise = undefined
      throw err
    })
  }
  return browserPromise
}

// single plugin-level Browser shared by harness eval & screenshot capture (F27)
export function getPluginBrowser(): Promise<Browser>
{
  return getBrowser()
}

// default-deny resource route; only file:// & data: continue (F1)
// screenshot/preview contexts install this before loading any content
export async function applyDenyRoute(context: BrowserContext): Promise<void>
{
  await context.route('**/*', (route) =>
  {
    const url = route.request().url()
    if (url.startsWith('file://') || url.startsWith('data:'))
    {
      route.continue()
      return
    }
    route.abort()
  })
}

export function configureHarnessBrowserLauncher(
  launcher?: BrowserLauncher
): void
{
  browserLauncher = launcher ?? defaultBrowserLauncher
  browserPromise = undefined
}

function harnessUrl(framework: FrameworkId): string
{
  const htmlPath = resolve(
    PLUGIN_ROOT,
    'dist',
    'harness',
    framework,
    'index.html'
  )
  return pathToFileURL(htmlPath).href
}

async function openHarnessPage(framework: FrameworkId): Promise<HarnessEntry>
{
  const browser = await getBrowser()
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    // block any non-local request; MDX bodies can contain images / links
    // that reference remote hosts & we must not let them exfiltrate data
    serviceWorkers: 'block',
  })

  await applyDenyRoute(context)

  const page = await context.newPage()

  page.on('console', (msg) =>
  {
    if (process.env.MDX_FORGE_HARNESS_DEBUG)
    {
      console.log(`[harness ${framework} ${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) =>
  {
    console.error(`[harness ${framework} pageerror] ${err.message}`)
  })

  const ready = (async () =>
  {
    await page.goto(harnessUrl(framework), { waitUntil: 'load' })
    // bundle sets window.__mdxForgeRender once preloads register
    await page.waitForFunction(
      () =>
      {
        const api = (
          window as unknown as {
            __mdxForgeRender?: unknown
          }
        ).__mdxForgeRender
        return typeof api === 'function'
      },
      { timeout: 15000 }
    )
  })()

  return { page, ready }
}

async function closeHarnessEntry(entry: HarnessEntry): Promise<void>
{
  const context = entry.page.context()
  await entry.page.close().catch(() => undefined)
  await context.close().catch(() => undefined)
}

export async function getHarnessPage(framework: FrameworkId): Promise<Page>
{
  // store the promise synchronously so concurrent renders share one context
  let entryPromise = pages.get(framework)
  if (!entryPromise)
  {
    entryPromise = openHarnessPage(framework)
    pages.set(framework, entryPromise)
  }

  let entry: HarnessEntry | undefined
  try
  {
    entry = await entryPromise
    await entry.ready
    return entry.page
  }
  catch (error: unknown)
  {
    if (pages.get(framework) === entryPromise)
    {
      pages.delete(framework)
    }
    if (entry)
    {
      await closeHarnessEntry(entry)
    }
    throw error
  }
}

// ! reentrant calls deadlock - operation must not call runWithHarnessPage for the same framework
export async function runWithHarnessPage<T>(
  framework: FrameworkId,
  operation: (page: Page) => Promise<T>
): Promise<T>
{
  if (shuttingDown)
  {
    throw new Error('harness pages are shutting down')
  }
  const previous = pageQueues.get(framework) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) =>
  {
    release = resolve
  })
  const queued = previous.catch(() => undefined).then(() => current)
  pageQueues.set(framework, queued)

  await previous.catch(() => undefined)
  try
  {
    return await operation(await getHarnessPage(framework))
  }
  finally
  {
    release()
    if (pageQueues.get(framework) === queued)
    {
      pageQueues.delete(framework)
    }
  }
}

export async function shutdownHarnessPages(): Promise<void>
{
  // block new queue entries so drained pages can't be recreated mid-shutdown
  shuttingDown = true
  try
  {
    await Promise.allSettled(Array.from(pageQueues.values()))
    pageQueues.clear()

    const entryPromises = Array.from(pages.values())
    pages.clear()
    await Promise.allSettled(
      entryPromises.map(async (entryPromise) =>
      {
        const entry = await entryPromise.catch(() => undefined)
        if (entry)
        {
          await closeHarnessEntry(entry)
        }
      })
    )

    const pending = browserPromise
    browserPromise = undefined
    if (!pending)
    {
      return
    }
    const browser = await pending.catch(() => undefined)
    await browser?.close().catch(() => undefined)
  }
  finally
  {
    shuttingDown = false
  }
}
