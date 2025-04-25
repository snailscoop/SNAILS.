import { ReactNode, useState, useEffect } from 'react';
import { ThemeType } from './types';
import { ThemeContext } from './ThemeContextInstance';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Available themes
  const themes: { id: ThemeType; name: string }[] = [
    { id: 'light', name: 'Light' },
    { id: 'dark', name: 'Dark' },
    { id: 'snail', name: 'Snail Theme' }
  ];

  // Initialize with dark theme or from localStorage if available
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeType | null;
    return savedTheme && (themes.some(t => t.id === savedTheme)) ? savedTheme : 'dark';
  });

  // Apply theme to document when it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
} 