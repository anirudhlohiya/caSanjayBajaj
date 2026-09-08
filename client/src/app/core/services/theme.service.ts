import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'fp_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(
    (localStorage.getItem(THEME_KEY) as ThemeMode) ?? 'system',
  );

  private mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.apply(this.mode());
    this.mediaQuery.addEventListener('change', () => {
      if (this.mode() === 'system') {
        this.applyToDom(this.mediaQuery.matches);
      }
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(THEME_KEY, mode);
    this.apply(mode);
  }

  private apply(mode: ThemeMode): void {
    if (mode === 'system') {
      this.applyToDom(this.mediaQuery.matches);
    } else {
      this.applyToDom(mode === 'dark');
    }
  }

  private applyToDom(dark: boolean): void {
    const root = document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (dark) {
      root.classList.add('dark');
      metaThemeColor?.setAttribute('content', '#0a0a0a');
    } else {
      root.classList.remove('dark');
      metaThemeColor?.setAttribute('content', '#fafafa');
    }
  }

  isDark(): boolean {
    const m = this.mode();
    if (m === 'system') return this.mediaQuery.matches;
    return m === 'dark';
  }
}
