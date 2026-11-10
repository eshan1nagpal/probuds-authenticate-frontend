import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from './api';
import { authInterceptor } from './auth-interceptor';
import { AuthenticationResponse, LoginOutcome } from './auth.models';
import { outcomeFrom } from './auth.messages';
import { AuthService } from './auth.service';
import { FINGERPRINT_KEY, SESSION_KEY, SessionStore } from './session-store';

const loginResponse: AuthenticationResponse = {
  status: true, outcome: 'AUTHENTICATED', accessToken: 'test-access-token', expiresIn: 3600,
  username: 'tester', name: 'Test User', roles: null,
  passwordExpiryDate: '2026-11-15T09:30:00', passwordExpiresInDays: 7,
};

describe('authentication API integration', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let store: SessionStore;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), provideRouter([]), { provide: API_BASE_URL, useValue: '/api' }] });
    auth = TestBed.inject(AuthService);
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => { http.verify(); sessionStorage.clear(); vi.restoreAllMocks(); });

  function signedIn(): void {
    store.fingerprint();
    store.saveLogin(loginResponse);
    store.setUser(loginResponse);
  }

  it('preserves UTF-8 credentials and whitespace, validates the session, and keeps its fingerprint', () => {
    let success = false;
    auth.login('tést', '  Päss!123  ').subscribe(value => { success = value; });
    const login = http.expectOne('/api/authenticate');
    expect(login.request.method).toBe('POST');
    const credentials = login.request.headers.get('Authorization')!.slice(6);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(credentials), c => c.charCodeAt(0)));
    expect(decoded).toBe('tést:  Päss!123  ');
    expect(login.request.headers.get('Application')).toBe('web');
    const fingerprint = login.request.headers.get('X-Session-Fingerprint');
    expect(fingerprint).toHaveLength(64);
    login.flush(loginResponse);
    const session = http.expectOne('/api/session');
    expect(session.request.headers.get('Authorization')).toBe('Bearer test-access-token');
    expect(session.request.headers.get('X-Session-Fingerprint')).toBe(fingerprint);
    session.flush({ status: true, username: 'tester', name: 'Test User', roles: null });
    expect(success).toBe(true);
    expect(store.user()?.roles).toEqual([]);
    expect(store.passwordExpiryDate()).toBe('2026-11-15T09:30:00');
    expect(sessionStorage.getItem(SESSION_KEY)).not.toContain('Päss');
    expect(sessionStorage.getItem(SESSION_KEY)).not.toContain('Basic');
  });

  it.each<[LoginOutcome, number]>([
    ['INVALID_CREDENTIALS', 401], ['ACCOUNT_LOCKED', 401], ['ACCOUNT_DISABLED', 401],
    ['ACCOUNT_EXPIRED', 403], ['CREDENTIALS_EXPIRED', 401],
    ['PASSWORD_EXPIRY_CONFIGURATION_INVALID', 403], ['PASSWORD_CHANGE_REQUIRED', 403],
  ])('preserves the %s outcome without persisting a session', (outcome, status) => {
    let received: LoginOutcome | null = null;
    auth.login('tester', 'OldPass!123').subscribe({ error: error => { received = outcomeFrom(error); } });
    http.expectOne('/api/authenticate').flush({ status: false, outcome }, { status, statusText: 'Rejected' });
    expect(received).toBe(outcome);
    expect(store.token()).toBeNull();
    expect(store.passwordChangeRequired()).toBe(outcome === 'PASSWORD_CHANGE_REQUIRED');
    if (outcome === 'PASSWORD_CHANGE_REQUIRED') expect(store.pendingUsername()).toBe('tester');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('uses Basic rather than bearer for password changes and clears the session only after success', () => {
    signedIn();
    let changed = false;
    const body = { newPassword: 'NewPass!456', confirmPassword: 'NewPass!456' };
    auth.changePassword('tester', 'OldPass!123', body).subscribe(() => { changed = true; });
    const request = http.expectOne('/api/password/change');
    expect(request.request.headers.get('Authorization')).toBe(`Basic ${btoa('tester:OldPass!123')}`);
    expect(request.request.body).toEqual(body);
    expect(request.request.body).not.toHaveProperty('currentPassword');
    expect(store.hasToken()).toBe(true);
    request.flush({ status: true, outcome: 'PASSWORD_CHANGED' });
    expect(changed).toBe(true);
    expect(store.hasToken()).toBe(false);
    expect(sessionStorage.getItem(FINGERPRINT_KEY)).toBeNull();
    expect(store.notice()?.tone).toBe('success');
  });

  it.each<[LoginOutcome, number]>([
    ['PASSWORD_REUSED', 409], ['INVALID_PASSWORD', 400], ['INVALID_CREDENTIALS', 401],
  ])('keeps %s on the password form without an automatic redirect', (outcome, status) => {
    signedIn();
    auth.changePassword('tester', 'wrong', { newPassword: 'NewPass!456', confirmPassword: 'NewPass!456' })
      .subscribe({ error: () => undefined });
    http.expectOne('/api/password/change').flush({ status: false, outcome }, { status, statusText: 'Rejected' });
    expect(navigate).not.toHaveBeenCalled();
    expect(store.hasToken()).toBe(true);
  });

  it('clears local authentication if the password operation locks the account', () => {
    signedIn();
    auth.changePassword('tester', 'wrong', { newPassword: 'NewPass!456', confirmPassword: 'NewPass!456' })
      .subscribe({ error: () => undefined });
    http.expectOne('/api/password/change').flush({ outcome: 'ACCOUNT_LOCKED' }, { status: 401, statusText: 'Locked' });
    expect(store.hasToken()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('routes an expired bearer session to password change without retaining its token', () => {
    signedIn();
    let valid = true;
    auth.restoreSession().subscribe(value => { valid = value; });
    http.expectOne('/api/session').flush({ outcome: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403, statusText: 'Expired' });
    expect(valid).toBe(false);
    expect(store.token()).toBeNull();
    expect(store.pendingUsername()).toBe('tester');
    expect(store.passwordChangeRequired()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/password/change');
  });

  it('restores a saved session with the same fingerprint after a reload', () => {
    signedIn();
    const fingerprint = sessionStorage.getItem(FINGERPRINT_KEY);
    const reloadedStore = new SessionStore();
    expect(reloadedStore.token()).toBe('test-access-token');
    expect(reloadedStore.user()).toBeNull();
    expect(reloadedStore.fingerprint()).toBe(fingerprint);
    auth.restoreSession().subscribe();
    http.expectOne('/api/session').flush({ status: true, username: 'tester' });
    expect(store.user()?.username).toBe('tester');
  });

  it('shares concurrent session checks and does not restore a logged-out user from a late response', () => {
    signedIn();
    auth.restoreSession().subscribe();
    auth.restoreSession().subscribe();
    const pending = http.expectOne('/api/session');
    store.clear();
    pending.flush({ status: true, username: 'tester' });
    expect(store.user()).toBeNull();
    expect(store.hasToken()).toBe(false);
  });

  it('retains the token on session verification transport failures', () => {
    signedIn();
    auth.restoreSession().subscribe({ error: () => undefined });
    http.expectOne('/api/session').error(new ProgressEvent('error'));
    expect(store.hasToken()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a failed server logout honestly and clears only this app’s storage', () => {
    signedIn();
    sessionStorage.setItem('another-app', 'keep');
    auth.logout().subscribe();
    const request = http.expectOne('/api/deout');
    expect(request.request.headers.get('Application')).toBe('web');
    request.error(new ProgressEvent('error'));
    expect(store.hasToken()).toBe(false);
    expect(store.notice()?.tone).toBe('warning');
    expect(store.notice()?.message).toContain('could not confirm');
    expect(sessionStorage.getItem('another-app')).toBe('keep');
  });

  it('rejects incomplete token responses without requesting a session', () => {
    auth.login('tester', 'OldPass!123').subscribe({ error: () => undefined });
    http.expectOne('/api/authenticate').flush({ status: true, outcome: 'AUTHENTICATED' });
    http.expectNone('/api/session');
    expect(store.hasToken()).toBe(false);
  });

  it('fails clearly before sending credentials if browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    let failed = false;
    auth.login('tester', 'OldPass!123').subscribe({ error: () => { failed = true; } });
    http.expectNone('/api/authenticate');
    expect(failed).toBe(true);
    expect(store.hasToken()).toBe(false);
  });
});
