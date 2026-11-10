import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PortalShell } from '../../shared/portal-shell';
import { PortalResponse, PortalService } from '../../core/portal.service';

@Component({
  selector: 'app-admin', imports: [PortalShell, RouterLink, RouterLinkActive, RouterOutlet], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-portal-shell [adminTaskEnabled]="portal()?.adminTaskEnabled ?? true"
    [changePasswordEnabled]="portal()?.changePasswordEnabled ?? false">
    <main class="admin-dashboard-shell" aria-label="Administration">
      <aside class="admin-sidebar-card" aria-label="Admin navigation">
        <nav class="admin-sidebar-nav">
          <a class="admin-sidebar-link" routerLink="/admin/users" routerLinkActive="active" ariaCurrentWhenActive="page"><i class="bi bi-person-fill" aria-hidden="true"></i><span>User</span></a>
          <a class="admin-sidebar-link" routerLink="/admin/login-history" routerLinkActive="active" ariaCurrentWhenActive="page"><i class="bi bi-clock-history" aria-hidden="true"></i><span>Login History</span></a>
        </nav>
      </aside>
      <section class="admin-content-card"><router-outlet /></section>
    </main>
  </app-portal-shell>`, styleUrl: './admin.css',
})
export class Admin {
  readonly portal = signal<PortalResponse | null>(null);
  constructor() {
    inject(PortalService).load().pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({ next: portal => this.portal.set(portal), error: () => this.portal.set(null) });
  }
}
