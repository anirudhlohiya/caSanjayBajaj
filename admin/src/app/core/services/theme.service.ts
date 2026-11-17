import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'adm_theme';

/** Light / Dark / System for the admin, saved per browser. index.html applies it before first paint. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.saved());
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.apply();
    this.media.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply();
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    this.apply();
  }

  isDark(): boolean {
    const m = this.mode();
    return m === 'dark' || (m === 'system' && this.media.matches);
  }

  private apply(): void {
    document.documentElement.classList.toggle('dark', this.isDark());
  }

  private saved(): ThemeMode {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
