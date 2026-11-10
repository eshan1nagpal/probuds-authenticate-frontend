import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { authErrorMessage } from '../../core/auth.messages';
import { Notice as NoticeModel } from '../../core/auth.models';
import { AuthShell } from '../../shared/auth-shell';
import { Notice } from '../../shared/notice';
import { PasswordInput } from '../../shared/password-input';
import { matchingPasswords, PASSWORD_PATTERN } from './password.validators';

@Component({
  selector: 'app-change-password', imports: [ReactiveFormsModule, RouterLink, AuthShell, Notice, PasswordInput],
  changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './change-password.html',
})
export class ChangePassword {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal<NoticeModel | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    username: [this.auth.session.user()?.username || this.auth.session.pendingUsername(),
      [Validators.required, Validators.pattern(/^[^:\r\n]+$/)]],
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.maxLength(1024), Validators.pattern(PASSWORD_PATTERN)]],
    confirmPassword: ['', [Validators.required, Validators.maxLength(1024)]],
  }, { validators: matchingPasswords });

  readonly rules = [
    { label: 'At least 8 characters', matches: (value: string) => [...value].length >= 8 },
    { label: 'One uppercase letter (A–Z)', matches: (value: string) => /[A-Z]/.test(value) },
    { label: 'One lowercase letter (a–z)', matches: (value: string) => /[a-z]/.test(value) },
    { label: 'One number (0–9)', matches: (value: string) => /[0-9]/.test(value) },
    { label: 'One special character: ! @ # $ % ^ &', matches: (value: string) => /[!@#$%^&]/.test(value) },
  ];

  submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const values = this.form.getRawValue();
    this.auth.changePassword(values.username, values.currentPassword, {
      newPassword: values.newPassword, confirmPassword: values.confirmPassword,
    }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => { this.clearPasswords(); void this.router.navigateByUrl('/login'); },
      error: (error: unknown) => {
        this.clearPasswords();
        this.error.set({ tone: 'error', message: authErrorMessage(error, true) });
      },
    });
  }

  private clearPasswords(): void {
    this.form.controls.currentPassword.reset();
    this.form.controls.newPassword.reset();
    this.form.controls.confirmPassword.reset();
  }
}
