// plugins/render/scripts/smoke-trusted-errors.mjs
// smoke test Trusted Mode unknown-component diagnostics

import { renderMdx, shutdownBrowser } from '../dist/render.js'
import { stopPreviewServer } from '../dist/preview-server.js'
import { RenderDiagnosticError } from '../dist/diagnostics.js'

let failed = 0
let checked = 0
function check(name, ok, detail)
{
  checked += 1
  console.log(
    `  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  )
  if (!ok)
  {
    failed += 1
  }
}

// docusaurus lacks Callout; lint rejects it before Trusted render
try
{
  await renderMdx({
    source: '<Callout type="tip">this should fail in docusaurus</Callout>',
    framework: 'docusaurus',
    mode: 'trusted',
  })
  check('docusaurus trusted Callout rejected', false, 'expected throw')
}
catch (err)
{
  check('is RenderDiagnosticError', err instanceof RenderDiagnosticError)
  check(
    'kind is unknown-component',
    err.diagnostic.kind === 'unknown-component'
  )
  check('component captured', err.diagnostic.component === 'Callout')
}

// nextjs unknown tag is rejected before Trusted render
try
{
  await renderMdx({
    source: '<NotAThing foo="bar">body</NotAThing>',
    framework: 'nextjs',
    mode: 'trusted',
  })
  check('nextjs unknown component rejected', false, 'expected throw')
}
catch (err)
{
  check(
    'is RenderDiagnosticError (nextjs)',
    err instanceof RenderDiagnosticError
  )
  check(
    'kind is unknown-component (nextjs)',
    err.diagnostic.kind === 'unknown-component'
  )
  check('component = NotAThing', err.diagnostic.component === 'NotAThing')
}

await shutdownBrowser()
await stopPreviewServer()

console.log(`\n${checked - failed}/${checked} passed`)
if (failed > 0)
{
  console.error(`${failed} assertion(s) failed`)
  process.exit(1)
}
console.log('OK')
