// plugins/render/scripts/smoke-diagrams.mjs
// assert diagram fences render as visible, non-zero-height code fallbacks (F34)
// cores w/o diagramBehavior skip w/ a notice unless MDX_FORGE_EXPECT_DIAGRAM_CODE=1

import { chromium } from 'playwright';
import { renderMdx, shutdownBrowser } from '../dist/render.js';
import { stopPreviewServer } from '../dist/preview-server.js';

const MERMAID_SOURCE = 'graph TD; Start-->End;';
const GRAPHVIZ_SOURCE = 'digraph G { a -> b; }';

const source = [
  '# Diagram smoke',
  '',
  '```mermaid',
  MERMAID_SOURCE,
  '```',
  '',
  '```dot',
  GRAPHVIZ_SOURCE,
  '```',
  '',
].join('\n');

function fail(message) {
  console.error(`smoke-diagrams FAILED: ${message}`);
  process.exitCode = 1;
}

console.log('Rendering diagram fences (safe mode)...');
const result = await renderMdx({ source });

const expectCodeMode = process.env.MDX_FORGE_EXPECT_DIAGRAM_CODE === '1';
const coreSupportsCodeMode = result.html.includes('mdx-diagram-code');

if (!coreSupportsCodeMode) {
  if (expectCodeMode) {
    fail(
      'installed mdx-forge core did not honor diagramBehavior: "code" ' +
        '(no .mdx-diagram-code in output) but MDX_FORGE_EXPECT_DIAGRAM_CODE=1'
    );
  } else {
    console.log(
      '  installed core predates diagramBehavior; diagrams stay empty ' +
        'placeholders (documented minimum-core gap). Skipping assertions.'
    );
  }
  await shutdownBrowser();
  await stopPreviewServer();
  if (process.exitCode !== 1) {
    console.log('\nOK (skipped)');
  }
  process.exit(process.exitCode ?? 0);
}

// source must survive as visible element text, not only data attributes
const sanitizedBody = result.html;
for (const [label, text] of [
  ['mermaid', MERMAID_SOURCE],
  ['graphviz', GRAPHVIZ_SOURCE],
]) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const inPre =
    sanitizedBody.includes(`<pre`) &&
    (sanitizedBody.includes(`>${text}`) || sanitizedBody.includes(escaped));
  if (!inPre) {
    fail(`${label} source is not present as visible code text`);
  }
}

console.log('Measuring rendered diagram containers in Chromium...');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(result.fullHtml, { waitUntil: 'load' });
  const measurements = await page.evaluate(() => {
    const selector = '.mermaid-container, .graphviz-container';
    return Array.from(document.querySelectorAll(selector)).map((el) => ({
      className: el.className,
      height: el.getBoundingClientRect().height,
      textLength: (el.textContent ?? '').trim().length,
    }));
  });

  if (measurements.length !== 2) {
    fail(`expected 2 diagram containers, found ${measurements.length}`);
  }
  for (const m of measurements) {
    console.log(
      `  ${m.className}: height=${Math.round(m.height)}px text=${m.textLength} chars`
    );
    if (m.height <= 0) {
      fail(`container "${m.className}" has zero height`);
    }
    if (m.textLength === 0) {
      fail(`container "${m.className}" has no visible text`);
    }
  }
} finally {
  await browser.close();
}

await shutdownBrowser();
await stopPreviewServer();
if (process.exitCode === 1) {
  process.exit(1);
}
console.log('\nOK');
