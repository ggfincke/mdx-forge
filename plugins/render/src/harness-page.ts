// plugins/render/src/harness-page.ts
// per-framework Playwright page cache for Trusted Mode rendering

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import type { FrameworkId } from './css.js';

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = resolve(dirname(__filename), '..');

interface HarnessEntry {
  page: Page;
  ready: Promise<void>;
}

type BrowserLauncher = () => Promise<Browser>;

const defaultBrowserLauncher: BrowserLauncher = () =>
  chromium.launch({ headless: true });

let browserPromise: Promise<Browser> | undefined;
let browserLauncher: BrowserLauncher = defaultBrowserLauncher;
const pages = new Map<FrameworkId, HarnessEntry>();

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = browserLauncher().catch((err) => {
      browserPromise = undefined;
      throw err;
    });
  }
  return browserPromise;
}

export function configureHarnessBrowserLauncher(
  launcher?: BrowserLauncher
): void {
  browserLauncher = launcher ?? defaultBrowserLauncher;
  browserPromise = undefined;
}

function harnessUrl(framework: FrameworkId): string {
  const htmlPath = resolve(
    PLUGIN_ROOT,
    'dist',
    'harness',
    framework,
    'index.html'
  );
  return pathToFileURL(htmlPath).href;
}

async function openHarnessPage(framework: FrameworkId): Promise<HarnessEntry> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    // block any non-local request; MDX bodies can contain images / links
    // that reference remote hosts & we must not let them exfiltrate data
    serviceWorkers: 'block',
  });

  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file://') || url.startsWith('data:')) {
      route.continue();
      return;
    }
    route.abort();
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (process.env.MDX_FORGE_HARNESS_DEBUG) {
      console.log(`[harness ${framework} ${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.error(`[harness ${framework} pageerror] ${err.message}`);
  });

  const ready = (async () => {
    await page.goto(harnessUrl(framework), { waitUntil: 'load' });
    // bundle sets window.__mdxForgeReady once preloads register
    await page.waitForFunction(
      () => {
        const api = (
          window as unknown as {
            __mdxForgeRender?: unknown;
          }
        ).__mdxForgeRender;
        return typeof api === 'function';
      },
      { timeout: 15000 }
    );
  })();

  return { page, ready };
}

async function closeHarnessEntry(entry: HarnessEntry): Promise<void> {
  const context = entry.page.context();
  await entry.page.close().catch(() => undefined);
  await context.close().catch(() => undefined);
}

export async function getHarnessPage(framework: FrameworkId): Promise<Page> {
  let entry = pages.get(framework);
  if (!entry) {
    entry = await openHarnessPage(framework);
    pages.set(framework, entry);
  }

  try {
    await entry.ready;
    return entry.page;
  } catch (error: unknown) {
    if (pages.get(framework) === entry) {
      pages.delete(framework);
    }
    await closeHarnessEntry(entry);
    throw error;
  }
}

export async function shutdownHarnessPages(): Promise<void> {
  const entries = Array.from(pages.values());
  pages.clear();
  await Promise.allSettled(entries.map(closeHarnessEntry));

  const pending = browserPromise;
  browserPromise = undefined;
  if (!pending) {
    return;
  }
  const browser = await pending.catch(() => undefined);
  await browser?.close().catch(() => undefined);
}
