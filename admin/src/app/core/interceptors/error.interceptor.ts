import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

function extractErrorMessage(error: HttpErrorResponse): string {
  const body = error.error as { message?: string | string[] } | null;
  if (body && typeof body === 'object' && body.message) {
    if (Array.isArray(body.message)) return body.message.join(', ');
    return body.message;
  }
  if (error.status === 0) return 'Cannot reach the server. Is it running?';
  return `Request failed (${error.status})`;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status !== 401) {
        if (error.status >= 400) {
          toast.error(extractErrorMessage(error));
        }
      }
      return throwError(() => error);
    }),
  );
};