import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '../../core/api';
import { authInterceptor } from '../../core/auth-interceptor';
import { SessionStore } from '../../core/session-store';
import { AdminService } from '../../core/admin.service';
import { UserForm } from './user-form';
import { UserRoles } from './user-roles';
import { Users } from './users';
import { LoginHistory } from './login-history';
import { AdminPager } from './admin-pager';

const alice = { username: 'alice', name: 'Alice', email: 'alice@example.test', roles: ['ROLE_FCM'], version: 3,
  enabled: true, accountNonLocked: true, accountNonExpired: true, credentialsNonExpired: true, willPasswordExpire: true,
  passwordExpiryDate: '2026-12-01T12:00:00', failedAttempts: 0, createdAt: '2026-01-01T00:00:00', createdBy: 'admin', updatedAt: null, updatedBy: null };
const roles = [{ id: 'ROLE_FCM', name: 'Financial Compliances' }, { id: 'ROLE_LCM', name: 'Labour Compliances' }];

describe('admin forms and request contracts', () => {
  let http: HttpTestingController;
  const query = new BehaviorSubject(convertToParamMap({ username: 'alice', name: 'Ali', page: '0', size: '10' }));
  let route: { snapshot: { paramMap: ReturnType<typeof convertToParamMap>; queryParams: object }; queryParamMap: typeof query };
  beforeEach(() => {
    sessionStorage.clear();
    query.next(convertToParamMap({ username: 'alice', name: 'Ali', page: '0', size: '10' }));
    route = { snapshot: { paramMap: convertToParamMap({}), queryParams: {} }, queryParamMap: query };
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '/api' }, { provide: ActivatedRoute, useValue: route }] });
    http = TestBed.inject(HttpTestingController);
    const session = TestBed.inject(SessionStore); session.token.set('admin-token'); session.setUser({ status: true, username: 'admin', roles: ['ROLE_ADMIN'] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); sessionStorage.clear(); });
  function expectRoles() { http.expectOne('/api/admin/roles').flush(roles); }
  function editing() { route.snapshot.paramMap = convertToParamMap({ id: 'alice' }); }

  it('dismisses success banners after five seconds', () => {
    vi.useFakeTimers();
    try {
      const api = TestBed.inject(AdminService);
      api.showFeedback('User created successfully.');
      const fixture = TestBed.createComponent(Users);
      http.expectOne(request => request.url === '/api/admin/users').flush({ items: [], total: 0, page: 0, size: 10 });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.admin-success')).toBeTruthy();
      vi.advanceTimersByTime(4999); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.admin-success')).toBeTruthy();
      vi.advanceTimersByTime(1); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.admin-success')).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it('gives a repeated success message its own five-second window', () => {
    vi.useFakeTimers();
    try {
      const api = TestBed.inject(AdminService);
      api.showFeedback('Saved.'); vi.advanceTimersByTime(3000);
      api.showFeedback('Saved.'); vi.advanceTimersByTime(2000);
      expect(api.feedback()).toBe('Saved.');
      vi.advanceTimersByTime(3000); expect(api.feedback()).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it('orders role choices consistently and keeps additional catalogue roles available', () => {
    let ids: string[] = [];
    TestBed.inject(AdminService).roles().subscribe(options => { ids = options.map(role => role.id); });
    const unordered = ['ROLE_EVENT', 'ROLE_EXTRA', 'ROLE_FCM', 'ROLE_DMS', 'ROLE_PHASE', 'ROLE_ADMIN', 'ROLE_LEGAL', 'ROLE_LCM'];
    http.expectOne('/api/admin/roles').flush(unordered.map(id => ({id, name: id})));
    expect(ids).toEqual(['ROLE_ADMIN', 'ROLE_LCM', 'ROLE_FCM', 'ROLE_DMS', 'ROLE_LEGAL', 'ROLE_PHASE', 'ROLE_EVENT', 'ROLE_EXTRA']);
  });
  it('requires roles and creates users with roles in one request', () => {
    const fixture = TestBed.createComponent(UserForm); expectRoles(); fixture.detectChanges();
    const form = fixture.componentInstance;
    form.form.patchValue({ username: 'bob', name: 'Bob', email: 'bob@example.test', password: 'NewPass!456', confirmPassword: 'NewPass!456' });
    form.submit(); http.expectNone('/api/admin/users');
    form.selected.set(['ROLE_FCM']); form.submit(); form.submit();
    const request = http.expectOne('/api/admin/users'); expect(request.request.method).toBe('POST');
    expect(request.request.body.roles).toEqual(['ROLE_FCM']); expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush({ ...alice, username: 'bob' });
    expect(form.form.controls.password.value).toBe(''); expect(TestBed.inject(Router).navigate).toHaveBeenCalled();
  });
  it('saves profile changes without a password or rewriting roles', () => {
    editing(); const fixture = TestBed.createComponent(UserForm);
    http.expectOne('/api/admin/users/alice').flush(alice); expectRoles(); fixture.detectChanges();
    const form = fixture.componentInstance; form.form.controls.name.setValue('Alice Updated'); form.submit();
    const request = http.expectOne('/api/admin/users/alice'); expect(request.request.method).toBe('PUT');
    expect(request.request.body.version).toBe(3); expect(request.request.body.expiryDays).toBeNull();
    expect(request.request.body.password).toBeUndefined(); expect(request.request.body.roles).toBeUndefined();
    request.flush({ ...alice, name: 'Alice Updated', version: 4 });
  });
  it('resets passwords separately and preserves draft profile changes', () => {
    editing(); const fixture = TestBed.createComponent(UserForm); http.expectOne('/api/admin/users/alice').flush(alice); expectRoles();
    const component = fixture.componentInstance; component.form.controls.name.setValue('Unsaved name');
    component.passwordForm.setValue({ newPassword: 'OtherPass!789', confirmPassword: 'OtherPass!789' }); component.resetPassword();
    const request = http.expectOne('/api/admin/users/alice/password'); expect(request.request.body.version).toBe(3);
    request.flush({ ...alice, version: 4 });
    expect(component.user()?.version).toBe(4); expect(component.form.controls.name.value).toBe('Unsaved name');
    expect(component.passwordForm.controls.newPassword.value).toBe('');
  });
  it('shows stale edit errors without silently overwriting data', () => {
    editing(); const fixture = TestBed.createComponent(UserForm); http.expectOne('/api/admin/users/alice').flush(alice); expectRoles();
    fixture.componentInstance.submit(); http.expectOne('/api/admin/users/alice').flush({ code: 'STALE_USER', message: 'Reload and try again.' }, { status: 409, statusText: 'Conflict' });
    expect(fixture.componentInstance.error()).toBe('Reload and try again.'); expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });
  it('preselects roles and prevents an empty role replacement', () => {
    editing(); const fixture = TestBed.createComponent(UserRoles); http.expectOne('/api/admin/users/alice').flush(alice); expectRoles(); fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toEqual(['ROLE_FCM']);
    fixture.componentInstance.selected.set([]); fixture.componentInstance.save(); http.expectNone('/api/admin/users/alice/roles');
    fixture.componentInstance.selected.set(['ROLE_LCM']); fixture.componentInstance.save();
    const request = http.expectOne('/api/admin/users/alice/roles'); expect(request.request.body).toEqual({ version: 3, roles: ['ROLE_LCM'] }); request.flush({ ...alice, version: 4, roles: ['ROLE_LCM'] });
  });
  it('exports all users without pagination or search parameters', () => {
    const fixture = TestBed.createComponent(Users);
    const list = http.expectOne(request => request.url === '/api/admin/users'); expect(list.request.params.get('username')).toBe('alice');
    list.flush({ items: [alice], total: 55, page: 0, size: 10 }); fixture.detectChanges();
    const download = vi.spyOn(TestBed.inject(AdminService), 'saveDownload').mockImplementation(() => undefined);
    fixture.componentInstance.download(); const request = http.expectOne('/api/admin/users/export'); expect(request.request.params.keys()).toEqual([]);
    request.flush(new Blob(['synthetic workbook'])); expect(download).toHaveBeenCalledWith(expect.any(Blob), 'users.xlsx');
    fixture.componentInstance.pagination({ page: 1, size: 10 }); expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { username: 'alice', name: 'Ali', page: 1, size: 10 } }));
  });
  it('exports history using applied filters rather than unsaved filter text', () => {
    const fixture = TestBed.createComponent(LoginHistory);
    http.expectOne(request => request.url === '/api/admin/login-history').flush({ items: [], total: 0, page: 0, size: 10 });
    vi.spyOn(TestBed.inject(AdminService), 'saveDownload').mockImplementation(() => undefined);
    fixture.componentInstance.form.controls.username.setValue('draft'); fixture.componentInstance.download();
    const request = http.expectOne(request => request.url === '/api/admin/login-history/export');
    expect(request.request.params.get('username')).toBe('alice'); expect(request.request.params.get('name')).toBe('Ali'); expect(request.request.params.has('page')).toBe(false);
    request.flush(new Blob(['synthetic workbook']));
  });
  it('ends a locally cached session after editing the current administrator', () => {
    TestBed.inject(AdminService).update('admin', { version: 1, name: 'Admin', email: 'admin@example.test', enabled: true, accountNonLocked: true,
      accountNonExpired: true, credentialsNonExpired: true, willPasswordExpire: false, expiryDays: null }).subscribe();
    http.expectOne('/api/admin/users/admin').flush({ ...alice, username: 'admin' });
    expect(TestBed.inject(SessionStore).token()).toBeNull(); expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/login');
  });
  it('disables pagination boundaries for empty results and the final page', () => {
    const fixture = TestBed.createComponent(AdminPager); fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button'); expect(buttons[0].disabled).toBe(true); expect(buttons[1].disabled).toBe(true);
    fixture.componentRef.setInput('total', 21); fixture.componentRef.setInput('page', 2); fixture.detectChanges();
    expect(buttons[0].disabled).toBe(false); expect(buttons[1].disabled).toBe(true);
  });
});
