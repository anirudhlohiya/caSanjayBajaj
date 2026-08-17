import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let refreshPromise: Promise<boolean> | null = null;

function refreshAccess(auth: AuthService): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = auth.refresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.access;
  let authReq = req;
  if (token && !req.url.includes('/auth/login')) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      const is401 =
        error instanceof HttpErrorResponse && error.status === 401;
      const canRefresh =
        is401 &&
        !authReq.headers.has('X-FP-Retried') &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh') &&
        !!auth.refreshToken;

      if (!canRefresh) return throwError(() => error);

      return from(refreshAccess(auth)).pipe(
        switchMap((ok) => {
          if (!ok) {
            router.navigate(['/login']);
            return throwError(() => error);
          }
          const retryReq = authReq.clone({
            setHeaders: {
              Authorization: `Bearer ${auth.access ?? ''}`,
              'X-FP-Retried': 'true',
            },
          });
          return next(retryReq);
        }),
      );
    }),
  );
};