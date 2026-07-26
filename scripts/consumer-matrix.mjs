#!/usr/bin/env node
// scripts/consumer-matrix.mjs
// t6 gate: prove the packed artifact from clean consumers - NodeNext types

// both skipLibCheck ways, CSS subpaths, shipped examples, dev app & plugin

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const skipPluginCompat = args.includes('--skip-plugin-compat')
const skipBuild = args.includes('--skip-build')

function run(command, commandArgs, cwd, env = {})
{
  console.log(`\n$ ${command} ${commandArgs.join(' ')}  (cwd: ${cwd})`)
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
}

function readRootManifest()
{
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
  )
}

// enumerate export subpaths from the manifest exports map
function enumerateExports(manifest)
{
  const js = []
  const css = []
  for (const key of Object.keys(manifest.exports))
  {
    const subpath = `${manifest.name}${key.slice(1)}`
    if (key.endsWith('.css'))
    {
      css.push(subpath)
    }
    else
    {
      js.push(subpath)
    }
  }
  return { js, css }
}

// --- step 1: build + pack ----------------------------------------------------

function packRoot(workDir)
{
  if (!skipBuild)
  {
    run('npm', ['run', 'build'], REPO_ROOT)
  }
  const output = execFileSync('npm', ['pack', '--pack-destination', workDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  const tarballName = output.trim().split('\n').pop()
  const tarballPath = path.join(workDir, tarballName)
  console.log(`packed: ${tarballPath}`)
  return tarballPath
}

// --- step 2: NodeNext strict consumer -----------------------------------------

function buildImportProbe(jsSubpaths)
{
  const lines = [
    '// imports.ts',
    '// import every public JS export subpath & pin key API types',
    '',
  ]
  jsSubpaths.forEach((subpath, index) =>
  {
    lines.push(`import * as ns${index} from '${subpath}';`)
  })
  lines.push('')
  jsSubpaths.forEach((_, index) =>
  {
    lines.push(`void ns${index};`)
  })
  lines.push(
    '',
    'import {',
    '  compileSafe,',
    '  compileSafeDocument,',
    '  compileTrusted,',
    '  type CompilerConfig,',
    '  type DiagramBehavior,',
    '  type SafeDocument,',
    '  type SafeDocumentComponentSchema,',
    "} from 'mdx-forge/compiler';",
    "import type { Diagnostic } from 'mdx-forge/diagnostics';",
    'import {',
    '  COMPONENT_REGISTRY,',
    '  type ComponentRegistryEntry,',
    '  type FrameworkId,',
    "} from 'mdx-forge/components/registry';",
    "import { createImportRuntimeRequest, registerPreloadEntries, setPreloadEntries } from 'mdx-forge/browser';",
    "import type { FetchResult, ModuleDependency, PreloadEntry } from 'mdx-forge/browser';",
    '',
    '// F2 negative assertions: linked APIs must not degrade to `any`',
    'type NotAny<T> = 0 extends 1 & T ? never : true;',
    'const compileSafeIsTyped: NotAny<typeof compileSafe> = true;',
    'const compileSafeDocumentIsTyped: NotAny<typeof compileSafeDocument> = true;',
    'const compileTrustedIsTyped: NotAny<typeof compileTrusted> = true;',
    'const registryIsTyped: NotAny<typeof COMPONENT_REGISTRY> = true;',
    'void compileSafeIsTyped;',
    'void compileSafeDocumentIsTyped;',
    'void compileTrustedIsTyped;',
    'void registryIsTyped;',
    '',
    '// must ERROR when declarations resolve; `any` degradation would pass',
    '// @ts-expect-error compileSafe requires the CompilerConfig argument',
    "void compileSafe('# missing config');",
    '',
    'const config: CompilerConfig = {',
    "  documentPath: '/consumer.mdx',",
    "  diagramBehavior: 'code' satisfies DiagramBehavior,",
    '};',
    'void config;',
    '',
    'const componentSchema: SafeDocumentComponentSchema = {',
    "  props: { limit: { type: 'number', integer: true, minimum: 1 } },",
    "  children: 'optional',",
    '};',
    'const structured: Promise<SafeDocument> = compileSafeDocument(',
    "  '<Hotspots limit={10}>Current</Hotspots>',",
    '  { components: { Hotspots: componentSchema } }',
    ');',
    'void structured;',
    '',
    'const entries: PreloadEntry[] = [];',
    'registerPreloadEntries(entries);',
    'setPreloadEntries(entries);',
    'const dependency: ModuleDependency = {',
    "  specifier: 'dual-package',",
    "  kind: 'import',",
    "  runtimeRequest: createImportRuntimeRequest('dual-package'),",
    '};',
    'void dependency;',
    '',
    'const probe = (',
    '  diagnostic: Diagnostic,',
    '  entry: ComponentRegistryEntry,',
    '  framework: FrameworkId,',
    '  fetched: FetchResult',
    '): string =>',
    '  `${diagnostic.message}${entry.name}${framework}${fetched.fsPath}`;',
    'void probe;',
    ''
  )
  return lines.join('\n')
}

function nodenextTsconfig(skipLibCheck)
{
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2023', 'DOM'],
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck,
        noEmit: true,
        types: ['node'],
      },
      include: ['imports.ts'],
    },
    null,
    2
  )
}

// generate a probe that reports the exact subpath behind any runtime failure
function buildRuntimeResolutionProbe(jsSubpaths)
{
  return [
    '// runtime-resolution.mjs',
    '// dynamically import every public JS export from the packed artifact',
    '',
    `const subpaths = ${JSON.stringify(jsSubpaths, null, 2)};`,
    'const namespaces = [];',
    '',
    'for (const subpath of subpaths) {',
    '  try {',
    '    namespaces.push(await import(subpath));',
    '  } catch (error) {',
    '    throw new Error(`runtime import failed for "${subpath}"`, {',
    '      cause: error,',
    '    });',
    '  }',
    '}',
    '',
    'if (namespaces.length !== subpaths.length) {',
    '  throw new Error(',
    '    `expected ${subpaths.length} namespaces, received ${namespaces.length}`',
    '  );',
    '}',
    '',
    'for (const [index, namespace] of namespaces.entries()) {',
    "  if (Object.prototype.toString.call(namespace) !== '[object Module]') {",
    '    throw new Error(',
    '      `runtime import for "${subpaths[index]}" did not return an ESM namespace`',
    '    );',
    '  }',
    '}',
    '',
  ].join('\n')
}

function runRuntimeResolutionProbe(consumer, jsSubpaths)
{
  fs.writeFileSync(
    path.join(consumer, 'runtime-resolution.mjs'),
    buildRuntimeResolutionProbe(jsSubpaths)
  )
  run('node', ['runtime-resolution.mjs'], consumer)
  console.log(
    `NodeNext runtime resolution passed (${jsSubpaths.length} JS subpaths)`
  )
}

function runNodeNextLeg(workDir, tarballPath, jsSubpaths)
{
  console.log('\n=== consumer leg: NodeNext strict typecheck ===')
  const consumer = path.join(workDir, 'consumer-nodenext')
  fs.mkdirSync(consumer, { recursive: true })
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      { name: 'consumer-nodenext', private: true, type: 'module' },
      null,
      2
    )
  )
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      tarballPath,
      'react@^19',
      'react-dom@^19',
      'typescript@^6',
      '@types/react@^19',
      '@types/react-dom@^19',
      '@types/node@^26',
    ],
    consumer
  )
  runRuntimeResolutionProbe(consumer, jsSubpaths)
  fs.writeFileSync(
    path.join(consumer, 'imports.ts'),
    buildImportProbe(jsSubpaths)
  )

  for (const skipLibCheck of [false, true])
  {
    const configName = `tsconfig.skiplib-${skipLibCheck}.json`
    fs.writeFileSync(
      path.join(consumer, configName),
      nodenextTsconfig(skipLibCheck)
    )
    run('npx', ['tsc', '-p', configName], consumer)
    console.log(`NodeNext typecheck passed (skipLibCheck: ${skipLibCheck})`)
  }
  runStructuredRuntimeProbe(consumer)
  return consumer
}

function runStructuredRuntimeProbe(consumer)
{
  const source = [
    "import { compileSafeDocument } from 'mdx-forge/compiler';",
    '',
    'const result = await compileSafeDocument(',
    "  '# Architecture\\n\\n<Hotspots limit={10} />',",
    '  {',
    '    components: {',
    '      Hotspots: {',
    "        props: { limit: { type: 'number', integer: true } },",
    '      },',
    '    },',
    '  }',
    ');',
    "if (result.version !== 1 || result.root.type !== 'root') {",
    "  throw new Error('invalid safe-document result');",
    '}',
    'JSON.stringify(result);',
    '',
  ].join('\n')
  fs.writeFileSync(path.join(consumer, 'runtime.mjs'), source)
  run('node', ['runtime.mjs'], consumer)
  console.log('Structured runtime probe passed')
}

// --- step 3: CSS-aware consumer -----------------------------------------------

async function runCssLeg(workDir, tarballPath, cssSubpaths)
{
  console.log('\n=== consumer leg: CSS side-effect imports via esbuild ===')
  const consumer = path.join(workDir, 'consumer-css')
  fs.mkdirSync(consumer, { recursive: true })
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify(
      { name: 'consumer-css', private: true, type: 'module' },
      null,
      2
    )
  )
  run('npm', ['install', '--no-audit', '--no-fund', tarballPath], consumer)

  const entry = cssSubpaths.map((s) => `import '${s}';`).join('\n')
  fs.writeFileSync(path.join(consumer, 'entry.js'), `${entry}\n`)

  const { build } = await import('esbuild')
  const outDir = path.join(consumer, 'out')
  await build({
    entryPoints: [path.join(consumer, 'entry.js')],
    bundle: true,
    outdir: outDir,
    absWorkingDir: consumer,
    logLevel: 'error',
  })

  const cssOut = path.join(outDir, 'entry.css')
  const bundled = fs.readFileSync(cssOut, 'utf8')
  if (bundled.length < 1000)
  {
    throw new Error(`bundled CSS suspiciously small: ${bundled.length} bytes`)
  }
  console.log(
    `CSS leg passed: ${cssSubpaths.length} subpaths bundled to ${bundled.length} bytes`
  )
}

// --- step 4: shipped examples & dev app against the packed types ---------------

const CSS_AMBIENT = "declare module '*.css';\n"

function exampleTsconfig()
{
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2023', 'DOM'],
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: ['node'],
      },
      include: ['examples', 'css-ambient.d.ts'],
    },
    null,
    2
  )
}

function runExamplesLeg(nodenextConsumer)
{
  console.log('\n=== consumer leg: shipped skill examples ===')
  const examplesSrc = path.join(REPO_ROOT, 'skills', 'mdx-forge', 'examples')
  const examplesDest = path.join(nodenextConsumer, 'examples')
  fs.cpSync(examplesSrc, examplesDest, { recursive: true })
  fs.writeFileSync(path.join(nodenextConsumer, 'css-ambient.d.ts'), CSS_AMBIENT)
  fs.writeFileSync(
    path.join(nodenextConsumer, 'tsconfig.examples.json'),
    exampleTsconfig()
  )
  run('npx', ['tsc', '-p', 'tsconfig.examples.json'], nodenextConsumer)
  console.log('Shipped examples compile against the packed artifact.')
}

function devAppTsconfig()
{
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2023', 'DOM', 'DOM.Iterable'],
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
        noEmit: true,
        types: ['node', 'react'],
        paths: {
          '@forge/*': ['./node_modules/mdx-forge/dist/types/*'],
        },
      },
      include: ['dev', 'css-ambient.d.ts'],
    },
    null,
    2
  )
}

function runDevAppLeg(nodenextConsumer)
{
  console.log('\n=== consumer leg: dev app against packed declarations ===')
  const devSrc = path.join(REPO_ROOT, 'dev')
  const devDest = path.join(nodenextConsumer, 'dev')
  // exclude repo-tooling files: vite config needs dev-only deps & the repo
  // tsconfig maps @forge/* to source instead of the packed artifact
  const excluded = new Set(['tsconfig.json', 'vite.config.ts'])
  fs.cpSync(devSrc, devDest, {
    recursive: true,
    filter: (src) => !excluded.has(path.basename(src)),
  })
  fs.writeFileSync(
    path.join(nodenextConsumer, 'tsconfig.dev.json'),
    devAppTsconfig()
  )
  run('npx', ['tsc', '-p', 'tsconfig.dev.json'], nodenextConsumer)
  console.log('Dev app compiles against the packed declarations.')
}

// --- steps 5-6: plugin compatibility legs & manifest assertions ----------------

function runPluginLegs(tarballPath)
{
  console.log('\n=== consumer leg: nested render plugin (min + current) ===')
  run(
    'node',
    ['scripts/plugin-compat.mjs', '--tarball', tarballPath],
    REPO_ROOT
  )
}

// --- main ----------------------------------------------------------------------

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdx-forge-matrix-'))
console.log(`consumer-matrix work dir: ${workDir}`)

try
{
  const manifest = readRootManifest()
  const { js, css } = enumerateExports(manifest)
  console.log(
    `export subpaths: ${js.length} JS, ${css.length} CSS (from exports map)`
  )

  const tarballPath = packRoot(workDir)
  const nodenextConsumer = runNodeNextLeg(workDir, tarballPath, js)
  await runCssLeg(workDir, tarballPath, css)
  runExamplesLeg(nodenextConsumer)
  runDevAppLeg(nodenextConsumer)

  if (skipPluginCompat)
  {
    console.log('\nSkipping plugin-compat legs (--skip-plugin-compat).')
  }
  else
  {
    runPluginLegs(tarballPath)
  }

  console.log('\nconsumer-matrix: all legs passed.')
}
finally
{
  fs.rmSync(workDir, { recursive: true, force: true })
}
