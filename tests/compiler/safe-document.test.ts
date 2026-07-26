// tests/compiler/safe-document.test.ts
// protect the structured compiler's public data & trust-boundary contracts

import { describe, expect, it, vi } from 'vitest';
import { compileSafeDocument } from '../../src/compiler/safe-document/compile';
import type {
  SafeDocumentCompileOptions,
  SafeDocumentNode,
} from '../../src/compiler/safe-document/types';
import { DIAGNOSTIC_CODES } from '../../src/diagnostics/types';
import { safeMatter } from '../../src/internal/frontmatter';

const trustedBoundarySpies = vi.hoisted(() => ({
  compileTrusted: vi.fn(),
  generateComponentImports: vi.fn(),
}));

vi.mock('../../src/compiler/trusted/compile', () => ({
  compileTrusted: trustedBoundarySpies.compileTrusted,
}));

vi.mock('../../src/compiler/trusted/component-mapper', () => ({
  generateComponentImports: trustedBoundarySpies.generateComponentImports,
}));

const PANEL_SCHEMA = {
  components: {
    Panel: {
      children: 'required',
      props: {
        active: { type: 'boolean' },
        config: {
          type: 'object',
          properties: {
            flags: {
              type: 'array',
              items: { type: 'boolean' },
            },
            mode: { type: 'string', enum: ['tree', 'graph'] },
          },
          additionalProperties: false,
        },
        count: { type: 'number', integer: true },
        title: { type: 'string' },
      },
      requiredProps: ['title'],
    },
  },
} as const satisfies SafeDocumentCompileOptions;

function findNodes(
  nodes: readonly SafeDocumentNode[],
  predicate: (node: SafeDocumentNode) => boolean
): SafeDocumentNode[] {
  const matches: SafeDocumentNode[] = [];
  for (const node of nodes) {
    if (predicate(node)) {
      matches.push(node);
    }
    if ('children' in node) {
      matches.push(...findNodes(node.children, predicate));
    }
  }
  return matches;
}

function nestedComponentSource(depth: number): string {
  return `${'<Box>\n'.repeat(depth)}inside\n${'</Box>\n'.repeat(depth)}`;
}

function paragraphSource(count: number): string {
  return Array.from({ length: count }, (_, index) => `paragraph ${index}`).join(
    '\n\n'
  );
}

describe('compileSafeDocument()', () => {
  it('returns typed ordered data, canonical frontmatter & exact ranges', async () => {
    const source = [
      '---',
      'title: Architecture',
      'draft: false',
      'count: 2',
      'published: 2026-07-12',
      'meta:',
      '  owners:',
      '    - docs',
      '---',
      '# Overview',
      '',
      'Read **the [guide][ref]**.',
      '',
      '[ref]: https://first.example/docs "First"',
      '[ref]: https://second.example/docs "Second"',
      '',
      '<Panel title="Map" count={2} active={true} config={{mode: "tree", flags: [true, false]}}>',
      'Inside *content*.',
      '</Panel>',
    ].join('\n');

    const document = await compileSafeDocument(source, PANEL_SCHEMA);

    expect(document.version).toBe(1);
    expect(document.frontmatter).toEqual({
      count: 2,
      draft: false,
      meta: { owners: ['docs'] },
      published: '2026-07-12T00:00:00.000Z',
      title: 'Architecture',
    });
    expect(
      document.root.children.map((node) =>
        node.type === 'element'
          ? node.tag
          : node.type === 'component'
            ? node.name
            : node.type
      )
    ).toEqual(['h1', 'p', 'Panel']);
    expect(
      findNodes(
        document.root.children,
        (node) => node.type === 'element' && node.tag === 'a'
      )
    ).toMatchObject([
      {
        props: { href: 'https://first.example/docs', title: 'First' },
      },
    ]);
    expect(document.root.children[2]).toMatchObject({
      type: 'component',
      name: 'Panel',
      props: {
        active: true,
        config: { flags: [true, false], mode: 'tree' },
        count: 2,
        title: 'Map',
      },
      children: [
        {
          type: 'element',
          tag: 'p',
          children: [
            { type: 'text', value: 'Inside ' },
            {
              type: 'element',
              tag: 'em',
              children: [{ type: 'text', value: 'content' }],
            },
            { type: 'text', value: '.' },
          ],
        },
      ],
    });
    expect(document.root.source).toEqual({
      start: { line: 10, column: 1, offset: source.indexOf('# Overview') },
      end: { line: 19, column: 9, offset: source.length },
    });
    expect(document.root.children[2]?.source).toEqual({
      start: { line: 17, column: 1, offset: source.indexOf('<Panel') },
      end: { line: 19, column: 9, offset: source.length },
    });
    expect(document.diagnostics).toEqual([]);
    expect(JSON.parse(JSON.stringify(document))).toEqual(document);

    const malformed = await compileSafeDocument('# Valid\n\n<Broken');
    expect(malformed.root.children).toEqual([]);
    expect(malformed.diagnostics).toMatchObject([
      {
        code: DIAGNOSTIC_CODES.MDX_PARSE_ERROR,
        range: {
          start: { line: 3, column: 8, offset: 16 },
          end: { line: 3, column: 8, offset: 16 },
        },
      },
    ]);

    const bomSource = '\ufeff# BOM';
    const bomDocument = await compileSafeDocument(bomSource);
    expect(bomDocument.root.source).toEqual({
      start: { line: 1, column: 2, offset: 1 },
      end: { line: 1, column: 7, offset: bomSource.length },
    });
    expect(bomDocument.root.children[0]?.source).toEqual(
      bomDocument.root.source
    );
    await expect(
      compileSafeDocument(42 as unknown as string)
    ).rejects.toThrowError(new TypeError('source must be a string'));
  });

  it('rejects executable data, schema bypasses & unsafe frontmatter', async () => {
    const sentinel = '__mdxForgeSafeDocumentExecuted';
    const runtime = globalThis as Record<string, unknown>;
    const previousSentinel = Object.getOwnPropertyDescriptor(runtime, sentinel);
    Object.defineProperty(runtime, sentinel, {
      configurable: true,
      value: false,
      writable: true,
    });
    // keep export + 1 expr + 1 handler shape; rest share unsupported-expression sink
    const executableCases = [
      'export const value = 1',
      '<Widget value={identifier} />',
      `<Unknown onClick={() => { globalThis.${sentinel} = true }} />`,
    ];
    const options = {
      components: {
        Widget: { props: { value: { type: 'string' } } },
      },
      unknownComponents: 'inert',
    } as const satisfies SafeDocumentCompileOptions;

    try {
      for (const source of executableCases) {
        const document = await compileSafeDocument(source, options);
        const diagnostic = document.diagnostics.find(
          (diagnostic) =>
            diagnostic.code === DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE
        );
        expect(diagnostic, source).toMatchObject({
          code: DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
          severity: 'error',
          source: 'mdx-forge',
          range: {
            start: { line: 1 },
            end: { line: 1 },
          },
          data: expect.any(Object),
        });
        expect(diagnostic?.ruleId, source).toMatch(
          /^safe-document\/unsupported-(expression|syntax)$/
        );
        expect(JSON.stringify(document.root)).not.toContain(sentinel);
        if (source.startsWith('<Widget')) {
          expect(
            findNodes(
              document.root.children,
              (node) => node.type === 'component' && node.name === 'Widget'
            ),
            source
          ).toMatchObject([{ props: {} }]);
        }
      }
      expect(runtime[sentinel]).toBe(false);
    } finally {
      if (previousSentinel) {
        Object.defineProperty(runtime, sentinel, previousSentinel);
      } else {
        delete runtime[sentinel];
      }
    }

    const forbiddenMatter = [
      '---',
      '"__proto__": poisoned',
      'constructor: poisoned',
      'prototype: poisoned',
      'safe: kept',
      '---',
      '# Body',
    ].join('\n');
    expect(safeMatter(forbiddenMatter).data).toEqual({ safe: 'kept' });
    const rejectedMatter = await compileSafeDocument(forbiddenMatter);
    expect(rejectedMatter.frontmatter).toEqual({});
    expect(rejectedMatter.diagnostics).toMatchObject([
      { code: DIAGNOSTIC_CODES.INVALID_FRONTMATTER },
    ]);

    const previousRawHtml = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'rawHtml'
    );
    const previousUnknownComponents = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'unknownComponents'
    );
    const previousComponents = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'components'
    );
    const previousType = Object.getOwnPropertyDescriptor(
      Object.prototype,
      'type'
    );
    try {
      Object.defineProperty(Object.prototype, 'rawHtml', {
        configurable: true,
        value: 'allow',
        writable: true,
      });
      Object.defineProperty(Object.prototype, 'unknownComponents', {
        configurable: true,
        value: 'inert',
        writable: true,
      });
      Object.defineProperty(Object.prototype, 'components', {
        configurable: true,
        value: {
          Widget: { props: { value: { type: 'string' } } },
        },
        writable: true,
      });
      const pollutedOptions = await compileSafeDocument(
        [
          '<strong>must stay text</strong>',
          '<Widget value="secret" />',
          '<Mystery />',
        ].join('\n\n')
      );
      expect(JSON.stringify(pollutedOptions.root)).not.toContain('strong');
      expect(JSON.stringify(pollutedOptions.root)).not.toContain('secret');
      expect(
        findNodes(
          pollutedOptions.root.children,
          (node) =>
            node.type === 'component' || node.type === 'unknownComponent'
        )
      ).toEqual([]);
      expect(pollutedOptions.diagnostics).toMatchObject([
        { code: DIAGNOSTIC_CODES.UNSUPPORTED_RAW_HTML },
        {
          code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
          severity: 'error',
        },
        {
          code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
          severity: 'error',
        },
      ]);

      Object.defineProperty(Object.prototype, 'type', {
        configurable: true,
        value: 'string',
        writable: true,
      });
      await expect(
        compileSafeDocument('<Widget value="hidden" />', {
          components: {
            Widget: {
              props: {
                value: {} as { type: 'string' },
              },
            },
          },
        })
      ).rejects.toThrow(TypeError);
    } finally {
      if (previousType) {
        Object.defineProperty(Object.prototype, 'type', previousType);
      } else {
        delete (Object.prototype as Record<string, unknown>).type;
      }
      if (previousComponents) {
        Object.defineProperty(
          Object.prototype,
          'components',
          previousComponents
        );
      } else {
        delete (Object.prototype as Record<string, unknown>).components;
      }
      if (previousUnknownComponents) {
        Object.defineProperty(
          Object.prototype,
          'unknownComponents',
          previousUnknownComponents
        );
      } else {
        delete (Object.prototype as Record<string, unknown>).unknownComponents;
      }
      if (previousRawHtml) {
        Object.defineProperty(Object.prototype, 'rawHtml', previousRawHtml);
      } else {
        delete (Object.prototype as Record<string, unknown>).rawHtml;
      }
    }

    let rawHtmlReads = 0;
    const changingOptions = {};
    Object.defineProperty(changingOptions, 'rawHtml', {
      enumerable: true,
      get: () => (++rawHtmlReads <= 2 ? 'reject' : 'allow'),
    });
    await expect(
      compileSafeDocument(
        '<strong>must not cross an accessor boundary</strong>',
        changingOptions as SafeDocumentCompileOptions
      )
    ).rejects.toThrow(TypeError);
    expect(rawHtmlReads).toBe(0);

    let schemaTypeReads = 0;
    const changingSchema = {};
    Object.defineProperty(changingSchema, 'type', {
      enumerable: true,
      get: () => (++schemaTypeReads === 1 ? 'number' : undefined),
    });
    await expect(
      compileSafeDocument('<Widget value="not a number" />', {
        components: {
          Widget: {
            props: {
              value: changingSchema as { type: 'number' },
            },
          },
        },
      })
    ).rejects.toThrow(TypeError);
    expect(schemaTypeReads).toBe(0);

    const unknown = await compileSafeDocument(
      '<Unknown plain="discarded" action={run()} />',
      { unknownComponents: 'inert' }
    );
    expect(unknown.root.children).toMatchObject([
      { type: 'unknownComponent', name: 'Unknown' },
    ]);
    expect(unknown.root.children[0]).not.toHaveProperty('props');
    expect(unknown.diagnostics.map(({ code }) => code)).toEqual([
      DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
      DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
    ]);
  });

  it('enforces URL, DOM attribute, raw HTML & void-element policies', async () => {
    const allowUrl = vi.fn(() => true);
    const allowed = await compileSafeDocument(
      [
        '[docs](https://example.com/docs)',
        '',
        '<LinkCard href="https://example.com/card" label="Card" />',
        '',
        '<strong>safe raw element</strong>',
        '',
        '<img src="https://example.com/image.png" alt="diagram">discarded</img>',
        '',
        '<a href="https://example.com/raw" title="Raw" data-extra="x" onClick={() => 1}>raw link</a>',
      ].join('\n'),
      {
        allowUrl,
        components: {
          LinkCard: {
            props: {
              href: { type: 'string', format: 'url' },
              label: { type: 'string' },
            },
            requiredProps: ['href', 'label'],
          },
        },
        rawHtml: 'allow',
      }
    );
    expect(allowUrl).toHaveBeenCalledWith('https://example.com/docs', {
      kind: 'element',
      name: 'a',
      prop: 'href',
    });
    expect(allowUrl).toHaveBeenCalledWith('https://example.com/card', {
      kind: 'component',
      name: 'LinkCard',
      prop: 'href',
    });
    expect(allowUrl).toHaveBeenCalledWith('https://example.com/image.png', {
      kind: 'element',
      name: 'img',
      prop: 'src',
    });
    expect(JSON.stringify(allowed.root)).toContain('https://example.com/docs');
    expect(JSON.stringify(allowed.root)).toContain('https://example.com/card');
    expect(JSON.stringify(allowed.root)).toContain('safe raw element');
    expect(
      findNodes(
        allowed.root.children,
        (node) => node.type === 'component' && node.name === 'LinkCard'
      )
    ).toMatchObject([
      {
        props: { href: 'https://example.com/card', label: 'Card' },
      },
    ]);
    expect(JSON.stringify(allowed.root)).not.toContain('data-extra');
    expect(JSON.stringify(allowed.root)).not.toContain('discarded');
    expect(JSON.stringify(allowed.root)).not.toContain('onClick');
    expect(
      findNodes(
        allowed.root.children,
        (node) => node.type === 'element' && node.tag === 'img'
      )
    ).toMatchObject([{ children: [] }]);
    expect(allowed.diagnostics.map(({ code }) => code)).toEqual([
      DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
      DIAGNOSTIC_CODES.UNSUPPORTED_ATTRIBUTE,
      DIAGNOSTIC_CODES.UNSUPPORTED_ATTRIBUTE,
    ]);

    const nonBooleanCallback = await compileSafeDocument(
      '<LinkCard href="https://example.com/card" />',
      {
        allowUrl: () => 1 as unknown as boolean,
        components: {
          LinkCard: {
            props: { href: { type: 'string', format: 'url' } },
            requiredProps: ['href'],
          },
        },
      }
    );
    expect(JSON.stringify(nonBooleanCallback.root)).not.toContain(
      'https://example.com/card'
    );
    expect(nonBooleanCallback.diagnostics.map(({ code }) => code)).toEqual([
      DIAGNOSTIC_CODES.UNSAFE_URL,
      DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP,
    ]);

    const unsafe = await compileSafeDocument(
      String.raw`[script](javascript:alert(1))

<LinkCard href="\\server\share" />`,
      {
        components: {
          LinkCard: {
            props: { href: { type: 'string', format: 'url' } },
            requiredProps: ['href'],
          },
        },
      }
    );
    expect(JSON.stringify(unsafe.root)).not.toContain('javascript:');
    expect(JSON.stringify(unsafe.root)).not.toContain('server');
    expect(unsafe.diagnostics.map(({ code }) => code)).toEqual([
      DIAGNOSTIC_CODES.UNSAFE_URL,
      DIAGNOSTIC_CODES.UNSAFE_URL,
      DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP,
    ]);

    const unsafeNested = await compileSafeDocument(
      '<UrlBundle label="kept" config={{endpoint: "javascript:alert(1)"}} links={["https://example.com", "javascript:alert(2)"]} />',
      {
        components: {
          UrlBundle: {
            props: {
              config: {
                type: 'object',
                properties: {
                  endpoint: { type: 'string', format: 'url' },
                },
                additionalProperties: false,
              },
              links: {
                type: 'array',
                items: { type: 'string', format: 'url' },
              },
              label: { type: 'string' },
            },
          },
        },
      }
    );
    expect(
      findNodes(
        unsafeNested.root.children,
        (node) => node.type === 'component' && node.name === 'UrlBundle'
      )
    ).toMatchObject([{ props: { label: 'kept' } }]);
    expect(JSON.stringify(unsafeNested.root)).not.toContain('javascript:');
    expect(
      unsafeNested.diagnostics.filter(
        ({ code }) => code === DIAGNOSTIC_CODES.UNSAFE_URL
      )
    ).toMatchObject([
      { data: { prop: 'config.endpoint' } },
      { data: { prop: 'links[1]' } },
    ]);

    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);
    try {
      const rejectedCallback = await compileSafeDocument(
        '<LinkCard href="https://example.com/rejected" />',
        {
          allowUrl: () =>
            Promise.reject(
              new Error('callback rejected')
            ) as unknown as boolean,
          components: {
            LinkCard: {
              props: { href: { type: 'string', format: 'url' } },
              requiredProps: ['href'],
            },
          },
        }
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(JSON.stringify(rejectedCallback.root)).not.toContain(
        'https://example.com/rejected'
      );
      expect(rejectedCallback.diagnostics.map(({ code }) => code)).toEqual([
        DIAGNOSTIC_CODES.UNSAFE_URL,
        DIAGNOSTIC_CODES.MISSING_REQUIRED_PROP,
      ]);
      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandledRejection);
    }

    const rejectedRaw = await compileSafeDocument(
      '<strong>preserved child</strong>'
    );
    expect(JSON.stringify(rejectedRaw.root)).toContain('preserved child');
    expect(JSON.stringify(rejectedRaw.root)).not.toContain('strong');
    expect(rejectedRaw.diagnostics).toMatchObject([
      { code: DIAGNOSTIC_CODES.UNSUPPORTED_RAW_HTML },
    ]);
  });

  it('keeps declared, rejected & inert component outcomes distinct', async () => {
    const source = [
      '<Known title="validated">known child</Known>',
      '',
      '<Mystery plain="discarded" action={run()}>unknown child</Mystery>',
    ].join('\n');
    const components = {
      Known: {
        children: 'required',
        props: { title: { type: 'string' } },
        requiredProps: ['title'],
      },
    } as const;

    const rejected = await compileSafeDocument(source, { components });
    expect(
      findNodes(
        rejected.root.children,
        (node) => node.type === 'component' && node.name === 'Known'
      )
    ).toMatchObject([
      {
        type: 'component',
        name: 'Known',
        props: { title: 'validated' },
      },
    ]);
    expect(
      findNodes(
        rejected.root.children,
        (node) => node.type === 'unknownComponent'
      )
    ).toEqual([]);
    expect(JSON.stringify(rejected.root)).not.toContain('discarded');
    expect(JSON.stringify(rejected.root)).toContain('unknown child');
    expect(rejected.diagnostics).toMatchObject([
      { code: DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE },
      {
        code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
        severity: 'error',
      },
    ]);

    const inert = await compileSafeDocument(source, {
      components,
      unknownComponents: 'inert',
    });
    const unknown = findNodes(
      inert.root.children,
      (node) => node.type === 'unknownComponent'
    );
    expect(unknown).toMatchObject([
      {
        type: 'unknownComponent',
        name: 'Mystery',
        children: [{ type: 'text', value: 'unknown child' }],
      },
    ]);
    expect(unknown[0]).not.toHaveProperty('props');
    expect(JSON.stringify(inert.root)).not.toContain('discarded');
    expect(inert.diagnostics).toMatchObject([
      { code: DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE },
      {
        code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
        severity: 'warning',
      },
    ]);
  });

  it('stays isolated from Trusted Mode & component import generation', async () => {
    trustedBoundarySpies.compileTrusted.mockClear();
    trustedBoundarySpies.generateComponentImports.mockClear();

    const document = await compileSafeDocument(
      [
        "import Hidden from './hidden'",
        '',
        '<Panel title="safe">content</Panel>',
      ].join('\n'),
      PANEL_SCHEMA
    );

    expect(
      findNodes(
        document.root.children,
        (node) => node.type === 'component' && node.name === 'Panel'
      )
    ).toMatchObject([
      { type: 'component', name: 'Panel', props: { title: 'safe' } },
    ]);
    expect(document.diagnostics).toMatchObject([
      { code: DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE },
    ]);
    expect(trustedBoundarySpies.compileTrusted).not.toHaveBeenCalled();
    expect(
      trustedBoundarySpies.generateComponentImports
    ).not.toHaveBeenCalled();
  });

  it('returns empty trees for exceeded depth & node budgets', async () => {
    const cases = [
      { kind: 'depth', source: nestedComponentSource(62), exceeded: false },
      { kind: 'depth', source: nestedComponentSource(63), exceeded: true },
      { kind: 'nodes', source: paragraphSource(4_999), exceeded: false },
      {
        kind: 'nodes',
        source: `${paragraphSource(4_999)}\n\n---`,
        exceeded: false,
      },
      { kind: 'nodes', source: paragraphSource(5_000), exceeded: true },
    ] as const;
    const options = {
      components: { Box: { children: 'optional' } },
    } as const satisfies SafeDocumentCompileOptions;

    for (const testCase of cases) {
      const document = await compileSafeDocument(testCase.source, options);
      if (!testCase.exceeded) {
        expect(document.root.children.length, testCase.kind).toBeGreaterThan(0);
        expect(document.diagnostics, testCase.kind).toEqual([]);
        continue;
      }
      expect(document.root.children, testCase.kind).toEqual([]);
      expect(document.diagnostics, testCase.kind).toHaveLength(1);
      expect(document.diagnostics[0]).toMatchObject({
        code: DIAGNOSTIC_CODES.UNSUPPORTED_IN_SAFE_MODE,
        ruleId: 'safe-document/document-limit',
        data: {
          kind: `document-${testCase.kind}`,
          limit: testCase.kind === 'depth' ? 64 : 10_000,
        },
      });
    }
  });
});
