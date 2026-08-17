import { computed, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './api-client.service';
import {
  APP,
  AuthTokens,
  JwtPayload,
  UserProfile,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessToken = signal<string | null>(
    localStorage.getItem(APP.tokens.access),
  );
  private readonly refreshToken = signal<string | null>(
    localStorage.getItem(APP.tokens.refresh),
  );
  readonly userProfile = signal<UserProfile | null>(null);
  readonly profileLoaded = signal(false);

  readonly user = computed<JwtPayload | null>(() => {
    const token = this.accessToken();
    return token ? AuthService.decodeJwt(token) : null;
  });

  constructor(
    private readonly api: ApiClient,
    private readonly router: Router,
  ) {}

  getAccessToken(): string | null {
    return this.accessToken();
  }

  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  static decodeJwt(token: string): JwtPayload | null {
    try {
      const payload = token.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );
      return JSON.parse(atob(padded)) as JwtPayload;
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    const token = this.accessToken();
    if (!token) return false;
    const payload = AuthService.decodeJwt(token);
    if (!payload) return false;
    const exp = payload.exp;
    if (exp && exp * 1000 < Date.now()) return false;
    return payload.type === 'user';
  }

  async login(email: string, password: string): Promise<UserProfile> {
    const tokens = await firstValueFrom(
      this.api.post<AuthTokens>('/auth/login/user', { email, password }),
    );
    this.setTokens(tokens);
    return this.loadProfile();
  }

  async loadProfile(): Promise<UserProfile> {
    const profile = await firstValueFrom(this.api.get<UserProfile>('/me'));
    this.userProfile.set(profile);
    this.profileLoaded.set(true);
    return profile;
  }

  async refresh(): Promise<boolean> {
    const token = this.refreshToken();
    if (!token) return false;
    try {
      const tokens = await firstValueFrom(
        this.api.post<AuthTokens>('/auth/refresh', { refresh_token: token }),
      );
      this.setTokens(tokens);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async logout(): Promise<void> {
    const token = this.refreshToken();
    if (token) {
      try {
        await firstValueFrom(
          this.api.post('/auth/logout', { refresh_token: token }),
        );
      } catch {
        /* best effort */
      }
    }
    this.clearSession();
    await this.router.navigate(['/login']);
  }

  private setTokens(tokens: AuthTokens): void {
    this.accessToken.set(tokens.access_token);
    this.refreshToken.set(tokens.refresh_token);
    localStorage.setItem(APP.tokens.access, tokens.access_token);
    localStorage.setItem(APP.tokens.refresh, tokens.refresh_token);
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    this.userProfile.set(null);
    this.profileLoaded.set(false);
    localStorage.removeItem(APP.tokens.access);
    localStorage.removeItem(APP.tokens.refresh);
  }
}
