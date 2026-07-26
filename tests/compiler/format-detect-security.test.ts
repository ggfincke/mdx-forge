// tests/compiler/format-detect-security.test.ts
// security regressions for .md (CommonMark) vs .mdx (strict MDX) format handling

import { describe, it, expect } from 'vitest';
import { parse } from 'acorn';
import { compileSafe, compileTrusted } from '../../src/compiler/index';
import { resolveDocumentFormat } from '../../src/compiler/internal/format';
import type { CompilerConfig, CompilerLogger } from '../../src/compiler/index';

function config(overrides: Partial<CompilerConfig> = {}): CompilerConfig {
  return {
    documentPath: '/workspace/doc.mdx',
    componentsBuiltins: true,
    componentsUnknownBehavior: 'placeholder',
    ...overrides,
  };
}

// collect ESM import source values from generated module code
function importSources(code: string): string[] {
  const tree = parse(code, {
    ecmaVersion: 'latest',
    sourceType: 'module',
  }) as unknown as { body: Array<Record<string, unknown>> };
  return tree.body
    .filter((n) => n.type === 'ImportDeclaration')
    .map((n) => (n.source as { value: string }).value);
}

// capture warn() output via an injected logger
function captureLogger(): { logger: CompilerLogger; warnings: string[] } {
  const warnings: string[] = [];
  return {
    logger: {
      debug: () => {},
      info: () => {},
      warn: (m: string) => warnings.push(m),
      error: () => {},
    },
    warnings,
  };
}

// path that tries to break out of the generated import string & inject a statement
const EVIL_LAYOUT = "/workspace/layout';import _evil from 'evil';//.tsx";

describe('format security (.md vs .mdx)', () => {
  describe('TRUST-INJ: layout import cannot inject statements', () => {
    it('.md customLayoutFilePath stays a single quoted specifier', async () => {
      const result = await compileTrusted(
        '# hi\n',
        true,
        config({
          documentPath: '/workspace/n.md',
          customLayoutFilePath: EVIL_LAYOUT,
        })
      );
      const sources = importSources(result.code);
      expect(sources).not.toContain('evil');
    });

    it('.mdx customLayoutFilePath (injectMDXStyles) stays a single specifier', async () => {
      const result = await compileTrusted(
        '# hi\n',
        true,
        config({
          documentPath: '/workspace/d.mdx',
          customLayoutFilePath: EVIL_LAYOUT,
        })
      );
      const sources = importSources(result.code);
      expect(sources).not.toContain('evil');
    });
  });

  describe('CFG-VOID / TRUST-MAP: warn when component config is inert for .md', () => {
    it('safe .md warns (MDX009) when componentNameResolver is set', async () => {
      const { logger, warnings } = captureLogger();
      await compileSafe(
        'hello\n',
        config({
          documentPath: '/w/n.md',
          componentNameResolver: () => undefined,
          logger,
        })
      );
      expect(warnings.some((w) => w.includes('MDX009'))).toBe(true);
    });

    it('safe .md warns (MDX009) even with only the default unknown-behavior', async () => {
      const { logger, warnings } = captureLogger();
      // bare config: no explicit containment set, relies on the placeholder default
      await compileSafe('hello\n', {
        documentPath: '/w/n.md',
        logger,
      });
      expect(warnings.some((w) => w.includes('MDX009'))).toBe(true);
    });

    it('safe .mdx does NOT warn', async () => {
      const { logger, warnings } = captureLogger();
      await compileSafe(
        'hello\n',
        config({
          documentPath: '/w/d.mdx',
          componentNameResolver: () => undefined,
          logger,
        })
      );
      expect(warnings.some((w) => w.includes('MDX009'))).toBe(false);
    });

    it('trusted .md warns (MDX009) when builtins are on but no map is set', async () => {
      const { logger, warnings } = captureLogger();
      // builtinsEnabled defaults to true, so the dropped shims should be flagged
      await compileTrusted('# hi\n', true, {
        documentPath: '/w/n.md',
        logger,
      });
      expect(warnings.some((w) => w.includes('MDX009'))).toBe(true);
    });

    it('trusted .md warns (MDX009) when a component map is set', async () => {
      const { logger, warnings } = captureLogger();
      await compileTrusted(
        '# hi\n',
        true,
        config({
          documentPath: '/w/n.md',
          logger,
          configFile: {
            config: { components: { Foo: './Foo.tsx' } },
            configPath: '/w/.mdx-previewrc.json',
            configDir: '/w',
          },
        })
      );
      expect(warnings.some((w) => w.includes('MDX009'))).toBe(true);
    });
  });

  describe("FMT-DEFAULT: format:'mdx' restores strict parsing on a .md path", () => {
    it('rejects invalid MDX even for a .md extension', async () => {
      await expect(
        compileSafe(
          'Onboard a new tester in <1 day.\n',
          config({ documentPath: '/w/n.md', format: 'mdx' })
        )
      ).rejects.toThrow();
    });
  });

  describe('FMT-CONFUSE: control-char paths fail closed to strict mdx', () => {
    it('embedded NUL resolves to mdx', () => {
      expect(
        resolveDocumentFormat(config({ documentPath: 'evil.mdx\u0000.md' }))
      ).toBe('mdx');
    });
    it('clean .md resolves to md', () => {
      expect(
        resolveDocumentFormat(config({ documentPath: '/w/clean.md' }))
      ).toBe('md');
    });
    it('uppercase .MD resolves to md', () => {
      expect(
        resolveDocumentFormat(config({ documentPath: '/w/README.MD' }))
      ).toBe('md');
    });
  });

  describe('TRUST-STRIP: export-default strip does not corrupt content', () => {
    it('.md prose containing "export default MDXContent" is preserved', async () => {
      const result = await compileTrusted(
        'See export default MDXContent here.\n',
        true,
        config({ documentPath: '/w/n.md', useHostMarkdownStyles: true })
      );
      expect(result.code).toContain('export default MDXContent here');
      // exactly one module-level default export (the layout wrapper)
      const defaults = result.code.match(/^export default/gm) ?? [];
      expect(defaults.length).toBe(1);
    });
  });

  // pins: custom-components wrap emits exactly one module-level export default
  describe('WRAP-EXPORT: single module-level export default per wrap path', () => {
    it('.mdx wrap (with custom components) has exactly one export default', async () => {
      const result = await compileTrusted(
        '# hi\n',
        true,
        config({
          documentPath: '/w/d.mdx',
          configFile: {
            config: { components: { Foo: './Foo.tsx' } },
            configPath: '/w/.mdx-previewrc.json',
            configDir: '/w',
          },
        })
      );
      const defaults = result.code.match(/^export default/gm) ?? [];
      expect(defaults.length).toBe(1);
    });
  });
});
