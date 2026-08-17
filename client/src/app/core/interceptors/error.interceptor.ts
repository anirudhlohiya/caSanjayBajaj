import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { APP } from '../models';
import { ToastService } from '../services/toast.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.url?.startsWith(APP.apiBaseUrl) &&
        !req.url.includes('/auth/')
      ) {
        const message = error.error?.message;
        if (typeof message === 'string') {
          toast.error(message);
        } else {
          toast.error('Something went wrong. Please try again.');
        }
      }
      return throwError(() => error);
    }),
  );
};
