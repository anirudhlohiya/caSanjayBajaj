import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export type QueryValue = string | number | boolean | undefined | null;

export interface Query {
  [key: string]: QueryValue;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get baseUrl(): string {
    const override = localStorage.getItem('FP_API_URL');
    return (override ?? environment.apiBaseUrl).replace(/\/$/, '');
  }

  get<T>(path: string, query?: Query) {
    return this.http.get<T>(`${this.baseUrl}${path}`, {
      params: this.buildParams(query),
    });
  }

  post<T>(path: string, body?: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  patch<T>(path: string, body?: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  put<T>(path: string, body?: unknown) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  getBlob(path: string) {
    return this.http.get(`${this.baseUrl}${path}`, { responseType: 'blob' });
  }

  private buildParams(query?: Query): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return params;
  }
}
