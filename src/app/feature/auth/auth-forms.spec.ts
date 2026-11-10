import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../core/api';
import { authInterceptor } from '../../core/auth-interceptor';
import { authErrorMessage } from '../../core/auth.messages';
import { LOGIN_OUTCOMES } from '../../core/auth.models';
import { HttpErrorResponse } from '@angular/common/http';
import { Login } from './login';
import { ChangePassword } from './change-password';

describe('authentication forms', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), provideRouter([]), { provide: API_BASE_URL, useValue: '/api' }] });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); sessionStorage.clear(); vi.restoreAllMocks(); });

  it('validates a blank login without making a request', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Enter your password.');
    TestBed.inject(HttpTestingController).expectNone('/api/authenticate');
  });

  it('prevents duplicate login requests and clears the password on rejection', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.componentInstance.form.setValue({ username: 'tester', password: 'OldPass!123' });
    fixture.componentInstance.submit();
    fixture.componentInstance.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/authenticate');
    request.flush({ outcome: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Rejected' });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.password.value).toBe('');
    expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('username or password is incorrect');
  });

  it('offers an accessible password visibility control', () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Show password"]');
    expect(toggle.type).toBe('button');
    toggle.click();
    fixture.detectChanges();
    const password: HTMLInputElement = fixture.nativeElement.querySelector('#password');
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not submit mismatched or weak new passwords', () => {
    const fixture = TestBed.createComponent(ChangePassword);
    const component = fixture.componentInstance;
    component.form.setValue({ username: 'tester', currentPassword: 'OldPass!123',
      newPassword: 'NewPass!456', confirmPassword: 'Different!123' });
    component.submit();
    expect(component.form.hasError('mismatch')).toBe(true);
    component.form.controls.confirmPassword.setValue('weak');
    component.form.controls.newPassword.setValue('weak');
    component.submit();
    TestBed.inject(HttpTestingController).expectNone('/api/password/change');
  });

  it('renders password reuse inline and clears secret form values', () => {
    const fixture = TestBed.createComponent(ChangePassword);
    const component = fixture.componentInstance;
    component.form.setValue({ username: 'tester', currentPassword: 'OldPass!123',
      newPassword: 'NewPass!456', confirmPassword: 'NewPass!456' });
    component.submit();
    TestBed.inject(HttpTestingController).expectOne('/api/password/change')
      .flush({ outcome: 'PASSWORD_REUSED' }, { status: 409, statusText: 'Reused' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('password was used recently');
    expect(component.form.controls.currentPassword.value).toBe('');
    expect(component.form.controls.newPassword.value).toBe('');
    expect(TestBed.inject(Router).navigateByUrl).not.toHaveBeenCalled();
  });

  it.each(LOGIN_OUTCOMES)('provides a user-facing message for %s without server exception text', outcome => {
    const error = new HttpErrorResponse({ status: 403, error: { outcome, message: 'secret-server-details' } });
    const message = authErrorMessage(error);
    expect(message.length).toBeGreaterThan(10);
    expect(message).not.toContain('secret-server-details');
  });
});
