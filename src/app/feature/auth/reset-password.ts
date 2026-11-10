import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PasswordResetService, resetErrorMessage, resetOutcome } from '../../core/password-reset.service';
import { Notice as NoticeModel } from '../../core/auth.models';
import { AuthShell } from '../../shared/auth-shell';
import { Notice } from '../../shared/notice';
import { PasswordInput } from '../../shared/password-input';
import { matchingPasswords, PASSWORD_PATTERN } from './password.validators';

@Component({
  selector: 'app-reset-password', imports: [ReactiveFormsModule, RouterLink, AuthShell, Notice, PasswordInput],
  changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly resets = inject(PasswordResetService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private token: string | null = null;
  readonly busy = signal(false);
  readonly invalidLink = signal(true);
  readonly error = signal<NoticeModel | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: ['', [Validators.required, Validators.maxLength(1024), Validators.pattern(PASSWORD_PATTERN)]],
    confirmPassword: ['', [Validators.required, Validators.maxLength(1024)]],
  }, { validators: matchingPasswords });

  constructor() {
    // Hash routing keeps the token off HTTP requests. Remove it from this history entry as well.
    const location = inject(Location);
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const candidate = params.get('token');
      this.token = candidate && /^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : null;
      this.invalidLink.set(!this.token);
      this.form.reset();
      this.error.set(null);
      location.replaceState('/password/reset');
    });
    this.destroyRef.onDestroy(() => { this.token = null; this.form.reset(); });
  }

  submit(): void {
    if (this.busy() || this.invalidLink() || !this.token) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.resets.confirm({ token: this.token, ...this.form.getRawValue() }).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({ next: () => {
      this.token = null;
      this.form.reset();
      void this.router.navigateByUrl('/login');
    }, error: (error: unknown) => {
      this.form.reset();
      if (resetOutcome(error) === 'RESET_LINK_INVALID') {
        this.token = null;
        this.invalidLink.set(true);
      }
      this.error.set({ tone: 'error', message: resetErrorMessage(error) });
    } });
  }
}
