// Smoke test: compile + screenshot a tiny MDX via renderMdx directly
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
console.log('  has screenshot:', !!htmlOnly.screenshot);

console.log('\nRendering with screenshot (framework=generic)...');
const withShot = await renderMdx({ source, screenshot: true, framework: 'generic' });
console.log('  screenshot bytes:', withShot.screenshot?.length);
console.log('  previewPath:', withShot.previewPath);
console.log('  previewUrl:', withShot.previewUrl);
if (withShot.screenshot) {
  await writeFile('scripts/smoke-output.png', withShot.screenshot);
  console.log('  wrote scripts/smoke-output.png');
}

await shutdownBrowser();
await stopPreviewServer();
console.log('\nOK');
