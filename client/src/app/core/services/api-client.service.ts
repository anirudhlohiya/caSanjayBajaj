import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  readonly baseUrl = APP.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`);
  }

  post<T>(path: string, body?: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  patch<T>(path: string, body?: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body ?? {});
  }

  delete<T>(path: string, body?: unknown) {
    return this.http.request<T>('DELETE', `${this.baseUrl}${path}`, {
      body: body ?? {},
    });
  }
}
