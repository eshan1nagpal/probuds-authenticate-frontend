import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PortalShell } from '../../shared/portal-shell';
import { PortalResponse, PortalService } from '../../core/portal.service';

@Component({
  selector: 'app-admin', imports: [PortalShell], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-portal-shell [adminTaskEnabled]="portal()?.adminTaskEnabled ?? false"
    [changePasswordEnabled]="portal()?.changePasswordEnabled ?? false">
    <main class="account-page" aria-label="Administration"></main>
  </app-portal-shell>`,
})
export class Admin {
  readonly portal = signal<PortalResponse | null>(null);
  constructor() {
    inject(PortalService).load().pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({ next: portal => this.portal.set(portal), error: () => this.portal.set(null) });
  }
}
