import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { APP } from '../models';
import { AuthService } from '../services/auth.service';

let refreshPromise: Promise<boolean> | null = null;

function refreshSession(auth: AuthService): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = auth.refresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const auth = inject(AuthService);
  const isApi = req.url.startsWith(APP.apiBaseUrl);

  let request = req;
  if (isApi) {
    const token = auth.getAccessToken();
    if (token && !req.headers.has('Authorization')) {
      request = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        isApi &&
        error.status === 401 &&
        !request.url.includes('/auth/') &&
        !request.headers.has('X-FP-Retried')
      ) {
        const retried = request.clone({
          setHeaders: { 'X-FP-Retried': 'true' },
        });
        return from(refreshSession(auth)).pipe(
          switchMap((ok) => {
            if (!ok) {
              auth.clearSession();
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
              return throwError(() => error);
            }
            const token = auth.getAccessToken();
            if (token) {
              return next(
                retried.clone({
                  setHeaders: { Authorization: `Bearer ${token}` },
                }),
              );
            }
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
