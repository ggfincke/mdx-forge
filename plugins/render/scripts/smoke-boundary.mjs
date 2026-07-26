// plugins/render/scripts/smoke-boundary.mjs
// t1: Safe render boundary is inert & capture makes no outbound requests

// real Chromium + loopback hit-counter; parser-differential mXSS + egress probes

import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { renderMdx, shutdownBrowser } from '../dist/render.js'
import { stopPreviewServer } from '../dist/preview-server.js'
import { sanitizeScreenshotHtml } from '../dist/html.js'

let failures = 0
function check(label, cond)
{
  if (cond)
  {
    console.log(`  ok   ${label}`)
  }
  else
  {
    console.error(`  FAIL ${label}`)
    failures++
  }
}

// loopback hit counter — any request here means a Safe artifact leaked egress
let hits = 0
const hitLog = []
const probe = createServer((req, res) =>
{
  hits++
  hitLog.push(req.url)
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('hit')
})
const probeUrl = await new Promise((resolve) =>
{
  probe.listen(0, '127.0.0.1', () =>
  {
    resolve(`http://127.0.0.1:${probe.address().port}`)
  })
})

// 1x1 transparent gif — a data: asset that must survive sanitization
const DATA_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='

// same Safe CSP the render pipeline embeds; used to wrap the raw-text case that
// MDX-as-JSX rejects upstream (that rejection is itself a first defense)
const SAFE_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; " +
  "font-src data:; base-uri 'none'; form-action 'none'"

function wrapSafeDoc(bodyHtml)
{
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SAFE_CSP}"></head><body>${bodyHtml}</body></html>`
}

// parser-differential (raw-text) case: w/ scripting disabled a parser reads
// the <style> content as markup; a scripting-enabled browser reparses the
// trailing <img onerror> as a live element that pre-fix set the exec marker
const MARKER = 'window.__executed=(window.__executed||0)+1'
const MXSS = `<noscript><style></noscript><img src=x onerror="${MARKER}"></style></noscript>`

// --- Part A: string-level sanitizer neutralizes the payload class ------------
console.log('Part A: sanitizer strips executable & raw-text vectors...')
const sanitizedPayload = sanitizeScreenshotHtml(
  [
    MXSS,
    `<script>${MARKER}</script>`,
    `<img src=z onerror="${MARKER}">`,
    `<a href="java\nscript:${MARKER}">bad</a>`,
    `<img src="${DATA_GIF}" alt="ok">`,
  ].join('')
)
check('no <script>', !/<script/i.test(sanitizedPayload))
check('no <noscript>', !/<noscript/i.test(sanitizedPayload))
check('no <style>', !/<style/i.test(sanitizedPayload))
check('no onerror=', !/onerror\s*=/i.test(sanitizedPayload))
check('no javascript: uri', !/javascript:/i.test(sanitizedPayload))
check('data: image survives', sanitizedPayload.includes(DATA_GIF))

const browser = await chromium.launch({ headless: true })

// --- Part B: parser-differential is inert after reparse in real Chromium -----
console.log('Part B: parser-differential is inert in Chromium...')
{
  const doc = wrapSafeDoc(sanitizedPayload)
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setContent(doc, { waitUntil: 'load' })
  await page.waitForTimeout(200)
  const executed = await page.evaluate(() => window.__executed)
  check('no execution marker after reparse', executed === undefined)
  await context.close()
}

// --- Part C: full pipeline document is inert & does not egress ---------------
console.log('Part C: fullHtml is inert & CSP blocks egress...')
const source = `# Boundary probe

<img src="${probeUrl}/probe-img.png" alt="http image probe" onError="${MARKER}" />

<div style="background-image:url(${probeUrl}/probe-bg.png)">css url probe</div>

![data ok](${DATA_GIF})
`

const safe = await renderMdx({ source })
check('fullHtml keeps data: image', safe.fullHtml.includes(DATA_GIF))
check(
  'fullHtml has Safe CSP',
  safe.fullHtml.includes('Content-Security-Policy')
)
check('fullHtml dropped onerror', !/onerror\s*=/i.test(safe.fullHtml))

{
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setContent(safe.fullHtml, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  const executed = await page.evaluate(() => window.__executed)
  check('no execution marker in fullHtml', executed === undefined)
  await context.close()
}
check(`no loopback egress from fullHtml (hits=${hits})`, hits === 0)

await browser.close()

// --- Part D: screenshot capture also makes zero outbound requests -----------
console.log('Part D: screenshot capture makes zero outbound requests...')
const hitsBeforeShot = hits
const shot = await renderMdx({ source, screenshot: true })
check(
  'screenshot returned a PNG',
  (shot.screenshots?.[0]?.png?.length ?? 0) > 0
)
check(
  `no loopback egress from capture (hits=${hits - hitsBeforeShot})`,
  hits === hitsBeforeShot
)

if (hitLog.length > 0)
{
  console.error('  egress log:', hitLog)
}

await shutdownBrowser()
await stopPreviewServer()
await new Promise((resolve) => probe.close(() => resolve()))

if (failures > 0)
{
  console.error(`\nsmoke-boundary FAILED (${failures} checks)`)
  process.exit(1)
}
console.log('\nsmoke-boundary OK')
