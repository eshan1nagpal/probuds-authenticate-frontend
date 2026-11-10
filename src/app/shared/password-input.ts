import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-input', imports: [ReactiveFormsModule], changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label [for]="inputId()" class="form-label">{{ label() }}</label>
    <div class="input-group password-group" [class.field-invalid]="invalid()">
      <span class="input-group-text"><i class="bi bi-lock" aria-hidden="true"></i></span>
      <input [id]="inputId()" [formControl]="control()" class="form-control" [type]="visible() ? 'text' : 'password'"
        [autocomplete]="autocomplete()" [placeholder]="placeholder()" [attr.maxlength]="maxLength()"
        [attr.aria-invalid]="invalid() ? 'true' : null" [attr.aria-describedby]="describedBy()" required>
      <button class="btn password-toggle" type="button" (click)="visible.set(!visible())"
        [attr.aria-label]="(visible() ? 'Hide ' : 'Show ') + label().toLowerCase()" [attr.aria-pressed]="visible()">
        <i class="bi" [class.bi-eye]="!visible()" [class.bi-eye-slash]="visible()" aria-hidden="true"></i>
      </button>
    </div>
  `,
})
export class PasswordInput {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input.required<string>();
  readonly label = input('Password');
  readonly autocomplete = input('current-password');
  readonly placeholder = input('Enter your password');
  readonly invalid = input(false);
  readonly describedBy = input<string | null>(null);
  readonly maxLength = input<number | null>(null);
  readonly visible = signal(false);
}
