// plugins/render/src/html.ts
// sanitize compiled Safe Mode HTML into inert markup for preview & screenshots

import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toHtml } from 'hast-util-to-html';
import { sanitize, defaultSchema, type Schema } from 'hast-util-sanitize';

// MathML elements emitted by rehype-katex (mathml branch)
const MATHML_TAGS = [
  'math',
  'semantics',
  'annotation',
  'annotation-xml',
  'mrow',
  'mi',
  'mn',
  'mo',
  'ms',
  'mtext',
  'mspace',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mstyle',
  'merror',
  'mpadded',
  'mphantom',
  'mfenced',
  'menclose',
  'mtable',
  'mtr',
  'mtd',
  'mlabeledtr',
  'munder',
  'mover',
  'munderover',
  'mmultiscripts',
  'mprescripts',
  'none',
  'maction',
  'mglyph',
];

// SVG elements emitted by KaTeX stretchy delimiters & the shim icon set
const SVG_TAGS = [
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'rect',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'use',
  'symbol',
  'marker',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'title',
  'desc',
];

// build the Safe Mode allowlist from GitHub's defaults plus the extra element
// families the compiler legitimately emits (Shiki, KaTeX, diagram placeholders)
function buildSafeSchema(): Schema {
  const base = defaultSchema;
  return {
    ...base,
    // drop these entirely rather than unwrapping their children (mXSS vectors)
    strip: ['script', 'style', 'noscript', 'template'],
    tagNames: [...(base.tagNames ?? []), 'input', ...MATHML_TAGS, ...SVG_TAGS],
    protocols: {
      ...base.protocols,
      // allow data: images (KaTeX / inline assets); network stays blocked by CSP + route
      src: ['http', 'https', 'data'],
    },
    attributes: {
      ...base.attributes,
      // className / style / aria / data-* are safe & required across the tree
      '*': [
        ...((base.attributes && base.attributes['*']) ?? []),
        'className',
        'style',
        'role',
        'ariaHidden',
        'ariaLabel',
        'ariaLabelledBy',
        'ariaDescribedBy',
        'dataSourceLine',
        'data*',
      ],
      a: ['href', 'id', 'target', 'rel', 'ariaLabel', 'ariaDescribedBy'],
      img: ['src', 'alt', 'loading', 'width', 'height'],
      input: ['type', 'checked', 'disabled'],
      pre: ['tabIndex', 'style'],
      math: ['xmlns', 'display'],
      annotation: ['encoding'],
      svg: [
        'xmlns',
        'viewBox',
        'width',
        'height',
        'fill',
        'stroke',
        'strokeWidth',
        'strokeLineCap',
        'strokeLineJoin',
        'preserveAspectRatio',
        'focusable',
      ],
      path: ['d', 'fill', 'stroke', 'transform'],
      circle: ['cx', 'cy', 'r'],
      ellipse: ['cx', 'cy', 'rx', 'ry'],
      line: ['x1', 'y1', 'x2', 'y2'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
    },
    // keep KaTeX / shim ids stable; the default clobber-prefix would rewrite them
    clobber: [],
    clobberPrefix: '',
  };
}

const SAFE_SCHEMA = buildSafeSchema();

// parse w/ a spec-compliant parser, sanitize the tree, re-serialize
// parse+sanitize+serialize closes raw-text parser-differential (mXSS) gaps
export function sanitizeScreenshotHtml(bodyHtml: string): string {
  const tree = fromHtmlIsomorphic(bodyHtml, { fragment: true });
  const clean = sanitize(tree, SAFE_SCHEMA);
  return toHtml(clean);
}
