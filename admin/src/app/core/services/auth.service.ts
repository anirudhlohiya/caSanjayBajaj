import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { AuthTokens, AuthUser } from '../models';

const ACCESS_KEY = 'fp_admin_access';
const REFRESH_KEY = 'fp_admin_refresh';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);

  private readonly accessToken = signal<string | null>(
    localStorage.getItem(ACCESS_KEY),
  );
  private readonly user = signal<AuthUser | null>(
    this.decode(this.accessToken()),
  );

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => !!this.user());

  get access(): string | null {
    return this.accessToken();
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  async login(email: string, password: string): Promise<AuthUser> {
    const tokens = await firstValueFrom(
      this.api.post<AuthTokens>('/auth/login/admin', { email, password }),
    );
    this.applyTokens(tokens);
    const user = this.user();
    if (!user) {
      throw new Error('Invalid token returned from server');
    }
    return user;
  }

  async refresh(): Promise<boolean> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) {
      this.clear();
      return false;
    }
    try {
      const tokens = await firstValueFrom(
        this.api.post<AuthTokens>('/auth/refresh', { refresh_token: refreshToken }),
      );
      this.applyTokens(tokens);
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  logout(): void {
    const refreshToken = this.refreshToken;
    if (refreshToken) {
      this.api.post('/auth/logout', { refresh_token: refreshToken }).subscribe({
        error: () => undefined,
      });
    }
    this.clear();
  }

  hasPermission(permission: string): boolean {
    const user = this.user();
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return user.permissions?.includes(permission) ?? false;
  }

  isSuperAdmin(): boolean {
    return this.user()?.role === 'super_admin';
  }

  private applyTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    this.accessToken.set(tokens.access_token);
    this.user.set(this.decode(tokens.access_token));
  }

  private clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.accessToken.set(null);
    this.user.set(null);
  }

  private decode(token: string | null): AuthUser | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join(''),
      );
      return JSON.parse(json) as AuthUser;
    } catch {
      return null;
    }
  }
}
