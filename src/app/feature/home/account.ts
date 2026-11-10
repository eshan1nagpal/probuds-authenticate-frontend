import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Notice as NoticeModel } from '../../core/auth.models';
import { Notice } from '../../shared/notice';
import { PortalShell } from '../../shared/portal-shell';
import { expiryDisplay } from '../../core/expiry-display';
import { PortalModule, PortalResponse, PortalService, PopupBlockedError } from '../../core/portal.service';

@Component({
  selector: 'app-account', imports: [Notice, PortalShell], changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account.html', styleUrl: './account.css',
})
export class Account {
  readonly auth = inject(AuthService);
  private readonly service = inject(PortalService);
  private readonly destroyRef = inject(DestroyRef);
  readonly portal = signal<PortalResponse | null>(null);
  readonly loading = signal(false);
  readonly opening = signal<string | null>(null);
  readonly notice = signal<NoticeModel | null>(null);
  readonly expiryNotice = computed<NoticeModel | null>(() => {
    const days = this.auth.session.passwordExpiresInDays();
    if (days === null || !Number.isFinite(days) || days > 5 || days < 0) return null;
    const date = expiryDisplay(this.auth.session.passwordExpiryDate());
    return date ? { tone: 'warning', message:
      `Your password expires on ${date} (server time). Change it before it expires.` } : null;
  });
  constructor() { this.load(); }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.notice.set(null);
    this.service.load().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: portal => this.portal.set(portal), error: () => {
        this.notice.set({ tone: 'error', message: 'Unable to load your applications. Please try again.' });
      } });
  }
  launch(module: PortalModule): void {
    if (this.opening()) return;
    this.opening.set(module.id); this.notice.set(null);
    this.service.launch(module.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.opening.set(null)))
      .subscribe({ error: (error: unknown) => {
        this.notice.set({ tone: 'error', message: error instanceof PopupBlockedError
          ? 'Allow pop-ups for this portal, then select your application again.'
          : 'Unable to open this application. Refresh the page and try again.' });
      } });
  }
}
