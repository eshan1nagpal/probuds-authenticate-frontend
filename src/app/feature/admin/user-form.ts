import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { AdminService, adminError } from '../../core/admin.service';
import { SessionStore } from '../../core/session-store';
import { RoleOption, UserDetail } from '../../shared/models/admin';
import { PasswordInput } from '../../shared/password-input';
import { PASSWORD_PATTERN, matchingPasswords } from '../auth/password.validators';
import { expiryDisplay } from '../../core/expiry-display';
import { AutoDismissMessage } from '../../core/auto-dismiss-message';

@Component({ selector: 'app-admin-user-form', imports: [ReactiveFormsModule, RouterLink, PasswordInput],
  templateUrl: './user-form.html', styleUrl: './admin-shared.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class UserForm {
  private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly destroy = inject(DestroyRef);
  private readonly api = inject(AdminService); private readonly session = inject(SessionStore); private readonly fb = inject(FormBuilder);
  readonly id = this.route.snapshot.paramMap.get('id'); readonly editing = this.id !== null;
  readonly user = signal<UserDetail | null>(null); readonly roles = signal<RoleOption[]>([]); readonly selected = signal<string[]>([]);
  readonly loading = signal(false); readonly saving = signal(false); readonly resetting = signal(false);
  readonly error = signal<string | null>(null); readonly resetError = signal<string | null>(null); private readonly successMessage = new AutoDismissMessage(this.destroy);
  readonly success = this.successMessage.message;
  readonly rolesTouched = signal(false); readonly expiryDisplay = expiryDisplay;
  readonly returnParams = this.route.snapshot.queryParams;
  readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9._@-]{0,49}$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]], email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN), Validators.maxLength(1024)]],
    confirmPassword: ['', [Validators.required, Validators.maxLength(1024)]],
    willPasswordExpire: [false], expiryDays: this.fb.control<number | null>(null),
    enabled: [true], accountNonLocked: [true], accountNonExpired: [true], credentialsNonExpired: [true],
  }, { validators: (control: AbstractControl): ValidationErrors | null => {
    if (!this.editing && control.get('password')?.value !== control.get('confirmPassword')?.value) return { mismatch: true };
    const days: number | null = control.get('expiryDays')?.value;
    if (control.get('willPasswordExpire')?.value) {
      if (days === null) return !this.editing || !this.user()?.willPasswordExpire ? { expiry: true } : null;
      if (!Number.isInteger(days) || days<1 || days>36500) return { expiry: true };
    }
    return null;
  } });
  readonly passwordForm = this.fb.nonNullable.group({ newPassword: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN), Validators.maxLength(1024)]],
    confirmPassword: ['', [Validators.required, Validators.maxLength(1024)]] }, { validators: matchingPasswords });
  constructor() {
    if (this.editing) { this.form.controls.username.disable(); this.form.controls.password.disable(); this.form.controls.confirmPassword.disable(); }
    this.load();
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(null);
    if (this.id) {
      forkJoin({ user: this.api.user(this.id), roles: this.api.roles() }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)))
        .subscribe({ next: ({user, roles}) => { this.roles.set(roles); this.user.set(user); this.form.patchValue(user); this.form.controls.expiryDays.setValue(null); }, error: error => this.error.set(adminError(error)) });
    } else {
      this.api.roles().pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)))
        .subscribe({ next: roles => this.roles.set(roles), error: error => this.error.set(adminError(error)) });
    }
  }
  toggleRole(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.update(roles => checked ? [...roles, id] : roles.filter(role => role!==id));
  }
  submit(): void {
    if (this.saving() || this.resetting() || this.loading()) return;
    this.form.markAllAsTouched(); this.rolesTouched.set(true);
    if (this.form.invalid || (!this.editing && this.selected().length===0)) return;
    this.saving.set(true); this.error.set(null); this.successMessage.set(null);
    const value = this.form.getRawValue(); const self = this.session.user()?.username === this.id;
    const request = this.id && this.user() ? this.api.update(this.id, { version: this.user()!.version, name: value.name.trim(), email: value.email.trim(),
      enabled: value.enabled, accountNonLocked: value.accountNonLocked, accountNonExpired: value.accountNonExpired,
      credentialsNonExpired: value.credentialsNonExpired, willPasswordExpire: value.willPasswordExpire, expiryDays: value.willPasswordExpire ? value.expiryDays : null })
      : this.api.create({ username: value.username.trim(), name: value.name.trim(), email: value.email.trim(), password: value.password, confirmPassword: value.confirmPassword,
        willPasswordExpire: value.willPasswordExpire, expiryDays: value.willPasswordExpire ? value.expiryDays : null, roles: this.selected() });
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({ next: () => {
      this.form.controls.password.reset(); this.form.controls.confirmPassword.reset();
      if (!self) { this.api.showFeedback(this.editing ? 'User updated successfully.' : 'User created with the selected roles.'); void this.router.navigate(['/admin/users'], { queryParams: this.returnParams }); }
    }, error: error => { this.form.controls.password.reset(); this.form.controls.confirmPassword.reset(); this.error.set(adminError(error)); } });
  }
  resetPassword(): void {
    if (!this.id || !this.user() || this.saving() || this.resetting()) return;
    this.passwordForm.markAllAsTouched(); if (this.passwordForm.invalid) return;
    this.resetting.set(true); this.resetError.set(null); this.successMessage.set(null);
    const value = this.passwordForm.getRawValue();
    this.api.resetPassword(this.id, this.user()!.version, value.newPassword, value.confirmPassword)
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => { this.resetting.set(false); this.passwordForm.reset(); }))
      .subscribe({ next: user => { this.user.set(user); this.successMessage.set('Password reset successfully. The user must sign in again.'); }, error: error => this.resetError.set(adminError(error)) });
  }
}
