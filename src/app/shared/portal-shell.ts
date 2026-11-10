import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-portal-shell', imports: [RouterLink, RouterLinkActive], changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-shell.html', styleUrl: './portal-shell.css',
})
export class PortalShell {
  readonly auth = inject(AuthService);
  readonly adminTaskEnabled = input(false);
  readonly changePasswordEnabled = input(false);
  readonly settingsOpen = signal(false);
  readonly navigationOpen = signal(false);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsControl = viewChild<ElementRef<HTMLElement>>('settingsControl');
  private readonly settingsTrigger = viewChild<ElementRef<HTMLButtonElement>>('settingsTrigger');
  readonly busy = signal(false);

  closeMenus(): void { this.settingsOpen.set(false); this.navigationOpen.set(false); }

  @HostListener('document:click', ['$event'])
  closeOutsideSettings(event: MouseEvent): void {
    if (event.target instanceof Node && !this.settingsControl()?.nativeElement.contains(event.target)) {
      this.settingsOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  closeWithEscape(): void {
    if (this.settingsOpen()) {
      this.settingsOpen.set(false);
      this.settingsTrigger()?.nativeElement.focus();
    } else { this.navigationOpen.set(false); }
  }

  logout(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe(() => { void this.router.navigateByUrl('/login'); });
  }
}
