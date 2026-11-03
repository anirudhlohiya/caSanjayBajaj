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

  /** Home has a navy top bar; the status bar follows it there. */
  private hero = false;

  setHero(on: boolean): void {
    if (on === this.hero) return;
    this.hero = on;
    this.applyToDom(this.isDark());
  }

  /** Status bar colour: the top bar's colour (white / navy card, or the Home navy). */
  barColor(dark: boolean): string {
    if (this.hero) return dark ? '#06132f' : '#001a4c';
    return dark ? '#0e1629' : '#ffffff';
  }

  private applyToDom(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
    const color = this.barColor(dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    // Android app (MainActivity.kt): paint the status/navigation bars to match.
    // setStatusBar exists from app 1.3.0; older apps only know setDark.
    const native = (window as Window & {
      NativeTheme?: { setDark(dark: boolean): void; setStatusBar?(color: string, lightIcons: boolean): void };
    }).NativeTheme;
    native?.setDark(dark);
    native?.setStatusBar?.(color, dark || this.hero);
  }

  isDark(): boolean {
    const m = this.mode();
    if (m === 'system') return this.mediaQuery.matches;
    return m === 'dark';
  }
}
