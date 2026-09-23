import { useEffect } from 'react';

/**
 * The palette now comes from the v1 Mantine theme (`modules/theme`), and every colour token in
 * `styles/index.css` reads from it. The older theme system wrote its colours inline on :root,
 * which would win over that mapping, so this clears anything it left behind.
 */
export function useThemeEffect() {
  useEffect(() => {
    const root = document.documentElement.style;
    for (const name of Array.from(root)) {
      if (name.startsWith('--color-') || name === '--font-sans') root.removeProperty(name);
    }
  }, []);
}
