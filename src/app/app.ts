import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  @HostListener('window:focus')
  refreshSession(): void {
    if (this.router.url.startsWith('/password/reset') || this.router.url.startsWith('/forgot-password')) return;
    if (this.auth.session.hasToken() && this.auth.session.user()) {
      this.auth.restoreSession().subscribe({ error: () => {
        this.auth.session.notice.set({ tone: 'warning', message: 'Unable to check your session. Check your connection and try again.' });
      } });
    }
  }
}
