import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { PasswordResetService, RESET_ACKNOWLEDGEMENT, resetErrorMessage } from '../../core/password-reset.service';
import { Notice as NoticeModel } from '../../core/auth.models';
import { AuthShell } from '../../shared/auth-shell';
import { Notice } from '../../shared/notice';

@Component({
  selector: 'app-forgot-password', imports: [ReactiveFormsModule, RouterLink, AuthShell, Notice],
  changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly resets = inject(PasswordResetService);
  private readonly destroyRef = inject(DestroyRef);
  readonly busy = signal(false);
  readonly requested = signal(false);
  readonly cooldown = signal(0);
  readonly error = signal<NoticeModel | null>(null);
  readonly acknowledgement = RESET_ACKNOWLEDGEMENT;
  readonly form = inject(FormBuilder).nonNullable.group({ username: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/\S/)]] });
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() { this.destroyRef.onDestroy(() => this.stopCountdown()); }

  submit(): void {
    if (this.busy() || this.cooldown() > 0) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.form.controls.username.value.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.resets.request(this.form.controls.username.value).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({ next: () => {
      this.requested.set(true);
      this.cooldown.set(60);
      this.stopCountdown();
      this.interval = setInterval(() => {
        this.cooldown.update(value => Math.max(0, value - 1));
        if (this.cooldown() === 0) this.stopCountdown();
      }, 1000);
    }, error: (error: unknown) => this.error.set({ tone: 'error', message: resetErrorMessage(error) }) });
  }

  private stopCountdown(): void {
    if (this.interval !== null) clearInterval(this.interval);
    this.interval = null;
  }
}
