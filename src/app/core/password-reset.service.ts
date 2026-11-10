import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { PasswordResetConfirmation, PasswordResetResponse, RESET_OUTCOMES } from '../shared/models/password-reset';
import { API_PATHS, AuthApi, HANDLE_AUTH_ERRORS_LOCALLY } from './api';
import { AuthClientError, authErrorMessage } from './auth.messages';
import { SessionStore } from './session-store';

export const RESET_ACKNOWLEDGEMENT = 'If an eligible account exists, a password reset link will be sent to its registered email address.';

export function resetOutcome(error: unknown): string | null {
  const body: unknown = error instanceof HttpErrorResponse ? error.error : null;
  if (typeof body !== 'object' || body === null || !('outcome' in body)) return null;
  return RESET_OUTCOMES.find(value => value === body.outcome) ?? null;
}

export function resetErrorMessage(error: unknown): string {
  switch (resetOutcome(error)) {
    case 'RESET_LINK_INVALID': return 'This reset link is invalid, expired, or already used. Please request a new link.';
    case 'RESET_RATE_LIMITED': return 'Too many reset attempts. Please wait before trying again.';
    case 'RESET_UNAVAILABLE': return 'Password recovery is temporarily unavailable. Please try again later or contact your administrator.';
    case 'PASSWORD_REUSED': return 'This password was used recently. Please choose a different password.';
    case 'INVALID_PASSWORD': return 'Check that your password meets all requirements and both passwords match.';
    default: return authErrorMessage(error);
  }
}

@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(AuthApi);
  private readonly session = inject(SessionStore);

  request(username: string): Observable<void> {
    return this.http.post<PasswordResetResponse>(this.api.url(API_PATHS.resetRequest), { username }, {
      context: new HttpContext().set(HANDLE_AUTH_ERRORS_LOCALLY, true),
    }).pipe(map(response => {
      if (!response.status || response.outcome !== 'RESET_REQUEST_ACCEPTED') throw new AuthClientError('response');
    }));
  }

  confirm(body: PasswordResetConfirmation): Observable<void> {
    return this.http.post<PasswordResetResponse>(this.api.url(API_PATHS.resetConfirm), body, {
      context: new HttpContext().set(HANDLE_AUTH_ERRORS_LOCALLY, true),
    }).pipe(map(response => {
      if (!response.status || response.outcome !== 'PASSWORD_CHANGED') throw new AuthClientError('response');
      this.session.clear();
      this.session.passwordChangeRequired.set(false);
      this.session.pendingUsername.set('');
      this.session.notice.set({ tone: 'success', message: 'Your password has been reset. Sign in with your new password.' });
    }));
  }
}
