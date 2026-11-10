import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthApi, HANDLE_AUTH_ERRORS_LOCALLY } from './api';
import { outcomeFrom, outcomeMessage } from './auth.messages';
import { SessionStore } from './session-store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const api = inject(AuthApi);
  if (!api.contains(request.url)) return next(request);
  if (api.isPublicUrl(request.url)) {
    // Recovery must work independently of stale tokens or blocked browser session storage.
    return next(request.clone({
      headers: request.headers.delete('Authorization').delete('X-Session-Fingerprint').set('Application', 'web'),
    }));
  }
  const session = inject(SessionStore);
  const router = inject(Router);
  const credentialRequest = api.isCredentialUrl(request.url);
  const headers: Record<string, string> = {
    Application: 'web', 'X-Session-Fingerprint': session.fingerprint(),
  };
  if (!credentialRequest && !request.headers.has('Authorization') && session.token()) {
    headers['Authorization'] = `Bearer ${session.token()}`;
  }
  const authorized = request.clone({ setHeaders: headers });
  return next(authorized).pipe(catchError((error: unknown) => {
    if (!credentialRequest && !request.context.get(HANDLE_AUTH_ERRORS_LOCALLY)
      && error instanceof HttpErrorResponse && [401, 403].includes(error.status)) {
      const username = session.user()?.username ?? '';
      const outcome = outcomeFrom(error);
      session.clear();
      session.passwordChangeRequired.set(outcome === 'PASSWORD_CHANGE_REQUIRED');
      session.pendingUsername.set(username);
      session.notice.set({ tone: 'warning', message: outcome ? outcomeMessage(outcome)
        : 'Your session has ended. Please sign in again.' });
      void router.navigateByUrl(outcome === 'PASSWORD_CHANGE_REQUIRED' ? '/password/change' : '/login');
    }
    return throwError(() => error);
  }));
};
