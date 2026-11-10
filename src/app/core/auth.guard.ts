import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restoreSession().pipe(
    map(valid => valid || router.createUrlTree([
      auth.session.passwordChangeRequired() ? '/password/change' : '/login',
    ])),
    catchError(() => {
      auth.session.notice.set({ tone: 'warning', message: 'Unable to verify your session. Check your connection and try again.' });
      return of(router.createUrlTree(['/login']));
    }),
  );
};
