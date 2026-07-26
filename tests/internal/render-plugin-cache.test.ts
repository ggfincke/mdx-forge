// tests/internal/render-plugin-cache.test.ts
// render plugin retry-cache regressions

import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeServer extends EventEmitter
{
  private readonly shouldFail: boolean
  private addressValue: {
    address: string
    family: string
    port: number
  } | null = null

  constructor(shouldFail: boolean)
  {
    super()
    this.shouldFail = shouldFail
  }

  listen(_port: number, _host: string, callback: () => void): this
  {
    if (this.shouldFail)
    {
      queueMicrotask(() => this.emit('error', new Error('bind failed')))
      return this
    }
    this.addressValue = {
      address: '127.0.0.1',
      family: 'IPv4',
      port: 43210,
    }
    queueMicrotask(callback)
    return this
  }

  address(): { address: string; family: string; port: number } | null
  {
    return this.addressValue
  }

  close(callback?: () => void): this
  {
    callback?.()
    return this
  }
}

function createHarnessMocks()
{
  const pages: Array<{
    close: ReturnType<typeof vi.fn>
    context: () => unknown
    goto: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    waitForFunction: ReturnType<typeof vi.fn>
  }> = []
  const contexts: Array<{
    close: ReturnType<typeof vi.fn>
    newPage: ReturnType<typeof vi.fn>
    route: ReturnType<typeof vi.fn>
  }> = []
  const browser = {
    close: vi.fn().mockResolvedValue(undefined),
    newContext: vi.fn(async () =>
    {
      const context = {
        close: vi.fn().mockResolvedValue(undefined),
        newPage: vi.fn(async () =>
        {
          const shouldFail = pages.length === 0
          const page = {
            close: vi.fn().mockResolvedValue(undefined),
            context: () => context,
            goto: vi.fn().mockResolvedValue(undefined),
            on: vi.fn(),
            waitForFunction: vi.fn(async () =>
            {
              if (shouldFail)
              {
                throw new Error('harness not ready')
              }
            }),
          }
          pages.push(page)
          return page
        }),
        route: vi.fn().mockResolvedValue(undefined),
      }
      contexts.push(context)
      return context
    }),
  }
  return { browser, contexts, pages }
}

describe('render plugin retry caches', () =>
{
  afterEach(() =>
  {
    vi.doUnmock('node:fs/promises')
    vi.doUnmock('node:http')
    vi.resetModules()
  })

  it('evicts failed trusted harness bundle reads', async () =>
  {
    const readFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('bundle missing'))
      .mockResolvedValueOnce('console.log("ok");')
    vi.doMock('node:fs/promises', () => ({ readFile }))
    const { readHarnessBundle } =
      await import('../../plugins/render/src/trusted')

    await expect(readHarnessBundle('generic')).rejects.toThrow('bundle missing')
    await expect(readHarnessBundle('generic')).resolves.toBe(
      'console.log("ok");'
    )
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  it('evicts failed preview-server harness bundle reads', async () =>
  {
    const readFile = vi
      .fn()
      .mockRejectedValueOnce(new Error('bundle missing'))
      .mockResolvedValueOnce('console.log("ok");')
    vi.doMock('node:fs/promises', () => ({ readFile }))
    const { startPreviewServer, stopPreviewServer } =
      await import('../../plugins/render/src/preview-server')
    const url = await startPreviewServer()
    const bundleUrl = `${new URL(url).origin}/harness/generic/bundle.js`

    try
    {
      const first = await fetch(bundleUrl)
      const second = await fetch(bundleUrl)

      expect(first.status).toBe(500)
      expect(await first.text()).toContain('harness bundle missing')
      expect(second.status).toBe(200)
      expect(await second.text()).toBe('console.log("ok");')
      expect(readFile).toHaveBeenCalledTimes(2)
    }
    finally
    {
      await stopPreviewServer()
    }
  })

  it('resolves the same bundle path from both readers', async () =>
  {
    const trustedReadFile = vi.fn().mockResolvedValue('console.log("ok");')
    vi.doMock('node:fs/promises', () => ({ readFile: trustedReadFile }))
    const { readHarnessBundle } =
      await import('../../plugins/render/src/trusted')
    await readHarnessBundle('generic')
    const trustedPath = trustedReadFile.mock.calls[0][0] as string
    vi.doUnmock('node:fs/promises')
    vi.resetModules()

    const serverReadFile = vi.fn().mockResolvedValue('console.log("ok");')
    vi.doMock('node:fs/promises', () => ({ readFile: serverReadFile }))
    const { startPreviewServer, stopPreviewServer } =
      await import('../../plugins/render/src/preview-server')
    const url = await startPreviewServer()
    const bundleUrl = `${new URL(url).origin}/harness/generic/bundle.js`

    try
    {
      await fetch(bundleUrl)
      const serverPath = serverReadFile.mock.calls[0][0] as string
      expect(serverPath).toBe(trustedPath)
      expect(serverPath).toMatch(/dist\/harness\/generic\/bundle\.js$/)
    }
    finally
    {
      await stopPreviewServer()
    }
  })

  it('resets preview server startup after listen failure', async () =>
  {
    const servers: FakeServer[] = []
    const createServer = vi.fn(() =>
    {
      const server = new FakeServer(servers.length === 0)
      servers.push(server)
      return server
    })
    vi.doMock('node:http', () => ({ createServer }))
    const { startPreviewServer } =
      await import('../../plugins/render/src/preview-server')

    await expect(startPreviewServer()).rejects.toThrow('bind failed')
    await expect(startPreviewServer()).resolves.toBe(
      'http://127.0.0.1:43210/preview'
    )
    expect(createServer).toHaveBeenCalledTimes(2)
  })

  it('drops failed harness pages before retrying', async () =>
  {
    const harness = createHarnessMocks()
    const {
      configureHarnessBrowserLauncher,
      getHarnessPage,
      shutdownHarnessPages,
    } = await import('../../plugins/render/src/harness-page')

    configureHarnessBrowserLauncher(() =>
      Promise.resolve(harness.browser as never)
    )

    try
    {
      await expect(getHarnessPage('generic')).rejects.toThrow(
        'harness not ready'
      )
      const page = await getHarnessPage('generic')

      expect(page).toBe(harness.pages[1])
      expect(harness.browser.newContext).toHaveBeenCalledTimes(2)
      expect(harness.pages[0].close).toHaveBeenCalledTimes(1)
      expect(harness.contexts[0].close).toHaveBeenCalledTimes(1)
    }
    finally
    {
      await shutdownHarnessPages()
      configureHarnessBrowserLauncher()
    }
  })
})
