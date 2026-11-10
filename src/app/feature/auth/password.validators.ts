import { AbstractControl, ValidationErrors } from '@angular/forms';

export const PASSWORD_PATTERN = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&]).{8,}$/u;

export function matchingPasswords(group: AbstractControl): ValidationErrors | null {
  const password: unknown = group.get('newPassword')?.value;
  const confirmation: unknown = group.get('confirmPassword')?.value;
  return password && confirmation && password !== confirmation ? { mismatch: true } : null;
}
