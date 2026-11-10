import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';
import { API_PATHS, AuthApi } from './api';
import { SessionStore } from './session-store';
import { AutoDismissMessage } from './auto-dismiss-message';
import { AdminFilters, CreateUser, HistoryRow, Page, RoleOption, UpdateUser, UserDetail, UserRow } from '../shared/models/admin';

export function adminError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error.message === 'string') return error.error.message;
  return 'Unable to complete this request. Please try again.';
}

const ROLE_ORDER = new Map([
  'ROLE_ADMIN', 'ROLE_LCM', 'ROLE_FCM', 'ROLE_DMS', 'ROLE_LEGAL', 'ROLE_PHASE', 'ROLE_EVENT',
].map((id, index) => [id, index]));

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly successMessage = new AutoDismissMessage(inject(DestroyRef));
  readonly feedback = this.successMessage.message;
  showFeedback(message: string | null): void { this.successMessage.set(message); }
  private url(path: string): string { return this.api.url(API_PATHS.admin + path); }
  private params(filters: AdminFilters, page?: number, size?: number): HttpParams {
    let params = new HttpParams().set('username', filters.username).set('name', filters.name);
    if (page !== undefined) params = params.set('page', page);
    if (size !== undefined) params = params.set('size', size);
    return params;
  }
  users(filters: AdminFilters, page: number, size: number): Observable<Page<UserRow>> {
    return this.http.get<Page<UserRow>>(this.url('/users'), { params: this.params(filters, page, size) });
  }
  history(filters: AdminFilters, page: number, size: number): Observable<Page<HistoryRow>> {
    return this.http.get<Page<HistoryRow>>(this.url('/login-history'), { params: this.params(filters, page, size) });
  }
  user(id: string): Observable<UserDetail> { return this.http.get<UserDetail>(this.url('/users/' + encodeURIComponent(id))); }
  roles(): Observable<RoleOption[]> {
    return this.http.get<RoleOption[]>(this.url('/roles')).pipe(map(roles => [...roles].sort((a, b) =>
      (ROLE_ORDER.get(a.id) ?? ROLE_ORDER.size) - (ROLE_ORDER.get(b.id) ?? ROLE_ORDER.size)
        || a.id.localeCompare(b.id))));
  }
  create(body: CreateUser): Observable<UserDetail> { return this.http.post<UserDetail>(this.url('/users'), body); }
  update(id: string, body: UpdateUser): Observable<UserDetail> {
    return this.http.put<UserDetail>(this.url('/users/' + encodeURIComponent(id)), body).pipe(this.invalidateSelf());
  }
  replaceRoles(id: string, version: number, roles: string[]): Observable<UserDetail> {
    return this.http.put<UserDetail>(this.url('/users/' + encodeURIComponent(id) + '/roles'), { version, roles }).pipe(this.invalidateSelf());
  }
  resetPassword(id: string, version: number, newPassword: string, confirmPassword: string): Observable<UserDetail> {
    return this.http.post<UserDetail>(this.url('/users/' + encodeURIComponent(id) + '/password'), { version, newPassword, confirmPassword }).pipe(this.invalidateSelf());
  }
  private invalidateSelf() {
    return tap<UserDetail>(user => {
      if (this.session.user()?.username === user.username) {
        this.session.clear(); this.session.notice.set({ tone: 'success', message: 'Your account was updated. Please sign in again.' });
        void this.router.navigateByUrl('/login');
      }
    });
  }
  downloadUsers(): Observable<Blob> { return this.http.get(this.url('/users/export'), { responseType: 'blob' }); }
  downloadHistory(filters: AdminFilters): Observable<Blob> { return this.http.get(this.url('/login-history/export'), { params: this.params(filters), responseType: 'blob' }); }
  saveDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob); const anchor = this.document.createElement('a');
    anchor.href = url; anchor.download = filename; this.document.body.append(anchor);
    anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }
}
