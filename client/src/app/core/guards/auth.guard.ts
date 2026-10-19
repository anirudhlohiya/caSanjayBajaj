import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const queryToken = route.queryParamMap.get('token');
  if (queryToken) {
    const payload = AuthService.decodeJwt(queryToken);
    if (
      payload &&
      (!payload.exp || payload.exp * 1000 > Date.now()) &&
      payload.type === 'user'
    ) {
      auth.setSessionFromToken(queryToken);
      return true;
    }
  }

  if (!auth.isAuthenticated()) {
    const refreshed = await auth.refresh();
    if (!refreshed) {
      return router.createUrlTree(['/login']);
    }
  }
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
