import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../core/api';
import { authInterceptor } from '../../core/auth-interceptor';
import { PasswordResetService, RESET_ACKNOWLEDGEMENT } from '../../core/password-reset.service';
import { SESSION_KEY, SessionStore } from '../../core/session-store';
import { ForgotPassword } from './forgot-password';
import { ResetPassword } from './reset-password';
import { BehaviorSubject, of } from 'rxjs';

describe('password recovery', () => {
  let http: HttpTestingController;
  let snapshot: { queryParamMap: ReturnType<typeof convertToParamMap> };
  beforeEach(() => {
    sessionStorage.clear();
    snapshot = { queryParamMap: convertToParamMap({ token: 'a'.repeat(43) }) };
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), provideRouter([]), { provide: API_BASE_URL, useValue: '/api' },
      { provide: ActivatedRoute, useValue: { snapshot, get queryParamMap() { return of(snapshot.queryParamMap); } } }] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => { http.verify(); sessionStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('sends recovery requests without bearer credentials, even when a session exists', () => {
    TestBed.inject(SessionStore).token.set('existing-access-token');
    TestBed.inject(PasswordResetService).request('tester').subscribe();
    const request = http.expectOne('/api/password/reset/request');
    expect(request.request.body).toEqual({ username: 'tester' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-Session-Fingerprint')).toBe(false);
    expect(request.request.headers.get('Application')).toBe('web');
    request.flush({ status: true, outcome: 'RESET_REQUEST_ACCEPTED' }, { status: 202, statusText: 'Accepted' });
  });

  it('strips explicitly supplied stale credentials on public reset endpoints', () => {
    TestBed.inject(HttpClient).post('/api/password/reset/request', { username: 'tester' }, {
      headers: { Authorization: 'Bearer stale', 'X-Session-Fingerprint': 'stale' },
    }).subscribe();
    const request = http.expectOne('/api/password/reset/request');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-Session-Fingerprint')).toBe(false);
    request.flush({});
  });

  it('allows public recovery when browser session storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked'); });
    TestBed.inject(PasswordResetService).request('tester').subscribe();
    http.expectOne('/api/password/reset/request').flush({ status: true, outcome: 'RESET_REQUEST_ACCEPTED' });
  });

  it('waits for acknowledgement, prevents duplicates, and shows a resend cooldown', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({ username: 'tester' });
    fixture.componentInstance.submit(); fixture.componentInstance.submit();
    expect(fixture.componentInstance.requested()).toBe(false);
    http.expectOne('/api/password/reset/request').flush({ status: true, outcome: 'RESET_REQUEST_ACCEPTED' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(RESET_ACKNOWLEDGEMENT);
    expect(fixture.componentInstance.cooldown()).toBe(60);
    fixture.componentInstance.submit(); http.expectNone('/api/password/reset/request');
    vi.advanceTimersByTime(60000);
    expect(fixture.componentInstance.cooldown()).toBe(0);
    fixture.destroy();
  });

  it('shows mail-service unavailability without falsely announcing delivery', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.componentInstance.form.setValue({ username: 'tester' });
    fixture.componentInstance.submit();
    http.expectOne('/api/password/reset/request').flush({ status: false, outcome: 'RESET_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('temporarily unavailable');
    expect(fixture.componentInstance.requested()).toBe(false);
  });

  it('rejects blank usernames without requesting mail', () => {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.componentInstance.submit();
    http.expectNone('/api/password/reset/request');
  });

  it('removes the reset token from the visible URL without putting it into storage', () => {
    const replace = vi.spyOn(TestBed.inject(Location), 'replaceState');
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    expect(replace).toHaveBeenCalledWith('/password/reset');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(fixture.componentInstance.invalidLink()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('a'.repeat(43));
    http.expectNone('/api/password/reset/confirm'); // Opening/scanning a link never consumes it.
  });

  it('shows a request-new-link state for a missing token without an API call', () => {
    snapshot.queryParamMap = convertToParamMap({});
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    expect(fixture.componentInstance.invalidLink()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Request reset link');
    fixture.componentInstance.submit();
    http.expectNone('/api/password/reset/confirm');
  });

  it('accepts a newly opened link when Angular reuses an existing reset screen', () => {
    const changes = new BehaviorSubject(convertToParamMap({}));
    vi.spyOn(TestBed.inject(ActivatedRoute), 'queryParamMap', 'get').mockReturnValue(changes.asObservable());
    const fixture = TestBed.createComponent(ResetPassword);
    expect(fixture.componentInstance.invalidLink()).toBe(true);
    changes.next(convertToParamMap({ token: 'b'.repeat(43) }));
    fixture.detectChanges();
    expect(fixture.componentInstance.invalidLink()).toBe(false);
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    http.expectNone('/api/password/reset/confirm');
  });

  it('validates confirmation before submission and does not trim passwords', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.componentInstance.form.setValue({ newPassword: ' NewPass!456 ', confirmPassword: 'different' });
    fixture.componentInstance.submit(); http.expectNone('/api/password/reset/confirm');
    fixture.componentInstance.form.controls.confirmPassword.setValue(' NewPass!456 ');
    fixture.componentInstance.submit();
    const request = http.expectOne('/api/password/reset/confirm');
    expect(request.request.body).toEqual({ token: 'a'.repeat(43), newPassword: ' NewPass!456 ', confirmPassword: ' NewPass!456 ' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ status: true, outcome: 'PASSWORD_CHANGED' });
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/login');
    expect(TestBed.inject(SessionStore).notice()?.tone).toBe('success');
    expect(fixture.componentInstance.form.controls.newPassword.value).toBe('');
  });

  it('retains a valid link after password reuse so a different password can be submitted', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.componentInstance.form.setValue({ newPassword: 'NewPass!456', confirmPassword: 'NewPass!456' });
    fixture.componentInstance.submit();
    http.expectOne('/api/password/reset/confirm').flush({ status: false, outcome: 'PASSWORD_REUSED' }, { status: 409, statusText: 'Reused' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('used recently');
    expect(fixture.componentInstance.invalidLink()).toBe(false);
    expect(fixture.componentInstance.form.controls.newPassword.value).toBe('');
    fixture.componentInstance.form.setValue({ newPassword: 'OtherPass!789', confirmPassword: 'OtherPass!789' });
    fixture.componentInstance.submit();
    http.expectOne('/api/password/reset/confirm').flush({ status: true, outcome: 'PASSWORD_CHANGED' });
  });

  it('disables a used or expired link and offers a fresh request', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.componentInstance.form.setValue({ newPassword: 'NewPass!456', confirmPassword: 'NewPass!456' });
    fixture.componentInstance.submit();
    http.expectOne('/api/password/reset/confirm').flush({ outcome: 'RESET_LINK_INVALID' }, { status: 400, statusText: 'Invalid link' });
    fixture.detectChanges();
    expect(fixture.componentInstance.invalidLink()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Request reset link');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });
});
