// dev/components/ThemeToggle.tsx
// Toggle between light, dark, & system color modes

import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('vscode-dark');
      root.style.colorScheme = 'dark';
    } else if (theme === 'light') {
      root.classList.remove('vscode-dark');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('vscode-dark');
      root.style.colorScheme = '';
    }
  }, [theme]);

  return (
    <div className="dev-theme-toggle">
      {(['light', 'dark', 'system'] as const).map((t) => (
        <button
          key={t}
          className={`dev-theme-btn ${theme === t ? 'active' : ''}`}
          onClick={() => setTheme(t)}
        >
          {t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'System'}
        </button>
      ))}
    </div>
  );
}
