import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { authErrorMessage, outcomeFrom } from '../../core/auth.messages';
import { Notice as NoticeModel } from '../../core/auth.models';
import { AuthShell } from '../../shared/auth-shell';
import { Notice } from '../../shared/notice';
import { PasswordInput } from '../../shared/password-input';

@Component({
  selector: 'app-login', imports: [ReactiveFormsModule, RouterLink, AuthShell, Notice, PasswordInput],
  changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './login.html',
})
export class Login {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly error = signal<NoticeModel | null>(null);
  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[^:\r\n]+$/)]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const { username, password } = this.form.getRawValue();
    this.auth.login(username, password).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: valid => {
        this.form.controls.password.reset();
        if (valid) void this.router.navigateByUrl('/account');
        else if (this.auth.session.passwordChangeRequired()) void this.router.navigateByUrl('/password/change');
      },
      error: (error: unknown) => {
        this.form.controls.password.reset();
        if (outcomeFrom(error) === 'PASSWORD_CHANGE_REQUIRED') {
          void this.router.navigateByUrl('/password/change');
        } else this.error.set({ tone: 'error', message: authErrorMessage(error) });
      },
    });
  }

  resume(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.restoreSession().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({ next: valid => { if (valid) void this.router.navigateByUrl('/account'); },
        error: (error: unknown) => this.error.set({ tone: 'error', message: authErrorMessage(error) }) });
  }
}
