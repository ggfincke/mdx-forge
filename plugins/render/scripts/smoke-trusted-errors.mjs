// Confirm Trusted Mode runtime errors ("Expected component 'X' to be defined")
// are normalized into a structured unknown-component diagnostic instead of a
// raw stack trace. a real end-to-end check for §1.2.

import { renderMdx, shutdownBrowser } from '../dist/render.js';
import { stopPreviewServer } from '../dist/preview-server.js';
import { RenderDiagnosticError } from '../dist/diagnostics.js';

let failed = 0;
let checked = 0;
function check(name, ok, detail) {
  checked += 1;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) {
    failed += 1;
  }
}

// docusaurus shim barrel does NOT export Callout. lint resolves component names
// per-framework (no generic fallback), so this is caught before the trusted
// render even runs.
try {
  await renderMdx({
    source: '<Callout type="tip">this should fail in docusaurus</Callout>',
    framework: 'docusaurus',
    mode: 'trusted',
  });
  check('docusaurus trusted Callout rejected', false, 'expected throw');
} catch (err) {
  check('is RenderDiagnosticError', err instanceof RenderDiagnosticError);
  check(
    'kind is unknown-component',
    err.diagnostic.kind === 'unknown-component',
  );
  check('component captured', err.diagnostic.component === 'Callout');
}

// nextjs framework w/ JSX tag that simply doesn't exist anywhere -> trusted
// mode runtime error -> "Expected component 'Foo' to be defined". lint sees
// this first because it's not in any registry.
try {
  await renderMdx({
    source: '<NotAThing foo="bar">body</NotAThing>',
    framework: 'nextjs',
    mode: 'trusted',
  });
  check('nextjs unknown component rejected', false, 'expected throw');
} catch (err) {
  check('is RenderDiagnosticError (nextjs)', err instanceof RenderDiagnosticError);
  check(
    'kind is unknown-component (nextjs)',
    err.diagnostic.kind === 'unknown-component',
  );
  check('component = NotAThing', err.diagnostic.component === 'NotAThing');
}

await shutdownBrowser();
await stopPreviewServer();

console.log(`\n${checked - failed}/${checked} passed`);
if (failed > 0) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('OK');
