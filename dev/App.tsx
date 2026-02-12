// dev/App.tsx
// Dev showcase shell: sidebar nav, theme toggle, content area

import { useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { GenericPage } from './pages/GenericPage';
import { DocusaurusPage } from './pages/DocusaurusPage';
import { StarlightPage } from './pages/StarlightPage';
import { NextraPage } from './pages/NextraPage';
import { NextjsPage } from './pages/NextjsPage';
import '@forge/components/shared/tokens.css';
import './app.css';

type PageId = 'generic' | 'docusaurus' | 'starlight' | 'nextra' | 'nextjs';

const PAGES: { id: PageId; label: string }[] = [
  { id: 'generic', label: 'Generic' },
  { id: 'docusaurus', label: 'Docusaurus' },
  { id: 'starlight', label: 'Starlight' },
  { id: 'nextra', label: 'Nextra' },
  { id: 'nextjs', label: 'Next.js' },
];

const PAGE_COMPONENTS: Record<PageId, React.FC> = {
  generic: GenericPage,
  docusaurus: DocusaurusPage,
  starlight: StarlightPage,
  nextra: NextraPage,
  nextjs: NextjsPage,
};

export function App() {
  const [activePage, setActivePage] = useState<PageId>('generic');
  const ActiveComponent = PAGE_COMPONENTS[activePage];

  return (
    <div className="dev-app">
      <header className="dev-header">
        <h1>mdx-forge Showcase</h1>
        <ThemeToggle />
      </header>
      <div className="dev-layout">
        <nav className="dev-sidebar">
          {PAGES.map((page) => (
            <button
              key={page.id}
              className={`dev-nav-btn ${activePage === page.id ? 'active' : ''}`}
              onClick={() => setActivePage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>
        <main className="dev-content">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
