import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { API_PATHS, AuthApi, basicHeaders, HANDLE_AUTH_ERRORS_LOCALLY } from './api';
import { AuthenticationResponse, PasswordChangeRequest } from './auth.models';
import { AuthClientError, outcomeFrom, outcomeMessage } from './auth.messages';
import { SessionStore } from './session-store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(AuthApi);
  readonly session = inject(SessionStore);
  private sessionRequest: Observable<boolean> | null = null;

  login(username: string, password: string): Observable<boolean> {
    return defer(() => {
      this.session.clear();
      this.session.notice.set(null);
      this.session.passwordChangeRequired.set(false);
      return this.http.post<AuthenticationResponse>(this.api.url(API_PATHS.login), {}, {
        headers: basicHeaders(username, password),
        context: new HttpContext().set(HANDLE_AUTH_ERRORS_LOCALLY, true),
      });
    }).pipe(
      tap(response => this.session.saveLogin(response)),
      switchMap(() => this.restoreSession()),
      catchError((error: unknown) => {
        // Preserve a token on transport errors so the user can retry session verification.
        if (!(error instanceof HttpErrorResponse) || (error.status !== 0 && error.status < 500)) this.session.clear();
        if (outcomeFrom(error) === 'PASSWORD_CHANGE_REQUIRED') {
          this.session.pendingUsername.set(username);
          this.session.passwordChangeRequired.set(true);
          this.session.notice.set({ tone: 'warning', message: outcomeMessage('PASSWORD_CHANGE_REQUIRED') });
        }
        return throwError(() => error);
      }),
    );
  }

  restoreSession(): Observable<boolean> {
    const token = this.session.token();
    if (!token) return of(false);
    if (this.sessionRequest) return this.sessionRequest;
    this.sessionRequest = this.http.get<AuthenticationResponse>(this.api.url(API_PATHS.session)).pipe(
      map(response => {
        if (this.session.token() !== token) return false;
        this.session.setUser(response);
        return true;
      }),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) return of(false);
        return throwError(() => error);
      }),
      finalize(() => { this.sessionRequest = null; }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.sessionRequest;
  }

  changePassword(username: string, currentPassword: string, body: PasswordChangeRequest): Observable<void> {
    return defer(() => this.http.post<AuthenticationResponse>(this.api.url(API_PATHS.password), body, {
      headers: basicHeaders(username, currentPassword),
      context: new HttpContext().set(HANDLE_AUTH_ERRORS_LOCALLY, true),
    })).pipe(
      map(response => {
        if (!response.status || response.outcome !== 'PASSWORD_CHANGED') throw new AuthClientError('response');
        this.session.clear();
        this.session.passwordChangeRequired.set(false);
        this.session.pendingUsername.set('');
        this.session.notice.set({ tone: 'success', message: outcomeMessage('PASSWORD_CHANGED') });
      }),
      catchError((error: unknown) => {
        if (['ACCOUNT_LOCKED', 'ACCOUNT_DISABLED', 'ACCOUNT_EXPIRED', 'CREDENTIALS_EXPIRED']
          .includes(outcomeFrom(error) ?? '')) this.session.clear();
        return throwError(() => error);
      }),
    );
  }

  logout(): Observable<void> {
    const token = this.session.token();
    const request: Observable<unknown> = token ? this.http.post(this.api.url(API_PATHS.logout), {}, {
      headers: { Authorization: `Bearer ${token}` },
      context: new HttpContext().set(HANDLE_AUTH_ERRORS_LOCALLY, true),
    }) : of(null);
    return request.pipe(
      map(() => true), catchError(() => of(false)),
      map(revoked => {
        this.session.clear();
        this.session.passwordChangeRequired.set(false);
        this.session.pendingUsername.set('');
        this.session.notice.set({ tone: revoked ? 'success' : 'warning', message: revoked
          ? 'You have been signed out.'
          : 'Signed out on this device. The server could not confirm sign-out; its session may remain active.' });
      }),
    );
  }
}
