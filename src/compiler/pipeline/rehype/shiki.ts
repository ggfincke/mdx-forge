// src/compiler/pipeline/rehype/shiki.ts
// syntax highlighting w/ core Shiki (on-demand grammars, block-result cache)
// + fence meta parsing (line numbers, highlighting, title)

import { visit } from 'unist-util-visit';
import type { Root, Element, Text, ElementContent } from 'hast';
import {
  createHighlighterCore,
  createCssVariablesTheme,
  type HighlighterCore,
  type LanguageRegistration,
  type ShikiTransformer,
} from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';
import { LRUCache } from '../../../browser/internal/lru-cache';
import {
  PREVIEW_CODEBLOCK,
  PREVIEW_CODEBLOCK_TITLE,
  PREVIEW_CODEBLOCK_SHIKI,
  PREVIEW_CODEBLOCK_LINE_NUMBERS,
  DIFF_ADD,
  DIFF_REMOVE,
} from '../../internal/css-classes';

// per-language grammar loaders; static specifiers keep bundlers code-splitting
type LangModule = { default: LanguageRegistration[] };
const LANGUAGE_LOADERS: Record<string, () => Promise<LangModule>> = {
  // web fundamentals
  typescript: () => import('@shikijs/langs/typescript'),
  javascript: () => import('@shikijs/langs/javascript'),
  tsx: () => import('@shikijs/langs/tsx'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  jsonc: () => import('@shikijs/langs/jsonc'),
  css: () => import('@shikijs/langs/css'),
  scss: () => import('@shikijs/langs/scss'),
  less: () => import('@shikijs/langs/less'),
  html: () => import('@shikijs/langs/html'),
  vue: () => import('@shikijs/langs/vue'),
  svelte: () => import('@shikijs/langs/svelte'),

  // shell & scripting
  bash: () => import('@shikijs/langs/bash'),
  shell: () => import('@shikijs/langs/shell'),
  powershell: () => import('@shikijs/langs/powershell'),

  // documentation & data
  markdown: () => import('@shikijs/langs/markdown'),
  mdx: () => import('@shikijs/langs/mdx'),
  yaml: () => import('@shikijs/langs/yaml'),
  toml: () => import('@shikijs/langs/toml'),
  xml: () => import('@shikijs/langs/xml'),
  graphql: () => import('@shikijs/langs/graphql'),
  sql: () => import('@shikijs/langs/sql'),
  regex: () => import('@shikijs/langs/regex'),

  // systems programming
  c: () => import('@shikijs/langs/c'),
  cpp: () => import('@shikijs/langs/cpp'),
  rust: () => import('@shikijs/langs/rust'),
  go: () => import('@shikijs/langs/go'),
  zig: () => import('@shikijs/langs/zig'),

  // JVM languages
  java: () => import('@shikijs/langs/java'),
  kotlin: () => import('@shikijs/langs/kotlin'),
  scala: () => import('@shikijs/langs/scala'),

  // apple ecosystem
  swift: () => import('@shikijs/langs/swift'),
  'objective-c': () => import('@shikijs/langs/objective-c'),

  // scripting languages
  python: () => import('@shikijs/langs/python'),
  ruby: () => import('@shikijs/langs/ruby'),
  php: () => import('@shikijs/langs/php'),
  lua: () => import('@shikijs/langs/lua'),
  perl: () => import('@shikijs/langs/perl'),
  r: () => import('@shikijs/langs/r'),

  // .NET
  csharp: () => import('@shikijs/langs/csharp'),
  fsharp: () => import('@shikijs/langs/fsharp'),

  // functional
  haskell: () => import('@shikijs/langs/haskell'),
  elixir: () => import('@shikijs/langs/elixir'),
  clojure: () => import('@shikijs/langs/clojure'),

  // devops & config
  dockerfile: () => import('@shikijs/langs/dockerfile'),
  nginx: () => import('@shikijs/langs/nginx'),
  ini: () => import('@shikijs/langs/ini'),

  // other
  diff: () => import('@shikijs/langs/diff'),
  latex: () => import('@shikijs/langs/latex'),
};

// languages rendered w/o any grammar (Shiki treats these as plain)
const PLAINTEXT_LANGUAGES = new Set(['text', 'plaintext', 'txt', 'plain']);

// create CSS variables theme for dynamic theming (outputs CSS vars instead of hardcoded colors)
const cssVariablesTheme = createCssVariablesTheme({
  name: 'css-variables',
  variablePrefix: '--shiki-',
  variableDefaults: {},
  fontStyle: true,
});

// build per-block transformer adding diff classes (splits source once, not per line)
const createDiffTransformer = (code: string): ShikiTransformer => {
  const lines = code.split('\n');
  return {
    name: 'diff-highlight',
    line(hast, lineNumber) {
      const lineText = lines[lineNumber - 1] || '';

      if (lineText.startsWith('+')) {
        this.addClassToHast(hast, DIFF_ADD);
      } else if (lineText.startsWith('-')) {
        this.addClassToHast(hast, DIFF_REMOVE);
      }
    },
  };
};

// cached core highlighter instance (no grammars until a fence needs one)
let highlighterPromise: Promise<HighlighterCore> | null = null;

// promise-deduped per-language grammar loads; false = unavailable
const languageLoads = new Map<string, Promise<boolean>>();

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [cssVariablesTheme],
      langs: [],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    });
  }
  return highlighterPromise;
}

// load a grammar once per process; concurrent requests share the same promise
function ensureLanguage(
  highlighter: HighlighterCore,
  lang: string
): Promise<boolean> {
  let pending = languageLoads.get(lang);
  if (!pending) {
    const loader = LANGUAGE_LOADERS[lang];
    pending = loader
      ? loader().then(
          async (mod) => {
            await highlighter.loadLanguage(...mod.default);
            return true;
          },
          () => false
        )
      : Promise.resolve(false);
    languageLoads.set(lang, pending);
  }
  return pending;
}

// bounded block-result cache; stores immutable templates cloned on every use
// key = schema/theme/lang/code; theme & transformers derive from lang + code
const CACHE_KEY_SEPARATOR = '\u0000';
const CACHE_SCHEMA = 'shiki-block-v1';
const HIGHLIGHT_CACHE_MAX_ENTRIES = 500;
const HIGHLIGHT_CACHE_MAX_BYTES = 8 * 1024 * 1024;

const highlightCache = new LRUCache<string, Root>({
  maxEntries: HIGHLIGHT_CACHE_MAX_ENTRIES,
  maxMemoryBytes: HIGHLIGHT_CACHE_MAX_BYTES,
  estimateSize: (value) => JSON.stringify(value).length,
});

// test/HMR hooks; not part of the public compiler API
export function __highlightCacheStats(): { entries: number; bytes: number } {
  return { entries: highlightCache.size, bytes: highlightCache.memoryBytes };
}

export function __resetHighlightState(): void {
  highlightCache.clear();
  languageLoads.clear();
  highlighterPromise = null;
  highlightCache.updateSettings({
    maxEntries: HIGHLIGHT_CACHE_MAX_ENTRIES,
    maxMemoryBytes: HIGHLIGHT_CACHE_MAX_BYTES,
  });
}

export function __setHighlightCacheLimits(limits: {
  maxEntries?: number;
  maxMemoryBytes?: number;
}): void {
  highlightCache.updateSettings(limits);
}

// tokenize a block to a reusable hast template
function highlightToTemplate(
  highlighter: HighlighterCore,
  code: string,
  lang: string
): Root {
  return highlighter.codeToHast(code, {
    lang,
    theme: 'css-variables',
    transformers: lang === 'diff' ? [createDiffTransformer(code)] : [],
  }) as Root;
}

// highlighted children for a block; cached per (lang, code) & cloned on use
function getHighlightedChildren(
  highlighter: HighlighterCore,
  code: string,
  lang: string
): ElementContent[] {
  // plaintext fast path: trivial tokenization, no grammar, no cache entry
  if (lang === 'text') {
    return highlightToTemplate(highlighter, code, 'text')
      .children as ElementContent[];
  }

  const key = [CACHE_SCHEMA, 'css-variables', lang, code].join(
    CACHE_KEY_SEPARATOR
  );
  let template = highlightCache.get(key);
  if (!template) {
    template = highlightToTemplate(highlighter, code, lang);
    highlightCache.set(key, template);
  }

  // clone so downstream plugin/document mutation never reaches the template
  return structuredClone(template).children as ElementContent[];
}

// code meta parsed from fence info: ```ts showLineNumbers {1,3-5} title="example.ts"
interface CodeMeta {
  showLineNumbers: boolean;
  highlightLines: Set<number>;
  title?: string;
}

// parse meta string from code fence; ranges are clamped to the block's lines
function parseMeta(meta: string | undefined, lineCount: number): CodeMeta {
  const result: CodeMeta = {
    showLineNumbers: false,
    highlightLines: new Set(),
    title: undefined,
  };

  if (!meta) {
    return result;
  }

  // showLineNumbers flag
  result.showLineNumbers = /\bshowLineNumbers\b/i.test(meta);

  // {1,3-5} line highlighting
  const lineMatch = meta.match(/\{([^}]+)\}/);
  if (lineMatch) {
    result.highlightLines = parseLineRanges(lineMatch[1], lineCount);
  }

  // title="..." or title='...'
  const titleMatch = meta.match(/title=["']([^"']+)["']/);
  if (titleMatch) {
    result.title = titleMatch[1];
  }

  return result;
}

// parse line ranges like "1,3-5,8" into a bounded Set of line numbers
// clamps to [1, maxLine]; reversed or fully out-of-range parts are dropped
function parseLineRanges(rangeStr: string, maxLine: number): Set<number> {
  const lines = new Set<number>();
  if (!Number.isFinite(maxLine) || maxLine < 1) {
    return lines;
  }
  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) {
        continue;
      }
      const from = Math.max(1, start);
      const to = Math.min(maxLine, end);
      for (let i = from; i <= to; i++) {
        lines.add(i);
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= maxLine) {
        lines.add(num);
      }
    }
  }
  return lines;
}

// read fence meta from its real HAST location (codeChild.data.meta set by
// remark-rehype / MDX); dataMeta property carries it across rehype-raw
function getFenceMeta(pre: Element, code: Element): string {
  const dataMeta = (code.data as { meta?: unknown } | undefined)?.meta;
  if (typeof dataMeta === 'string') {
    return dataMeta;
  }
  const propMeta =
    code.properties?.dataMeta ??
    code.properties?.['data-meta'] ??
    pre.properties?.dataMeta ??
    pre.properties?.['data-meta'];
  return typeof propMeta === 'string' ? propMeta : '';
}

// count displayed lines of a fence (ignores the trailing newline)
function countCodeLines(code: string): number {
  return code.replace(/\n$/, '').split('\n').length;
}

// extract language from class name (e.g., "language-typescript" -> "typescript")
function extractLanguage(className: unknown): string | null {
  if (!className) {
    return null;
  }
  const classes = Array.isArray(className) ? className : [className];
  for (const cls of classes) {
    const str = String(cls);
    if (str.startsWith('language-')) {
      return str.replace('language-', '');
    }
  }
  return null;
}

// language alias mapping (short names to Shiki-supported canonical names)
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  cs: 'csharp',
  fs: 'fsharp',
  rs: 'rust',
  kt: 'kotlin',
  md: 'markdown',
  // text & plaintext map to fallback (handled separately)
};

const DIAGRAM_LANGUAGE_CLASSES = new Set([
  'language-mermaid',
  'language-plantuml',
  'language-dot',
  'language-graphviz',
]);

// resolve language alias to canonical name
function resolveLanguageAlias(lang: string): string {
  return LANGUAGE_ALIASES[lang] || lang;
}

// rehype plugin for Shiki syntax highlighting
export default function rehypeShiki() {
  return async (tree: Root) => {
    const nodesToProcess: Array<{
      node: Element;
      parent: Element;
      index: number;
      lang: string;
      code: string;
      meta: CodeMeta;
      sourceLine: string | undefined;
    }> = [];

    // first pass: collect code blocks
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre') {
        return;
      }
      if (typeof index !== 'number' || !parent) {
        return;
      }

      const codeChild = node.children[0];
      if (
        !codeChild ||
        codeChild.type !== 'element' ||
        codeChild.tagName !== 'code'
      ) {
        return;
      }

      // skip diagram blocks (handle via diagram placeholder plugins)
      const className = codeChild.properties?.className;
      const classNames = Array.isArray(className) ? className : [];
      if (classNames.some((c) => DIAGRAM_LANGUAGE_CLASSES.has(String(c)))) {
        return;
      }

      // extract language & code content
      const lang = extractLanguage(className);
      const textNode = codeChild.children[0] as Text | undefined;
      const code = textNode?.type === 'text' ? textNode.value : '';

      if (!code.trim()) {
        return;
      }

      const meta = parseMeta(
        getFenceMeta(node, codeChild),
        countCodeLines(code)
      );
      const sourceLine =
        typeof node.properties?.['data-source-line'] === 'string'
          ? (node.properties?.['data-source-line'] as string)
          : undefined;

      nodesToProcess.push({
        node,
        parent: parent as Element,
        index,
        lang: lang || 'plaintext',
        code,
        meta,
        sourceLine,
      });
    });

    // early return: skip highlighter init if no code blocks
    if (nodesToProcess.length === 0) {
      return;
    }

    // lazy init core highlighter only when code blocks exist (no grammars yet)
    const highlighter = await getHighlighter();

    // second pass: apply highlighting
    for (const {
      parent,
      index,
      lang,
      code,
      meta,
      sourceLine,
    } of nodesToProcess) {
      try {
        // resolve alias first (e.g., 'js' -> 'javascript', 'ts' -> 'typescript')
        const resolvedLang = resolveLanguageAlias(lang);

        // demand-load the grammar; plaintext/unknown languages skip Shiki grammars
        let highlightLang = 'text';
        if (
          !PLAINTEXT_LANGUAGES.has(resolvedLang) &&
          (await ensureLanguage(highlighter, resolvedLang))
        ) {
          highlightLang = resolvedLang;
        }

        // generate hast w/ CSS variables (themeable via external CSS)
        const hastChildren = getHighlightedChildren(
          highlighter,
          code,
          highlightLang
        );

        // create wrapper w/ code block
        const wrapper = createCodeBlockWrapper({
          hastChildren,
          lang,
          meta,
          code,
          sourceLine,
        });

        parent.children[index] = wrapper;
      } catch {
        // on error, leave original code block
      }
    }
  };
}

// create wrapper element w/ code block, title bar, etc
function createCodeBlockWrapper(options: {
  hastChildren: ElementContent[];
  lang: string;
  meta: CodeMeta;
  code: string;
  sourceLine?: string;
}): Element {
  const { hastChildren, lang, meta, code, sourceLine } = options;

  const children: ElementContent[] = [];

  // optional title bar
  if (meta.title) {
    children.push({
      type: 'element',
      tagName: 'div',
      properties: { className: [PREVIEW_CODEBLOCK_TITLE] },
      children: [{ type: 'text', value: meta.title }],
    });
  }

  // code container w/ CSS variable-based highlighting
  const codeContainer: Element = {
    type: 'element',
    tagName: 'div',
    properties: {
      className: [
        PREVIEW_CODEBLOCK_SHIKI,
        meta.showLineNumbers ? PREVIEW_CODEBLOCK_LINE_NUMBERS : '',
      ].filter(Boolean),
      'data-language': lang,
      // for copy button
      'data-code': code,
    },
    children: [
      // single themed version using CSS variables
      ...hastChildren,
    ],
  };

  // apply line highlighting classes if specified
  if (meta.highlightLines.size > 0) {
    codeContainer.properties!['data-highlight-lines'] = Array.from(
      meta.highlightLines
    ).join(',');
  }

  children.push(codeContainer);

  const wrapper: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: [PREVIEW_CODEBLOCK] },
    children,
  };

  // expose the title so wrappers (e.g. CodeGroup) can derive tab labels
  if (meta.title) {
    wrapper.properties!['data-title'] = meta.title;
  }

  if (sourceLine) {
    wrapper.properties!['data-source-line'] = sourceLine;
  }

  return wrapper;
}
