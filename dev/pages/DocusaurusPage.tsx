// dev/pages/DocusaurusPage.tsx
// Showcase for Docusaurus @theme component shims

import { Tabs, TabItem, CodeBlock, Details } from '@forge/components/docusaurus';
import '@forge/components/styles/docusaurus.css';
import { Section } from '../components/Section';

export function DocusaurusPage() {
  return (
    <div>
      <h1>Docusaurus Components</h1>

      <Section title="Basic Tabs">
        <Tabs>
          <TabItem value="javascript" label="JavaScript" default>
            <pre><code>{`function greet(name) {\n  return \`Hello, \${name}!\`;\n}`}</code></pre>
          </TabItem>
          <TabItem value="typescript" label="TypeScript">
            <pre><code>{`function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}`}</code></pre>
          </TabItem>
          <TabItem value="python" label="Python">
            <pre><code>{`def greet(name):\n    return f"Hello, {name}!"`}</code></pre>
          </TabItem>
        </Tabs>
      </Section>

      <Section
        title="Synchronized Tabs (groupId)"
        description="Tabs w/ the same groupId stay in sync"
      >
        <p><strong>Install:</strong></p>
        <Tabs groupId="pkg-manager">
          <TabItem value="npm" label="npm">
            <pre><code>npm install my-package</code></pre>
          </TabItem>
          <TabItem value="yarn" label="Yarn">
            <pre><code>yarn add my-package</code></pre>
          </TabItem>
          <TabItem value="pnpm" label="pnpm">
            <pre><code>pnpm add my-package</code></pre>
          </TabItem>
        </Tabs>

        <p><strong>Build (same groupId):</strong></p>
        <Tabs groupId="pkg-manager">
          <TabItem value="npm" label="npm">
            <pre><code>npm run build</code></pre>
          </TabItem>
          <TabItem value="yarn" label="Yarn">
            <pre><code>yarn build</code></pre>
          </TabItem>
          <TabItem value="pnpm" label="pnpm">
            <pre><code>pnpm build</code></pre>
          </TabItem>
        </Tabs>
      </Section>

      <Section title="Tabs w/ defaultValue">
        <Tabs defaultValue="typescript">
          <TabItem value="javascript" label="JavaScript">
            JavaScript content (not selected by default).
          </TabItem>
          <TabItem value="typescript" label="TypeScript">
            <strong>This tab is selected by default</strong> via{' '}
            <code>defaultValue="typescript"</code>.
          </TabItem>
          <TabItem value="rust" label="Rust">
            Rust content (not selected by default).
          </TabItem>
        </Tabs>
      </Section>

      <Section title="CodeBlock" description="Enhanced code rendering w/ title & line numbers">
        <CodeBlock language="javascript">
          {`function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nfor (let i = 0; i < 10; i++) {\n  console.log(fibonacci(i));\n}`}
        </CodeBlock>
      </Section>

      <Section title="CodeBlock w/ title">
        <CodeBlock language="typescript" title="src/utils/math.ts">
          {`export function factorial(n: number): number {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}\n\nexport function isPrime(n: number): boolean {\n  if (n < 2) return false;\n  for (let i = 2; i <= Math.sqrt(n); i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}`}
        </CodeBlock>
      </Section>

      <Section title="CodeBlock w/ line numbers">
        <CodeBlock language="python" showLineNumbers>
          {`def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)`}
        </CodeBlock>
      </Section>

      <Section title="Details" description="Collapsible sections using native details element">
        <Details summary="Click to expand this section">
          <p>
            This content is hidden by default. Click the summary to reveal it!
          </p>
          <ul>
            <li>Bullet points</li>
            <li><strong>Bold text</strong> and <em>italic text</em></li>
            <li><code>inline code</code></li>
          </ul>
        </Details>
      </Section>

      <Section title="Details open by default">
        <Details summary="This section starts expanded" open>
          <p>
            This content is visible when the page loads because{' '}
            <code>open</code> is set.
          </p>
        </Details>
      </Section>

      <Section title="Multiple Details sections">
        <Details summary="Section 1: Getting Started">
          <h3>Getting Started</h3>
          <ol>
            <li>Install dependencies</li>
            <li>Configure your environment</li>
            <li>Run the application</li>
          </ol>
        </Details>
        <Details summary="Section 2: Advanced Configuration">
          <h3>Advanced Configuration</h3>
          <pre><code>{`{\n  "advanced": true,\n  "experimentalFeatures": ["feature1", "feature2"]\n}`}</code></pre>
        </Details>
        <Details summary="Section 3: Troubleshooting">
          <h3>Troubleshooting</h3>
          <p>Common issues and solutions.</p>
        </Details>
      </Section>

      <Section title="Nested Details">
        <Details summary="Outer Section">
          <p>This is the outer section content.</p>
          <Details summary="Inner Section">
            <p>This is nested inside the outer section.</p>
          </Details>
          <p>More content after the nested part.</p>
        </Details>
      </Section>
    </div>
  );
}
