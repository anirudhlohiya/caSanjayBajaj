import { Injectable, inject } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { resolveNav } from './nav-map';

/** Screens that are never a back destination (signing in again makes no sense). */
const AUTH_PREFIXES = ['/login', '/signup', '/register', '/forgot-password'];
const MAX_ENTRIES = 50;

function isAuthUrl(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return AUTH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Back-button behaviour for the whole app: go to the page the user actually
 * came from.
 *
 * Keeps its own record of in-app navigations (mirroring the browser history
 * entries the app created), so it knows whether `history.back()` would stay
 * inside the app. When there is no in-app previous page — the app was opened
 * straight onto a screen from a notification, link or reload — back falls back
 * to the screen's logical parent from the nav map instead of leaving the app.
 */
@Injectable({ providedIn: 'root' })
export class NavHistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private stack: string[] = [];
  private popstate = false;
  private replace = false;

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe((e) => {
        // Anything not started by the app itself is the browser / Android back
        // or forward button moving through history.
        this.popstate = e.navigationTrigger !== 'imperative';
        this.replace = !!this.router.currentNavigation()?.extras.replaceUrl;
      });
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.record(e.urlAfterRedirects));
  }

  /** True when there is an in-app page to go back to. */
  canGoBack(): boolean {
    return this.stack.length > 1;
  }

  /** Go to the previous page, or to this screen's parent if there is none. */
  back(): void {
    if (this.canGoBack()) {
      this.location.back();
      return;
    }
    const parent = resolveNav(this.router.url).backTo ?? '/dashboard';
    void this.router.navigateByUrl(parent, { replaceUrl: true });
  }

  private record(url: string): void {
    if (isAuthUrl(url)) {
      // Pages before sign-in are not part of the in-app history
      this.stack = [];
      return;
    }
    const top = this.stack.length - 1;
    if (this.popstate) {
      // Browser / Android back or forward: rewind to that entry if we have it
      const index = this.stack.lastIndexOf(url, top - 1);
      if (index >= 0) {
        this.stack.length = index + 1;
        return;
      }
    } else if (this.replace && top >= 0) {
      this.stack[top] = url;
      return;
    }
    if (this.stack[top] !== url) this.stack.push(url);
    if (this.stack.length > MAX_ENTRIES) this.stack.shift();
  }
}
