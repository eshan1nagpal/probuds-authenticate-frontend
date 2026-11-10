import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { Account } from './account';
import { AuthService } from '../../core/auth.service';
import { SessionStore } from '../../core/session-store';
import { PortalResponse, PortalService, PopupBlockedError } from '../../core/portal.service';

describe('application portal', () => {
  const response: PortalResponse = { modules: [{ id: 'FCM', name: 'Financial Compliances', logo: 'FCM.png' }],
    adminTaskEnabled: true, changePasswordEnabled: true };
  let service: { load: ReturnType<typeof vi.fn>; launch: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    sessionStorage.clear();
    const session = new SessionStore(); session.setUser({ status: true, username: 'alice', name: 'Alice', roles: ['ROLE_ADMIN'] });
    service = { load: vi.fn(() => of(response)), launch: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { session } },
      { provide: PortalService, useValue: service }] });
  });
  it('renders legacy logos and backend-authorized actions', () => {
    const fixture = TestBed.createComponent(Account); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Welcome, Alice.');
    expect(fixture.nativeElement.querySelector('.module-logo img').getAttribute('src')).toBe('assets/images/modules/FCM.png');
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeTruthy();
    fixture.nativeElement.querySelector('.module-card').click(); expect(service.launch).toHaveBeenCalledWith('FCM');
  });
  it('handles no modules and hides unavailable actions', () => {
    service.load.mockReturnValue(of({ modules: [], adminTaskEnabled: false, changePasswordEnabled: false }));
    const fixture = TestBed.createComponent(Account); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No applications available');
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/password/change"]')).toBeNull();
  });
  it('displays retry after loading fails and popup guidance after blocking', () => {
    service.load.mockReturnValueOnce(throwError(() => new Error()));
    const fixture = TestBed.createComponent(Account); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Unable to load');
    fixture.componentInstance.load(); fixture.detectChanges();
    service.launch.mockReturnValue(throwError(() => new PopupBlockedError()));
    fixture.nativeElement.querySelector('.module-card').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Allow pop-ups');
  });
  it('shows expiry only for the final five days using the backend day count', () => {
    const session = TestBed.inject(AuthService).session;
    session.passwordExpiryDate.set('2026-12-23T14:17:00');
    const fixture = TestBed.createComponent(Account);
    for (const days of [45, 6, null, -1, Number.NaN]) {
      session.passwordExpiresInDays.set(days); fixture.detectChanges();
      expect(fixture.componentInstance.expiryNotice()).toBeNull();
    }
    for (const days of [5, 1, 0]) {
      session.passwordExpiresInDays.set(days); fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Your password expires on');
    }
    session.passwordExpiryDate.set('invalid'); fixture.detectChanges();
    expect(fixture.componentInstance.expiryNotice()).toBeNull();
  });
  it('places admin navigation in the navbar and password change inside settings', () => {
    const fixture = TestBed.createComponent(Account); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav a[href="/admin"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('main a[href="/admin"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/password/change"]')).toBeNull();
    fixture.nativeElement.querySelector('[aria-label="Account settings"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav a[href="/password/change"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('main a[href="/password/change"]')).toBeNull();
  });
  it('prevents duplicate launches while opening', () => {
    const pending = new Subject<void>(); service.launch.mockReturnValue(pending);
    const fixture = TestBed.createComponent(Account); fixture.detectChanges();
    fixture.componentInstance.launch(response.modules[0]); fixture.componentInstance.launch(response.modules[0]);
    expect(service.launch).toHaveBeenCalledTimes(1);
    pending.complete(); expect(fixture.componentInstance.opening()).toBeNull();
  });
});
