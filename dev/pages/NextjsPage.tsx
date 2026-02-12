// dev/pages/NextjsPage.tsx
// Showcase for Next.js component shims

import { Image, Link } from '@forge/components/nextjs';
import '@forge/components/styles/nextjs.css';
import { Section } from '../components/Section';

// 1x1 blue pixel as a placeholder data URI
const PLACEHOLDER_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==';

export function NextjsPage() {
  return (
    <div>
      <h1>Next.js Components</h1>

      <Section title="Image" description="Next.js Image shim — renders a basic img tag">
        <Image
          src="https://picsum.photos/400/250"
          alt="Random placeholder image"
          width={400}
          height={250}
        />
      </Section>

      <Section title="Image w/ object src">
        <Image
          src={{ src: 'https://picsum.photos/300/200', width: 300, height: 200 }}
          alt="Image with object src"
        />
      </Section>

      <Section title="Image w/ fill mode" description="Fills parent container (needs relative parent)">
        <div
          style={{
            position: 'relative',
            width: 400,
            height: 250,
            border: '1px dashed var(--mdx-border-color, #ccc)',
          }}
        >
          <Image
            src="https://picsum.photos/400/250?grayscale"
            alt="Fill mode image"
            fill
          />
        </div>
      </Section>

      <Section title="Image w/ priority">
        <Image
          src="https://picsum.photos/300/180"
          alt="Priority image (loading=eager)"
          width={300}
          height={180}
          priority
        />
      </Section>

      <Section title="Image w/ blur placeholder">
        <Image
          src="https://picsum.photos/350/220"
          alt="Image with blur placeholder"
          width={350}
          height={220}
          placeholder="blur"
          blurDataURL={PLACEHOLDER_BLUR}
        />
      </Section>

      <Section title="Link" description="Next.js Link shim — renders a basic anchor tag">
        <p>
          <Link href="https://example.com">External link</Link> — opens in new
          tab automatically.
        </p>
        <p>
          <Link href="/docs/getting-started">Internal link</Link> — same tab.
        </p>
      </Section>

      <Section title="Link w/ object href">
        <p>
          <Link
            href={{
              pathname: '/docs/api',
              query: { version: '2' },
              hash: 'methods',
            }}
          >
            Object href: /docs/api?version=2#methods
          </Link>
        </p>
      </Section>
    </div>
  );
}
