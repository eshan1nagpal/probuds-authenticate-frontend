import { HttpErrorResponse } from '@angular/common/http';
import { LOGIN_OUTCOMES, LoginOutcome } from './auth.models';

const MESSAGES: Record<LoginOutcome, string> = {
  AUTHENTICATED: 'You are signed in.',
  PASSWORD_CHANGE_REQUIRED: 'Your password has expired. Change it before signing in.',
  ACCOUNT_EXPIRED: 'Your account has expired. Please contact your administrator.',
  PASSWORD_EXPIRY_CONFIGURATION_INVALID: 'Your account’s password settings need attention. Please contact your administrator.',
  ACCOUNT_LOCKED: 'Your account is locked. Please contact your administrator to unlock it.',
  ACCOUNT_DISABLED: 'Your account is disabled. Please contact your administrator.',
  CREDENTIALS_EXPIRED: 'Your credentials have expired. Please contact your administrator.',
  INVALID_CREDENTIALS: 'The username or password is incorrect. Please try again.',
  PASSWORD_CHANGED: 'Your password has been changed. Sign in again with your new password.',
  INVALID_PASSWORD: 'Check that your new password meets all requirements and both passwords match.',
  PASSWORD_REUSED: 'This password was used recently. Please choose a different password.',
};

export function outcomeFrom(error: unknown): LoginOutcome | null {
  const body: unknown = error instanceof HttpErrorResponse ? error.error : null;
  if (typeof body !== 'object' || body === null || !('outcome' in body)) return null;
  return LOGIN_OUTCOMES.find(outcome => outcome === body.outcome) ?? null;
}

export function outcomeMessage(outcome: LoginOutcome): string { return MESSAGES[outcome]; }

export class AuthClientError extends Error {
  constructor(readonly reason: 'storage' | 'response') { super(reason); }
}

export function authErrorMessage(error: unknown, passwordChange = false): string {
  const outcome = outcomeFrom(error);
  if (outcome) {
    return outcome === 'INVALID_CREDENTIALS' && passwordChange
      ? 'The username or current password is incorrect. Please try again.' : MESSAGES[outcome];
  }
  if (error instanceof AuthClientError) {
    return error.reason === 'storage'
      ? 'Session storage is unavailable. Allow storage in this browser and try again.'
      : 'The server returned an incomplete response. Please try again or contact your administrator.';
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Unable to reach the server. Check your connection and try again.';
    if (error.status === 429) return 'Too many requests. Please wait before trying again.';
    if (error.status === 401) return 'Your session has ended. Please sign in again.';
    if (error.status === 403) return 'This request was not allowed. Please contact your administrator if it continues.';
  }
  return 'Unable to complete the request. Please try again.';
}
