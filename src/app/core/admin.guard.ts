import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restoreSession().pipe(
    map(valid => valid
      ? auth.session.user()?.roles.includes('ROLE_ADMIN') || router.createUrlTree(['/account'])
      : router.createUrlTree([auth.session.passwordChangeRequired() ? '/password/change' : '/login'])),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};
