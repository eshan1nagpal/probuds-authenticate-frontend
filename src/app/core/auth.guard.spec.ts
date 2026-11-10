import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { SessionStore } from './session-store';

describe('account route guard', () => {
  let store: SessionStore;
  let sessionCheck: Observable<boolean>;
  beforeEach(() => {
    sessionStorage.clear();
    store = new SessionStore();
    sessionCheck = of(false);
    TestBed.configureTestingModule({ providers: [provideRouter([]), {
      provide: AuthService, useValue: { session: store, restoreSession: () => sessionCheck },
    }] });
  });

  function check(assertion: (result: boolean | UrlTree) => void): void {
    const decision = TestBed.runInInjectionContext(() => authGuard(
      {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>;
    decision.subscribe(assertion);
  }

  it('requires a verified session before opening the account screen', () => {
    check(result => expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login'));
    sessionCheck = of(true);
    check(result => expect(result).toBe(true));
  });

  it('directs expired-password users to the credential-verified password form', () => {
    store.passwordChangeRequired.set(true);
    check(result => expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/password/change'));
  });

  it('provides a retry message rather than granting access after a connection failure', () => {
    sessionCheck = throwError(() => new Error('Test connection failure'));
    check(result => expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login'));
    expect(store.notice()?.message).toContain('Unable to verify');
  });
});
