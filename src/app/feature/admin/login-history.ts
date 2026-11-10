import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, defer, finalize, of, startWith, Subject, switchMap } from 'rxjs';
import { AdminService, adminError } from '../../core/admin.service';
import { AdminFilters, Page, HistoryRow } from '../../shared/models/admin';
import { AdminPager } from './admin-pager';
import { expiryDisplay } from '../../core/expiry-display';

@Component({
  selector: 'app-login-history', imports: [ReactiveFormsModule, AdminPager], changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login-history.html', styleUrl: './admin-shared.css'
})
export class LoginHistory {
  readonly api = inject(AdminService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({ username: [''], name: [''] });
  private readonly refresh = new Subject<void>();
  retry(): void { this.refresh.next(); }
  readonly filters = signal<AdminFilters>({ username: '', name: '' }); readonly result = signal<Page<HistoryRow> | null>(null);
  readonly page = signal(0); readonly size = signal(10); readonly busy = signal(false); readonly downloading = signal(false);
  readonly error = signal<string | null>(null); readonly expiryDisplay = expiryDisplay;
  constructor() {
    combineLatest([this.route.queryParamMap, this.refresh.pipe(startWith(undefined))]).pipe(switchMap(([params]) => defer(() => {
      const filters = { username: params.get('username') ?? '', name: params.get('name') ?? '' };
      const page = Number(params.get('page') ?? 0); const size = Number(params.get('size') ?? 10);
      this.page.set(Number.isInteger(page) && page >= 0 && page <= 1000000 ? page : 0);
      this.size.set([10, 25, 50, 100].includes(size) ? size : 10);
      this.filters.set(filters); this.form.setValue(filters); this.busy.set(true); this.error.set(null); this.result.set(null);
      return this.api.history(filters, this.page(), this.size()).pipe(catchError(error => { this.error.set(adminError(error)); return of(null); }), finalize(() => this.busy.set(false)));
    })), takeUntilDestroyed(this.destroy)).subscribe(result => this.result.set(result));
  }
  search(): void { const filters = this.form.getRawValue(); this.navigate({ username: filters.username.trim(), name: filters.name.trim() }, 0, this.size()); }
  clear(): void { this.navigate({ username: '', name: '' }, 0, 10); }
  pagination(event: { page: number; size: number }): void { this.navigate(this.filters(), event.page, event.size); }
  private navigate(filters: AdminFilters, page: number, size: number): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { ...filters, page, size } });
  }
  download(): void {
    if (this.downloading()) return;
    this.downloading.set(true); this.error.set(null);
    this.api.downloadHistory(this.filters()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.downloading.set(false)))
      .subscribe({ next: blob => this.api.saveDownload(blob, 'login-history.xlsx'), error: error => this.error.set(adminError(error)) });
  }
}
