// Smoke test for Trusted Mode: compile + render MDX with framework shims,
// then drive the live preview with Playwright to verify true interactivity.

import { renderMdx, shutdownBrowser } from '../dist/render.js';
import { stopPreviewServer } from '../dist/preview-server.js';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const genericSource = `---
title: Trusted Smoke
tags: [mdx, trusted]
---

# Trusted Mode Smoke Test

Paragraph with **bold** and *italic*.

<Callout type="info" title="Hello">
  This callout is rendered by the generic shim via React.
</Callout>

<Tabs>
  <TabItem label="first" value="first">
    First tab content.
  </TabItem>
  <TabItem label="second" value="second">
    Second tab content.
  </TabItem>
</Tabs>

\`\`\`js
console.log('hello from trusted smoke');
\`\`\`
`;

const docusaurusSource = `---
title: Docusaurus Trusted Smoke
---

# Docusaurus Trusted Smoke

<Tabs>
  <TabItem label="Alpha" value="alpha">Alpha content</TabItem>
  <TabItem label="Beta" value="beta">Beta content</TabItem>
</Tabs>

<Details summary="click me">
  Hidden by default.
</Details>
`;

let failed = 0;
function check(name, ok) {
  console.log(`  ${ok ? 'OK' : 'FAIL'}  ${name}`);
  if (!ok) {
    failed += 1;
  }
}

console.log('Rendering (trusted, generic)...');
const out = await renderMdx({
  source: genericSource,
  mode: 'trusted',
  framework: 'generic',
});

console.log('  frontmatter:', out.frontmatter);
console.log('  html.length:', out.html.length);
console.log('  fullHtml.length:', out.fullHtml.length);
console.log('  previewUrl:', out.previewUrl);

check('snapshot callout class', out.html.includes('mdx-preview-generic-callout'));
check('snapshot callout title rendered', out.html.includes('Hello'));
check('snapshot tabs class', out.html.includes('mdx-preview-generic-tabs'));
check(
  'snapshot code block shiki',
  out.html.includes('shiki') && out.html.includes('console.log'),
);
check(
  'fullHtml inlines harness bundle',
  out.fullHtml.includes('__mdxForgeMount') && out.fullHtml.length > 500_000,
);
check(
  'fullHtml inlines compiled MDX',
  out.fullHtml.includes('__MDX_FORGE_CODE__'),
);

console.log('\nDriving the live preview to verify interactivity...');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', (err) => {
  console.error('  [preview pageerror]', err.message);
});
await page.goto(out.previewUrl);
await page.waitForSelector('.mdx-preview-generic-tabs');

// Assert the initial state: first tab active, second hidden
const firstActiveInitial = await page.evaluate(
  () =>
    !!document
      .querySelector('.mdx-preview-generic-tabs-button.active')
      ?.textContent?.trim()
      ?.includes('first'),
);
check('initial: first tab active', firstActiveInitial);

// Click the second tab button and confirm React updated the DOM
await page.getByRole('tab', { name: 'second' }).click();
await page.waitForTimeout(150);
const secondActiveAfterClick = await page.evaluate(
  () =>
    !!document
      .querySelector('.mdx-preview-generic-tabs-button.active')
      ?.textContent?.trim()
      ?.includes('second'),
);
check('after click: second tab active', secondActiveAfterClick);

// And the panel content should swap
const panelText = await page.evaluate(
  () =>
    document
      .querySelector('.mdx-preview-generic-tabs-panel.active')
      ?.textContent?.trim() ?? '',
);
check('after click: second panel shown', panelText.includes('Second'));

await browser.close();

console.log('\nRendering (trusted, docusaurus, w/ screenshot)...');
const out2 = await renderMdx({
  source: docusaurusSource,
  mode: 'trusted',
  framework: 'docusaurus',
  screenshot: true,
});
check('docusaurus tabs class', out2.html.includes('docusaurus-tabs'));
check('details element', out2.html.includes('<details'));
check('screenshot has bytes', typeof out2.screenshot?.length === 'number' && out2.screenshot.length > 1000);
if (out2.screenshot) {
  await writeFile('scripts/smoke-trusted-output.png', out2.screenshot);
  console.log('  wrote scripts/smoke-trusted-output.png');
}

await shutdownBrowser();
await stopPreviewServer();

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nOK');
