import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AdminService, adminError } from '../../core/admin.service';
import { SessionStore } from '../../core/session-store';
import { RoleOption, UserDetail } from '../../shared/models/admin';

@Component({ selector: 'app-admin-user-roles', imports: [RouterLink], templateUrl: './user-roles.html', styleUrl: './admin-shared.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class UserRoles {
  private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly destroy = inject(DestroyRef);
  private readonly api = inject(AdminService); private readonly session = inject(SessionStore);
  readonly user = signal<UserDetail | null>(null); readonly roles = signal<RoleOption[]>([]); readonly selected = signal<string[]>([]);
  readonly loading = signal(false); readonly saving = signal(false); readonly error = signal<string | null>(null);
  readonly returnParams = this.route.snapshot.queryParams;
  constructor() { this.load(); }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(null);
    forkJoin({ user: this.api.user(this.route.snapshot.paramMap.get('id') ?? ''), roles: this.api.roles() })
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({ next: ({user, roles}) => {
        this.user.set(user); this.roles.set(roles); this.selected.set(user.roles);
      }, error: error => this.error.set(adminError(error)) });
  }
  toggle(id: string, event: Event): void {
    this.selected.update(roles => (event.target as HTMLInputElement).checked ? [...roles, id] : roles.filter(role => role!==id));
  }
  save(): void {
    if (!this.user() || this.saving() || this.loading()) return;
    if (!this.selected().length) { this.error.set('Select at least one role.'); return; }
    this.saving.set(true); this.error.set(null);
    const user = this.user()!; const self = this.session.user()?.username === user.username;
    this.api.replaceRoles(user.username, user.version, this.selected()).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false)))
      .subscribe({ next: () => { if (!self) { this.api.showFeedback('Roles updated. Existing sessions for this user have ended.'); void this.router.navigate(['/admin/users'], { queryParams: this.returnParams }); } }, error: error => this.error.set(adminError(error)) });
  }
}
