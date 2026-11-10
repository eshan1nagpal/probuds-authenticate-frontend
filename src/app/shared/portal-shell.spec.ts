import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, Subject } from 'rxjs';
import { PortalShell } from './portal-shell';
import { AuthService } from '../core/auth.service';
import { SessionStore } from '../core/session-store';

describe('portal navigation and account settings', () => {
  let logout: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sessionStorage.clear();
    const session = new SessionStore(); session.setUser({ status: true, username: 'alice', name: 'Alice' });
    logout = vi.fn(() => of(undefined));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: { session, logout } }] });
  });
  afterEach(() => vi.restoreAllMocks());
  it('toggles settings and closes with Escape while returning keyboard focus', () => {
    const fixture = TestBed.createComponent(PortalShell); fixture.componentRef.setInput('changePasswordEnabled', true); fixture.detectChanges();
    const settings: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Account settings"]');
    settings.click(); fixture.detectChanges();
    expect(settings.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#account-settings')).toBeTruthy();
    const focus = vi.spyOn(settings, 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#account-settings')).toBeNull(); expect(focus).toHaveBeenCalled();
  });
  it('closes settings on an outside click and omits a disabled password action', () => {
    const fixture = TestBed.createComponent(PortalShell); fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="Account settings"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/password/change"]')).toBeNull();
    document.body.click(); fixture.detectChanges();
    expect(fixture.componentInstance.settingsOpen()).toBe(false);
  });
  it('keeps logout inside settings and prevents duplicate logout requests', () => {
    const pending = new Subject<void>(); logout.mockReturnValue(pending);
    const router = TestBed.inject(Router); const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PortalShell); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Logout');
    fixture.nativeElement.querySelector('[aria-label="Account settings"]').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('#account-settings button').click();
    fixture.componentInstance.logout(); expect(logout).toHaveBeenCalledTimes(1);
    pending.next(); pending.complete(); expect(navigate).toHaveBeenCalledWith('/login');
  });
  it('toggles mobile navigation and displays admin only when permitted', () => {
    const fixture = TestBed.createComponent(PortalShell); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeNull();
    fixture.componentRef.setInput('adminTaskEnabled', true); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin"]')).toBeTruthy();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Toggle navigation"]');
    toggle.click(); fixture.detectChanges(); expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fixture.componentInstance.closeMenus(); fixture.detectChanges(); expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });
});
