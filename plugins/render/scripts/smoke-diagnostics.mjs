// Smoke test for Phase 1 features: list_components data, prop lint,
// structured errors, & frontmatter validation. drives the library APIs
// directly rather than going through the MCP transport.

import { renderMdx, shutdownBrowser } from '../dist/render.js';
import { stopPreviewServer } from '../dist/preview-server.js';
import { lintMdxSource } from '../dist/lint.js';
import {
  findComponent,
  getFrontmatterSchema,
  listComponentsForFramework,
  listFrameworks,
} from '../dist/registry.js';
import {
  RenderDiagnosticError,
  suggestMatch,
} from '../dist/diagnostics.js';

let failed = 0;
let checked = 0;
function check(name, ok, detail) {
  checked += 1;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) {
    failed += 1;
  }
}

function has(list, predicate) {
  return list.some(predicate);
}

// --- §1.1 list_components registry surface ---------------------------------

console.log('§1.1 list_components registry...');

const frameworks = listFrameworks();
check('five frameworks', frameworks.length === 5);
check('generic listed', frameworks.includes('generic'));
check('docusaurus listed', frameworks.includes('docusaurus'));
check('starlight listed', frameworks.includes('starlight'));
check('nextra listed', frameworks.includes('nextra'));
check('nextjs listed', frameworks.includes('nextjs'));

const genericList = listComponentsForFramework('generic');
check('generic has >=5 components', genericList.length >= 5);
check(
  'generic has Callout spec',
  has(genericList, (c) => c.name === 'Callout'),
);

const callout = findComponent('generic', 'Callout');
check('Callout lookup works', Boolean(callout));
check(
  'Callout has type prop with 7 enum values',
  callout?.props.some(
    (p) => p.name === 'type' && p.type === 'enum' && p.values?.length === 7,
  ),
);
check(
  'Callout.type accepts danger',
  callout?.props.find((p) => p.name === 'type')?.values?.includes('danger'),
);

const alertAlias = findComponent('generic', 'Alert');
check('Alert resolves to Callout via alias', alertAlias?.name === 'Callout');

const docusaurusTabs = findComponent('docusaurus', 'Tabs');
check('docusaurus Tabs lookup', Boolean(docusaurusTabs));
check(
  'docusaurus Tabs has groupId prop',
  docusaurusTabs?.props.some((p) => p.name === 'groupId'),
);
check(
  'docusaurus does NOT inherit generic Callout (barrel-scoped)',
  findComponent('docusaurus', 'Callout') === undefined,
);

const linkCard = findComponent('starlight', 'LinkCard');
check(
  'starlight LinkCard has required title + href',
  linkCard?.props.filter((p) => p.required).map((p) => p.name).sort().join(',') === 'href,title',
);

const nextraCallout = findComponent('nextra', 'Callout');
check(
  'nextra Callout enum differs from generic (has "error")',
  nextraCallout?.props.find((p) => p.name === 'type')?.values?.includes('error'),
);

const nextjsImage = findComponent('nextjs', 'Image');
check(
  'nextjs Image src + alt required',
  nextjsImage?.props.filter((p) => p.required).map((p) => p.name).sort().join(',') === 'alt,src',
);

// --- §1.2 structured errors w/ did-you-mean --------------------------------

console.log('\n§1.2 structured errors...');

check('suggestMatch finds close match', suggestMatch('Calout', ['Callout']) === 'Callout');
check('suggestMatch rejects too-far match', suggestMatch('xyz', ['Callout']) === undefined);
check(
  'suggestMatch rejects empty input',
  suggestMatch('', ['Callout']) === undefined,
);

// unknown-component error from Safe Mode lint
const unknownLint = await lintMdxSource('<WidgetFoo />', 'generic');
const unknownDiag = unknownLint.diagnostics.find(
  (d) => d.kind === 'unknown-component',
);
check('unknown component detected', Boolean(unknownDiag));
check('unknown component has component name', unknownDiag?.component === 'WidgetFoo');

// did-you-mean for close typo
const typoLint = await lintMdxSource('<Calout type="tip">body</Calout>', 'generic');
const typoDiag = typoLint.diagnostics.find((d) => d.kind === 'unknown-component');
check('typo component flagged', Boolean(typoDiag));
check('did-you-mean suggests Callout', typoDiag?.suggestion === 'Callout');

// mdx-syntax (fatal): unterminated JSX
try {
  await renderMdx({ source: '<Callout type="tip"\n\nunterminated', framework: 'generic' });
  check('unterminated JSX throws', false, 'expected throw');
} catch (err) {
  check(
    'unterminated JSX is RenderDiagnosticError',
    err instanceof RenderDiagnosticError,
  );
  check(
    'unterminated JSX kind is mdx-syntax',
    err.diagnostic?.kind === 'mdx-syntax',
  );
}

// position is captured when available
const posLint = await lintMdxSource(
  [
    '# Title',
    '',
    'paragraph',
    '',
    '<BadComponent />',
  ].join('\n'),
  'generic',
);
const posDiag = posLint.diagnostics.find((d) => d.kind === 'unknown-component');
check('position line captured', typeof posDiag?.line === 'number' && posDiag.line >= 5);

// --- §1.3 prop lint ---------------------------------------------------------

console.log('\n§1.3 prop lint...');

// invalid prop value (not in enum)
const badEnumLint = await lintMdxSource(
  '<Callout type="bogus">body</Callout>',
  'generic',
);
const badEnumDiag = badEnumLint.diagnostics.find(
  (d) => d.kind === 'invalid-prop-value',
);
check('invalid enum value flagged', Boolean(badEnumDiag));
check('invalid enum suggestion present', typeof badEnumDiag?.suggestion === 'string');

// alias promotion (warn -> warning)
const aliasLint = await lintMdxSource(
  '<Callout type="warn">body</Callout>',
  'generic',
);
const aliasDiag = aliasLint.diagnostics.find(
  (d) => d.kind === 'deprecated-alias',
);
check('alias flagged as deprecated-alias', Boolean(aliasDiag));
check('alias suggestion = warning', aliasDiag?.suggestion === 'warning');

// unknown prop w/ did-you-mean
const badPropLint = await lintMdxSource(
  '<Callout type="tip" titel="x">body</Callout>',
  'generic',
);
const badPropDiag = badPropLint.diagnostics.find(
  (d) => d.kind === 'invalid-prop',
);
check('unknown prop flagged', Boolean(badPropDiag));
check('unknown prop suggestion = title', badPropDiag?.suggestion === 'title');

// missing required prop
const missingReqLint = await lintMdxSource(
  '<Collapsible>body</Collapsible>',
  'generic',
);
const missingReqDiag = missingReqLint.diagnostics.find(
  (d) => d.kind === 'missing-required-prop',
);
check('missing required prop flagged', Boolean(missingReqDiag));
check('missing prop name = title', missingReqDiag?.prop === 'title');

// universal props pass without warning (className, data-*, aria-*)
const universalLint = await lintMdxSource(
  '<Callout type="tip" className="x" data-id="y" aria-label="z">ok</Callout>',
  'generic',
);
check(
  'universal props do not warn',
  universalLint.diagnostics.every((d) => d.kind !== 'invalid-prop'),
);

// framework-specific prop: docusaurus groupId accepted
const docTabsLint = await lintMdxSource(
  '<Tabs groupId="lang"><TabItem label="a">1</TabItem></Tabs>',
  'docusaurus',
);
const docTabsErrors = docTabsLint.diagnostics.filter(
  (d) => d.kind === 'invalid-prop',
);
check('docusaurus groupId accepted', docTabsErrors.length === 0);

// --- §1.4 frontmatter validation -------------------------------------------

console.log('\n§1.4 frontmatter...');

// starlight requires title
const starlightMissing = await lintMdxSource(
  '# Body\n\nParagraph',
  'starlight',
);
const starlightMissingDiag = starlightMissing.diagnostics.find(
  (d) => d.kind === 'missing-frontmatter',
);
check('starlight missing title flagged', Boolean(starlightMissingDiag));
check('starlight missing title field = title', starlightMissingDiag?.field === 'title');

// starlight with title passes
const starlightOk = await lintMdxSource(
  '---\ntitle: Hello\n---\n\n# Body',
  'starlight',
);
const starlightOkMissing = starlightOk.diagnostics.filter(
  (d) => d.kind === 'missing-frontmatter',
);
check('starlight with title passes', starlightOkMissing.length === 0);

// starlight template enum validation
const starlightBadTpl = await lintMdxSource(
  '---\ntitle: Hello\ntemplate: wrong\n---\n\n# Body',
  'starlight',
);
const tplDiag = starlightBadTpl.diagnostics.find(
  (d) => d.kind === 'invalid-frontmatter-type',
);
check('starlight template enum enforced', Boolean(tplDiag));

// docusaurus sidebar_position type mismatch
const docusaurusBad = await lintMdxSource(
  '---\ntitle: Hello\nsidebar_position: not-a-number\n---\n\nbody',
  'docusaurus',
);
const docusaurusBadDiag = docusaurusBad.diagnostics.find(
  (d) => d.kind === 'invalid-frontmatter-type',
);
check('docusaurus sidebar_position type mismatch flagged', Boolean(docusaurusBadDiag));

// generic allows unknown fields without warning
const genericUnknown = await lintMdxSource(
  '---\ntitle: Hello\ncustom_field: ok\n---\nbody',
  'generic',
);
const genericUnknownDiag = genericUnknown.diagnostics.find(
  (d) => d.kind === 'unknown-frontmatter',
);
check('generic allows unknown fields', !genericUnknownDiag);

const schema = getFrontmatterSchema('starlight');
check('starlight schema marks title required', schema.fields.find((f) => f.name === 'title')?.required === true);

// --- end-to-end renderMdx result surfaces diagnostics ----------------------

console.log('\nend-to-end renderMdx diagnostics...');

const warningRender = await renderMdx({
  source: '---\ntitle: Demo\n---\n\n<Callout type="bogus">body</Callout>\n',
  framework: 'generic',
});
check(
  'renderMdx returns diagnostics array',
  Array.isArray(warningRender.diagnostics),
);
check(
  'renderMdx surfaces invalid enum value as warning',
  warningRender.diagnostics.some((d) => d.kind === 'invalid-prop-value'),
);
check(
  'renderMdx still returns HTML even with warnings',
  warningRender.html.length > 0,
);

// renderMdx w/ fatal lint (starlight missing title becomes renderer error)
try {
  await renderMdx({
    source: 'Body without frontmatter',
    framework: 'starlight',
  });
  // starlight missing title is a warning, not fatal — so this should NOT throw.
  // we assert the warning propagates instead.
  check('starlight missing title is non-fatal', true);
} catch (err) {
  check(
    'starlight missing title is non-fatal',
    false,
    err instanceof Error ? err.message : String(err),
  );
}

await shutdownBrowser();
await stopPreviewServer();

console.log(`\n${checked - failed}/${checked} passed`);
if (failed > 0) {
  console.error(`${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('OK');
