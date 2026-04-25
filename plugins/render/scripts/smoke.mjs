// plugins/render/scripts/smoke.mjs
// smoke test renderMdx Safe Mode HTML & screenshot output
import { renderMdx, shutdownBrowser } from '../dist/render.js';
import { stopPreviewServer } from '../dist/preview-server.js';
import { writeFile } from 'node:fs/promises';

const source = `---
title: Smoke Test
tags: [mdx, render]
---

# Hello from mdx-forge-render

This is a paragraph with **bold** and *italic*.

\`\`\`js
console.log('hi');
\`\`\`

:::note
A note callout.
:::
`;

console.log('Compiling (HTML only)...');
const htmlOnly = await renderMdx({ source });
console.log('  frontmatter:', htmlOnly.frontmatter);
console.log('  html.length:', htmlOnly.html.length);
console.log('  previewPath:', htmlOnly.previewPath);
console.log('  previewUrl:', htmlOnly.previewUrl);
console.log('  screenshots:', htmlOnly.screenshots?.length ?? 0);

console.log('\nRendering with screenshot (framework=generic)...');
const withShot = await renderMdx({
  source,
  screenshot: true,
  framework: 'generic',
});
const singleShot = withShot.screenshots?.[0]?.png;
console.log('  screenshot bytes:', singleShot?.length);
console.log('  previewPath:', withShot.previewPath);
console.log('  previewUrl:', withShot.previewUrl);
if (singleShot) {
  await writeFile('scripts/smoke-output.png', singleShot);
  console.log('  wrote scripts/smoke-output.png');
}

await shutdownBrowser();
await stopPreviewServer();
console.log('\nOK');
