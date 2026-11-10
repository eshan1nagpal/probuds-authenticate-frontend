import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom, Observable, of } from 'rxjs';
import { adminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { SessionStore } from './session-store';

describe('administrator placeholder access', () => {
  let session: SessionStore;
  beforeEach(() => {
    sessionStorage.clear(); session = new SessionStore();
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: {
      session, restoreSession: () => of(!!session.user()),
    } }] });
  });
  function decision() {
    return firstValueFrom(TestBed.runInInjectionContext(() => adminGuard({} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot)) as Observable<boolean | UrlTree>);
  }
  it('requires a verified administrator role', async () => {
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(await decision() as UrlTree)).toBe('/login');
    session.setUser({ status: true, username: 'alice', roles: ['ROLE_FCM'] });
    expect(router.serializeUrl(await decision() as UrlTree)).toBe('/account');
    session.setUser({ status: true, username: 'alice', roles: ['ROLE_ADMIN'] });
    expect(await decision()).toBe(true);
  });
});
